import React, { useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ITemplate, ITemplateSlide, ISlide, ICanvasSlide, IBlock, ICanvasItem } from '@/core/types';
import { X, LayoutTemplate, Plus, Trash2, Upload, ChevronLeft, Layers, Settings2, Pencil, ArrowRight, RefreshCw, FolderPlus, Search, Download, Copy, AlertCircle } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { EktmpService } from '@/features/presenter/services/ektmpService';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import ConfirmDialog from '@/shared/ui/ConfirmDialog';
import { toast } from '@/core/utils/toast';

type NavLevel =
    | { type: 'all' }
    | { type: 'template'; template: ITemplate }
    | { type: 'block'; template: ITemplate; blockId: string };

// ────────────────────────────────────────────────────────────────────────────
// Confirm Dialog State
// ────────────────────────────────────────────────────────────────────────────
interface ConfirmState {
    open: boolean;
    kind: 'slide' | 'group' | 'template' | 'block';
    title: string;
    description: string;
    template?: ITemplate;
    slide?: ITemplateSlide | 'base';
    blockId?: string;
    block?: IBlock;
    migrationTargetId?: string; // for template delete with migration
    onConfirmOverride?: () => Promise<void>; // Add dynamic confirm handler
}

const EMPTY_CONFIRM: ConfirmState = { open: false, kind: 'slide', title: '', description: '' };

const TemplatePickerModal: React.FC = () => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const isRu = lang === 'ru';
    const isDev = import.meta.env.DEV;

    const { closeModal, stack } = useModalStore();
    // Find the LAST instance to correctly support nested modals
    const modalData = [...stack].reverse().find(m => m.id === ModalType.TEMPLATE_PICKER);
    const isOpen = !!modalData;
    const slideId = modalData?.props?.slideId as string | undefined;
    const blockId = modalData?.props?.blockId as string | undefined;

    const { activePresentationId, updatePresentationSlides, setPreviewSlide } = usePresentationStore();

    const presentation = useLiveQuery(
        () => activePresentationId ? db.presentationFiles.get(activePresentationId) : undefined,
        [activePresentationId]
    );

    const allTemplates = useLiveQuery(() => db.templates.toArray()) || [];
    const allBlocks = useLiveQuery(() => db.blocks.toArray()) || [];
    const blocksMap = useMemo(() => new Map(allBlocks.map((b: IBlock) => [b.id, b])), [allBlocks]);

    // ─── Search State ─────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');

    const templates = useMemo(() => {
        let filtered = allTemplates;
        if (blockId) filtered = filtered.filter(t => t.category === blockId);
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(t =>
                t.name.toLowerCase().includes(query) ||
                t.nameRu?.toLowerCase().includes(query)
            );
        }
        return filtered.filter(t => t.id !== 'blank-dark');
    }, [allTemplates, blockId, searchQuery]);

    const [navStack, setNavStack] = useState<NavLevel[]>([{ type: 'all' }]);
    const currentView = navStack[navStack.length - 1];

    const pushNav = (level: NavLevel) => setNavStack([...navStack, level]);
    const popNav = () => setNavStack(navStack.slice(0, -1));

    // ─── Naming states ────────────────────────────────────────────────────
    const [isNamingTemplate, setIsNamingTemplate] = useState(false);
    const [namingTargetTemplate, setNamingTargetTemplate] = useState<ITemplate | null>(null);
    const [newName, setNewName] = useState('');
    const [newNameRu, setNewNameRu] = useState('');
    const [targetBlockId, setTargetBlockId] = useState<string | undefined>(undefined);

    // ─── Context Menu State ───────────────────────────────────────────────
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'template' | 'block' | 'slide'; data: Record<string, unknown> } | null>(null);

    // ─── Confirm Dialog State ─────────────────────────────────────────────
    const [confirmState, setConfirmState] = useState<ConfirmState>(EMPTY_CONFIRM);

    // ─── Edit Property State ──────────────────────────────────────────────
    const [editingTemplate, setEditingTemplate] = useState<ITemplate | null>(null);
    const [editingLayout, setEditingLayout] = useState<{ template: ITemplate; slide: ITemplateSlide } | null>(null);
    const [editName, setEditName] = useState('');
    const [editNameRu, setEditNameRu] = useState('');
    const [editId, setEditId] = useState(''); // For filename/ID editing
    const [editBackgroundColor, setEditBackgroundColor] = useState('#000000'); // For base bg editing
    const [editCategoryId, setEditCategoryId] = useState<string | undefined>(undefined);
    const [editParentTemplateId, setEditParentTemplateId] = useState<string | undefined>(undefined);

    // ─── Move Bunch State ─────────────────────────────────────────────────
    const [movingBunch, setMovingBunch] = useState<{ template: ITemplate; sourceBlockId: string } | null>(null);

    // ─── Block Manager State ──────────────────────────────────────────────
    const [showBlockManager, setShowBlockManager] = useState(false);
    const [editingBlock, setEditingBlock] = useState<IBlock | null>(null);
    const [isAddingBlock, setIsAddingBlock] = useState(false);
    const [blockFormName, setBlockFormName] = useState('');
    const [blockFormNameRu, setBlockFormNameRu] = useState('');
    const [blockFormColor, setBlockFormColor] = useState('#6366f1');
    const [blockFormIcon, setBlockFormIcon] = useState('📄');

    const currentSlide = presentation?.slides?.find(s => s.id === slideId);
    const currentBlock = currentSlide ? blocksMap.get(currentSlide.blockId) : undefined;

    // ─── Helper to refresh nav stack after template mutations ─────────────
    const refreshNavTemplate = (updatedTemplate: ITemplate) => {
        setNavStack(prev => prev.map(level =>
            (level.type === 'template' || level.type === 'block') && level.template.id === updatedTemplate.id
                ? { ...level, template: updatedTemplate } : level
        ));
    };

    // ────────────────────────────────────────────────────────────────────────
    // HANDLERS
    // ────────────────────────────────────────────────────────────────────────

    const handleSelectTemplate = async (template: ITemplate, nestedSlide?: ITemplateSlide) => {
        if (!activePresentationId || !presentation || !slideId) return;
        const currentIndex = presentation.slides.findIndex(s => s.id === slideId);
        if (currentIndex === -1) return;
        const cs = presentation.slides[currentIndex];
        const sourceCanvasItems = nestedSlide?.canvasItems || template.canvasItems || [];
        const newCanvasItems = (sourceCanvasItems as ICanvasItem[]).map(item => ({ ...item, id: crypto.randomUUID() }));
        const newSlide: ICanvasSlide = {
            id: crypto.randomUUID(),
            type: 'normal',
            order: 0,
            blockId: cs.blockId,
            templateId: template.id,
            backgroundOverride: nestedSlide?.backgroundOverride,
            content: { variables: {}, canvasItems: newCanvasItems.length > 0 ? newCanvasItems : undefined },
        };
        const newSlides = [...presentation.slides];
        newSlides.splice(currentIndex + 1, 0, newSlide);
        const orderedSlides = newSlides.map((s, i) => ({ ...s, order: i }));
        await updatePresentationSlides(activePresentationId, orderedSlides);
        setPreviewSlide(newSlide.id, activePresentationId);
        closeModal(ModalType.TEMPLATE_PICKER);
    };

    // ─── Duplicate Template ───────────────────────────────────────────────
    const handleDuplicateTemplate = async (template: ITemplate) => {
        const duplicatedTemplate: ITemplate = {
            ...template,
            id: (isDev ? 'prebuilt-' : 'custom-') + Date.now().toString(),
            name: `${template.name} (Copy)`,
            nameRu: template.nameRu ? `${template.nameRu} (Копия)` : undefined,
            isUserCreated: !isDev,
            templateSlides: template.templateSlides?.map((ts: ITemplateSlide) => ({ ...ts, id: crypto.randomUUID() }))
        };
        await db.templates.add(duplicatedTemplate);
        await EktmpService.saveAsEktmpFile(duplicatedTemplate.id);
        toast.success(t('template_duplicated', 'Template duplicated'));
    };

    // ─── Export Template ──────────────────────────────────────────────────
    const handleExportTemplate = async (template: ITemplate) => {
        try {
            // Re-save to ensure ektmp is up to date, then generate download
            await EktmpService.saveAsEktmpFile(template.id);
            const fileBlob = await EktmpService.pack(template.id);
            if (!fileBlob) throw new Error('File not found');

            const url = URL.createObjectURL(fileBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${template.id}.ektmp`; // Could use template.name, but IDs are safer for filenames
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success(t('export_success', 'Template exported'));
        } catch (e) {
            console.error(e);
            toast.error(t('export_error', 'Failed to export template'));
        }
    };

    // ─── Save As Template ─────────────────────────────────────────────────
    const handleSaveAsTemplate = () => {
        if (!currentSlide || !currentBlock) return;
        setNewName('New Template');
        setNewNameRu('Новый шаблон');
        setTargetBlockId(undefined);
        setIsNamingTemplate(true);
        setNamingTargetTemplate(null);
    };

    const confirmSaveTemplate = async () => {
        if (!currentSlide || !currentBlock || !newName) return;
        if (namingTargetTemplate) {
            const canvasSlide = currentSlide.type === 'normal' ? currentSlide as ICanvasSlide : null;
            const newTemplateSlide: ITemplateSlide = {
                id: crypto.randomUUID(),
                type: 'normal',
                name: newName,
                nameRu: newNameRu || newName,
                categoryId: targetBlockId,
                canvasItems: canvasSlide?.content?.canvasItems || [],
                backgroundOverride: canvasSlide?.backgroundOverride,
            };
            const updatedTemplate = {
                ...namingTargetTemplate,
                templateSlides: [...(namingTargetTemplate.templateSlides || []), newTemplateSlide]
            };
            await db.templates.put(updatedTemplate);
            refreshNavTemplate(updatedTemplate);
            await EktmpService.saveAsEktmpFile(updatedTemplate.id);
        } else {
            const canvasSlide = currentSlide.type === 'normal' ? currentSlide as ICanvasSlide : null;
            const newTemplate: ITemplate = {
                id: (isDev ? 'prebuilt-' : 'custom-') + Date.now().toString(),
                name: newName,
                nameRu: newNameRu || newName,
                category: targetBlockId || currentBlock.id,
                background: canvasSlide?.backgroundOverride || [{ id: crypto.randomUUID(), type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#000000' }],
                assets: [],
                structure: { layout: (canvasSlide?.content?.canvasItems?.length || 0) > 0 ? 'blank' : 'center' },
                isUserCreated: !isDev,
                canvasItems: canvasSlide?.content?.canvasItems || [],
            };
            await db.templates.add(newTemplate);
            pushNav({ type: 'template', template: newTemplate });
            await EktmpService.saveAsEktmpFile(newTemplate.id);
        }
        setIsNamingTemplate(false);
        setNamingTargetTemplate(null);
        setTargetBlockId(undefined);
    };

    // ─── Add Slide to Template (with block/category prompt) ───────────────
    const handleAddSlideToTemplate = (e: React.MouseEvent | null, template: ITemplate, bId?: string) => {
        if (e) e.stopPropagation();
        if (!currentSlide || (!isDev && !template.isUserCreated)) return;

        // Check if the current slide's block is different from the target template's categories
        const slideBlockId = currentSlide.blockId;
        const targetBlockId = bId || template.category;

        // Find if template already has slides in this block
        const hasSlideInBlock = template.category === slideBlockId ||
            (template.templateSlides?.some(s => s.categoryId === slideBlockId));

        const initNaming = () => {
            setNewName('New Layout');
            setNewNameRu('Новый вариант');
            setNamingTargetTemplate(template);
            setTargetBlockId(targetBlockId);
            setIsNamingTemplate(true);
        };

        if (!hasSlideInBlock && slideBlockId !== targetBlockId) {
            const blockName = blocksMap.get(slideBlockId)?.name || slideBlockId;
            setConfirmState({
                open: true,
                kind: 'slide',
                title: t('add_category_prompt_title', 'Add Category?'),
                description: t('add_category_prompt_desc', `This template doesn't have layouts for the "{{block}}" category. Do you want to add it as a "{{block}}" layout instead?`, { block: blockName }),
                onConfirmOverride: async () => {
                    setTargetBlockId(slideBlockId);
                    setConfirmState(EMPTY_CONFIRM);
                    initNaming();
                }
            });
            return;
        }

        initNaming();
    };

    // ─── Update Template Properties (name + category + background + ID) ───
    const handleUpdateTemplateProperties = async () => {
        if (!editingTemplate || !editName || !editId) return;

        const oldId = editingTemplate.id;
        const newId = editId.trim();

        const updatedTemplate: ITemplate = {
            ...editingTemplate,
            id: newId,
            name: editName,
            nameRu: editNameRu || editName,
            category: editCategoryId || editingTemplate.category,
            background: editingTemplate.background.map((bg, idx: number) =>
                idx === 0 && bg.type === 'color' ? { ...bg, color: editBackgroundColor } : bg
            )
        };

        if (oldId !== newId) {
            // 1. Update all slides using this template across all presentations
            const presentations = await db.presentationFiles.toArray();
            for (const pres of presentations) {
                let changed = false;
                const updatedSlides = pres.slides.map(s => {
                    if (s.templateId === oldId) {
                        changed = true;
                        return { ...s, templateId: newId };
                    }
                    return s;
                });
                if (changed) {
                    await db.presentationFiles.update(pres.id, { slides: updatedSlides });
                }
            }

            // 2. Delete old DB entry and filesystem file
            await db.templates.delete(oldId);
            await EktmpService.deleteFromFilesystem(oldId);
        }

        await db.templates.put(updatedTemplate);
        refreshNavTemplate(updatedTemplate);
        await EktmpService.saveAsEktmpFile(updatedTemplate.id);
        setEditingTemplate(null);
        toast.success(t('edit_properties'));
    };

    // ─── Update Layout Properties (name, category, optional parent move) ──
    const handleUpdateLayoutProperties = async () => {
        if (!editingLayout || !editName) return;
        const { template, slide } = editingLayout;

        // If user selected a different parent template → move the slide
        if (editParentTemplateId && editParentTemplateId !== template.id) {
            const targetTemplate = allTemplates.find(t => t.id === editParentTemplateId);
            if (targetTemplate) {
                const movedSlide: ITemplateSlide = { ...slide, name: editName, nameRu: editNameRu || editName, categoryId: editCategoryId };
                // Remove from source
                const updatedSource: ITemplate = { ...template, templateSlides: template.templateSlides?.filter((ts: ITemplateSlide) => ts.id !== slide.id) };
                await db.templates.put(updatedSource);
                refreshNavTemplate(updatedSource);
                await EktmpService.saveAsEktmpFile(updatedSource.id);
                // Add to target
                const updatedTarget: ITemplate = { ...targetTemplate, templateSlides: [...(targetTemplate.templateSlides || []), movedSlide] };
                await db.templates.put(updatedTarget);
                await EktmpService.saveAsEktmpFile(updatedTarget.id);
                toast.success(t('layout_moved'));
            }
        } else {
            const updatedTemplate: ITemplate = {
                ...template,
                templateSlides: template.templateSlides?.map((ts: ITemplateSlide) => ts.id === slide.id
                    ? { ...ts, name: editName, nameRu: editNameRu || editName, categoryId: editCategoryId }
                    : ts
                )
            };
            await db.templates.put(updatedTemplate);
            refreshNavTemplate(updatedTemplate);
            await EktmpService.saveAsEktmpFile(updatedTemplate.id);
        }
        setEditingLayout(null);
        setEditParentTemplateId(undefined);
    };

    // ─── Move Bunch ───────────────────────────────────────────────────────
    const handleMoveBunch = async (targetBId: string) => {
        if (!movingBunch) return;
        const { template, sourceBlockId } = movingBunch;
        const updatedTemplate: ITemplate = {
            ...template,
            category: template.category === sourceBlockId ? targetBId : template.category,
            templateSlides: template.templateSlides?.map((s: ITemplateSlide) =>
                s.categoryId === sourceBlockId ? { ...s, categoryId: targetBId } : s
            ),
        };
        await db.templates.put(updatedTemplate);
        refreshNavTemplate(updatedTemplate);
        await EktmpService.saveAsEktmpFile(updatedTemplate.id);
        setMovingBunch(null);
        toast.success(t('slides_moved'));
    };

    // ─── Update Slide Content (with dev guard) ────────────────────────────
    const handleUpdateSlideContent = async (template: ITemplate, s: ITemplateSlide | 'base') => {
        if (!currentSlide) return;
        // Dev guard for default templates
        if (!isDev && !template.isUserCreated) {
            toast.warning(t('cannot_update_default'));
            return;
        }
        const canvasSlide = currentSlide.type === 'normal' ? currentSlide as ICanvasSlide : null;
        const newCanvasItems = (canvasSlide?.content?.canvasItems || []).map(item => ({ ...item, id: crypto.randomUUID() }));
        let updatedTemplate: ITemplate;
        if (s === 'base') {
            updatedTemplate = { ...template, canvasItems: newCanvasItems, background: canvasSlide?.backgroundOverride || template.background };
        } else {
            updatedTemplate = {
                ...template,
                templateSlides: template.templateSlides?.map((ts: ITemplateSlide) => ts.id === s.id ? { ...ts, canvasItems: newCanvasItems, backgroundOverride: canvasSlide?.backgroundOverride } : ts)
            };
        }
        await db.templates.put(updatedTemplate);
        refreshNavTemplate(updatedTemplate);
        await EktmpService.saveAsEktmpFile(updatedTemplate.id);
        toast.success(t('update_with_current'));
    };

    // ─── Delete Slide (via confirm dialog) ────────────────────────────────
    const requestDeleteSlide = (template: ITemplate, s: ITemplateSlide | 'base') => {
        if (s === 'base') {
            toast.warning(t('cannot_delete_base_group'));
            return;
        }
        setConfirmState({
            open: true, kind: 'slide',
            title: t('confirm_delete_layout'),
            description: t('confirm_delete_layout_desc'),
            template, slide: s,
        });
    };

    const executeDeleteSlide = async () => {
        const { template, slide } = confirmState;
        if (!template || !slide || slide === 'base') return;
        const updatedTemplate: ITemplate = { ...template, templateSlides: template.templateSlides?.filter((ts: ITemplateSlide) => ts.id !== (slide as ITemplateSlide).id) };
        await db.templates.put(updatedTemplate);
        refreshNavTemplate(updatedTemplate);
        await EktmpService.saveAsEktmpFile(updatedTemplate.id);
        setConfirmState(EMPTY_CONFIRM);
        toast.success(t('layout_deleted'));
    };

    // ─── Delete Block Bunch (via confirm dialog) ──────────────────────────
    const requestDeleteBlockBunch = (template: ITemplate, bId: string) => {
        if (template.category === bId) {
            toast.warning(t('cannot_delete_base_group'));
            return;
        }
        setConfirmState({
            open: true, kind: 'group',
            title: t('confirm_delete_group'),
            description: t('confirm_delete_group_desc'),
            template, blockId: bId,
        });
    };

    const executeDeleteBlockBunch = async () => {
        const { template, blockId: bId } = confirmState;
        if (!template || !bId) return;
        const updatedTemplate: ITemplate = { ...template, templateSlides: template.templateSlides?.filter((s: ITemplateSlide) => s.categoryId !== bId) };
        await db.templates.put(updatedTemplate);
        refreshNavTemplate(updatedTemplate);
        await EktmpService.saveAsEktmpFile(updatedTemplate.id);
        setConfirmState(EMPTY_CONFIRM);
        toast.success(t('group_deleted'));
    };

    // ─── Delete Template (via confirm dialog with migration option) ───────
    const requestDeleteTemplate = (template: ITemplate) => {
        if (!isDev && !template.isUserCreated) return;
        setConfirmState({
            open: true, kind: 'template',
            title: t('confirm_delete_template'),
            description: t('confirm_delete_template_desc'),
            template, migrationTargetId: undefined,
        });
    };

    const executeDeleteTemplate = async () => {
        const { template, migrationTargetId } = confirmState;
        if (!template) return;

        // If migration target is selected, move slides first
        if (migrationTargetId) {
            const targetTemplate = allTemplates.find(t => t.id === migrationTargetId);
            if (targetTemplate && template.templateSlides?.length) {
                const updatedTarget: ITemplate = {
                    ...targetTemplate,
                    templateSlides: [...(targetTemplate.templateSlides || []), ...template.templateSlides],
                };
                await db.templates.put(updatedTarget);
                await EktmpService.saveAsEktmpFile(updatedTarget.id);
                toast.success(t('slides_moved'));
            }
        }

        await db.templates.delete(template.id);
        await EktmpService.deleteFromFilesystem(template.id);
        if (currentView.type === 'template' && currentView.template.id === template.id) popNav();
        setConfirmState(EMPTY_CONFIRM);
        toast.success(t('template_deleted'));
    };

    // ─── Block Manager Handlers ───────────────────────────────────────────
    const openBlockForm = (block?: IBlock) => {
        if (block) {
            setEditingBlock(block);
            setBlockFormName(block.name);
            setBlockFormNameRu(block.nameRu);
            setBlockFormColor(block.color);
            setBlockFormIcon(block.icon);
            setIsAddingBlock(false);
        } else {
            setEditingBlock(null);
            setBlockFormName('');
            setBlockFormNameRu('');
            setBlockFormColor('#6366f1');
            setBlockFormIcon('📄');
            setIsAddingBlock(true);
        }
    };

    const saveBlock = async () => {
        if (!blockFormName.trim()) return;
        if (editingBlock) {
            const updated: IBlock = { ...editingBlock, name: blockFormName, nameRu: blockFormNameRu || blockFormName, color: blockFormColor, icon: blockFormIcon };
            await db.blocks.put(updated);
        } else {
            const newBlock: IBlock = {
                id: crypto.randomUUID(),
                name: blockFormName,
                nameRu: blockFormNameRu || blockFormName,
                color: blockFormColor,
                icon: blockFormIcon,
                description: '',
                defaultSlides: 1,
            };
            await db.blocks.add(newBlock);
        }
        setEditingBlock(null);
        setIsAddingBlock(false);
        toast.success(t('block_saved'));
    };

    const requestDeleteBlock = (block: IBlock) => {
        setConfirmState({
            open: true, kind: 'block',
            title: t('confirm_delete_block'),
            description: t('confirm_delete_block_desc'),
            block,
        });
    };

    const executeDeleteBlock = async () => {
        const { block } = confirmState;
        if (!block) return;
        await db.blocks.delete(block.id);
        setConfirmState(EMPTY_CONFIRM);
        toast.success(t('block_deleted'));
    };

    // ─── Confirm Dialog Dispatch ──────────────────────────────────────────
    const handleConfirm = useCallback(async () => {
        if (confirmState.onConfirmOverride) {
            await confirmState.onConfirmOverride();
            return;
        }
        switch (confirmState.kind) {
            case 'slide': await executeDeleteSlide(); break;
            case 'group': await executeDeleteBlockBunch(); break;
            case 'template': await executeDeleteTemplate(); break;
            case 'block': await executeDeleteBlock(); break;
        }
    }, [confirmState]);

    // ────────────────────────────────────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────────────────────────────────────

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-10001 flex items-center justify-center bg-black/70 backdrop-blur-lg animate-in fade-in duration-300">
            <div className="bg-stone-900 border border-white/10 rounded-[28px] w-full max-w-xl max-h-[70vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
                {/* ── Header ────────────────────────────────────────────── */}
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        {navStack.length > 1 ? (
                            <button type="button" onClick={popNav} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition-colors cursor-pointer">
                                <ChevronLeft className="w-5 h-5 text-stone-300" />
                            </button>
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                                <LayoutTemplate className="w-5 h-5 text-accent" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-lg font-black text-white tracking-tight uppercase">
                                {currentView.type === 'template' ? (isRu ? currentView.template.nameRu : currentView.template.name) :
                                    currentView.type === 'block' ? (isRu ? blocksMap.get(currentView.blockId)?.nameRu || currentView.blockId : blocksMap.get(currentView.blockId)?.name || currentView.blockId) :
                                        t('all_templates')}
                            </h2>
                            <p className="text-[9px] text-stone-500 font-bold uppercase tracking-[0.2em] mt-0.5">
                                {currentView.type === 'template' ? t('select_block') :
                                    currentView.type === 'block' ? t('select_layout') :
                                        t('organized_by_template')}
                            </p>
                        </div>
                    </div>

                    {currentView.type === 'all' && (
                        <div className="flex-1 max-w-xs mx-4">
                            <div className="relative">
                                <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('search_templates', 'Search templates...')}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-stone-600 focus:border-accent/40 focus:ring-1 focus:ring-accent/40 outline-hidden transition-all"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 ml-auto shrink-0">
                        {/* Manage Blocks */}
                        <button type="button" onClick={() => setShowBlockManager(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider text-stone-300 transition-colors cursor-pointer" aria-label={t('manage_blocks')}>
                            <Settings2 className="w-3.5 h-3.5" />
                        </button>
                        {/* Import */}
                        <button type="button" onClick={() => {
                            const input = document.createElement('input'); input.type = 'file'; input.accept = '.ektmp';
                            input.onchange = async (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
                                try { const imported = await EktmpService.unpack(file); await db.templates.add(imported); toast.success(t('import')); } catch { toast.error('Failed to import.'); }
                            }; input.click();
                        }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider text-stone-300 cursor-pointer">
                            <Upload className="w-3.5 h-3.5" /> {t('import')}
                        </button>
                        {/* Save as Template */}
                        <button type="button" onClick={handleSaveAsTemplate} disabled={!currentSlide} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 text-accent hover:bg-accent/30 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer">
                            <Plus className="w-3.5 h-3.5" /> {isDev ? t('add_prebuilt') : t('save_as_template')}
                        </button>
                    </div>
                    <div className="w-px h-8 bg-white/5 mx-2 shrink-0" />
                    <button type="button" onClick={() => closeModal(ModalType.TEMPLATE_PICKER)} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-stone-400 hover:text-white border border-white/5 cursor-pointer shrink-0"><X className="w-5 h-5" /></button>
                </div>

                {/* ── Content ───────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-5">
                    {/* ALL TEMPLATES VIEW */}
                    {currentView.type === 'all' && (
                        <>
                            {templates.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
                                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                                        <LayoutTemplate className="w-8 h-8 text-stone-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('no_templates_found', 'No Templates Found')}</h3>
                                        <p className="text-xs text-stone-500 mt-1 max-w-[200px]">{searchQuery ? t('try_different_search', 'Try adjusting your search query.') : t('click_save_as_template', 'Click "Save as Template" to create one.')}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-3">
                                    {templates.map((template) => {
                                        const isActive = currentSlide?.templateId === template.id;
                                        const totalSlides = (template.templateSlides?.length || 0) + (template.canvasItems ? 1 : 0);
                                        return (
                                            <div key={template.id} className="relative group">
                                                <button type="button" onClick={() => pushNav({ type: 'template', template })} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'template', data: { template } }); }} className={cn("w-full aspect-video rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden block text-left bg-stone-900", isActive ? "border-accent ring-2 ring-accent/20" : "border-white/5 hover:border-white/20", "hover:scale-[1.02]")}>
                                                    <SlideContentRenderer template={template} block={currentBlock || blocksMap.get(template.category)} variables={{}} lang={lang} isPreview={true} scale={180 / 1920} canvasItems={template.canvasItems || []} showLockBadge={!template.isUserCreated} hideOverlays={true} />
                                                    <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent px-2 py-1.5"><span className={cn("text-[8px] font-bold uppercase tracking-tight line-clamp-1", isActive ? "text-accent" : "text-white/70")}>{isRu ? template.nameRu : template.name}</span></div>
                                                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/10 z-20"><Layers className="w-2.5 h-2.5 text-stone-300" /><span className="text-[8px] font-bold text-stone-300">{totalSlides}</span></div>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {/* TEMPLATE VIEW (grouped by block) */}
                    {currentView.type === 'template' && (
                        <div className="grid grid-cols-3 gap-3">
                            {(() => {
                                const slidesByBlock = new Map<string, (ITemplateSlide | 'base')[]>();
                                const baseBlockId = currentView.template.category || 'none';
                                slidesByBlock.set(baseBlockId, ['base']);
                                currentView.template.templateSlides?.forEach(s => {
                                    const bId = s.categoryId || baseBlockId;
                                    const list = slidesByBlock.get(bId) || []; list.push(s); slidesByBlock.set(bId, list);
                                });
                                // Remove empty block groups 
                                const blockEntries = Array.from(slidesByBlock.entries()).filter(([_, slides]) => slides.length > 0);

                                return blockEntries.map(([bId, slides]) => {
                                    const block = blocksMap.get(bId);
                                    return (
                                        <div key={bId} className="relative group">
                                            <button type="button" onClick={() => pushNav({ type: 'block', template: currentView.template, blockId: bId })} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'block', data: { template: currentView.template, blockId: bId } }); }} className="w-full aspect-video rounded-xl border-2 border-white/5 hover:border-white/20 bg-stone-900 relative overflow-hidden transition-all hover:scale-[1.02] cursor-pointer">
                                                <SlideContentRenderer template={currentView.template} block={block} variables={{}} lang={lang} isPreview={true} scale={180 / 1920} canvasItems={slides[0] === 'base' ? (currentView.template.canvasItems || []) : slides[0].canvasItems} backgroundOverride={slides[0] === 'base' ? undefined : slides[0].backgroundOverride} hideOverlays={true} />
                                                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-[10px] font-black uppercase text-white tracking-widest px-3 py-1 bg-stone-900/80 rounded-full border border-white/10">{slides.length} {t('slides')}</span></div>
                                                <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent px-2.5 py-2 z-20"><span className="text-[9px] font-black uppercase tracking-wider text-white">{block ? (isRu ? block.nameRu : block.name) : bId}</span></div>
                                            </button>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    )}

                    {/* BLOCK VIEW (individual slides) */}
                    {currentView.type === 'block' && (
                        <div className="grid grid-cols-3 gap-3">
                            {(() => {
                                const allInBlock: (ITemplateSlide | 'base')[] = [];
                                if (currentView.template.category === currentView.blockId) allInBlock.push('base');
                                (currentView.template.templateSlides || []).forEach(s => { if (s.categoryId === currentView.blockId || (!s.categoryId && currentView.template.category === currentView.blockId)) allInBlock.push(s); });
                                return allInBlock.map((s, idx) => (
                                    <div key={idx} className="relative group">
                                        <button type="button" onClick={() => handleSelectTemplate(currentView.template, s === 'base' ? undefined : s)} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'slide', data: { template: currentView.template, slide: s } }); }} className="w-full aspect-video rounded-xl border-2 border-white/5 hover:border-white/20 bg-stone-900 relative overflow-hidden transition-all hover:scale-[1.02] cursor-pointer">
                                            <SlideContentRenderer template={currentView.template} block={blocksMap.get(currentView.blockId)} variables={{}} lang={lang} isPreview={true} scale={180 / 1920} canvasItems={s === 'base' ? (currentView.template.canvasItems || []) : s.canvasItems} backgroundOverride={s === 'base' ? undefined : s.backgroundOverride} hideOverlays={true} />
                                            <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent px-2 py-1.5"><span className="text-[8px] font-bold uppercase tracking-tight line-clamp-1 text-white/70">{s === 'base' ? t('base_layout') : (isRu ? s.nameRu : s.name)}</span></div>
                                        </button>
                                    </div>
                                ));
                            })()}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                OVERLAYS
            ═══════════════════════════════════════════════════════════════ */}

            {/* ── Naming Template/Layout Overlay (with block picker) ─── */}
            {isNamingTemplate && (
                <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-md">
                    <div className="bg-stone-800 border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-sm font-black text-white uppercase mb-4">{namingTargetTemplate ? t('name_layout') : t('name_template')}</h3>
                        <div className="space-y-3">
                            <input autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmSaveTemplate(); if (e.key === 'Escape') setIsNamingTemplate(false); }} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden" placeholder="Name..." />
                            {isDev && <input type="text" value={newNameRu} onChange={(e) => setNewNameRu(e.target.value)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden" placeholder="Название..." />}
                            {/* Block Picker */}
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1 block">{t('select_block_category')}</label>
                                <select
                                    value={targetBlockId || ''}
                                    onChange={(e) => setTargetBlockId(e.target.value || undefined)}
                                    className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden cursor-pointer"
                                >
                                    <option value="">{t('no_block')}</option>
                                    {allBlocks.map(b => (
                                        <option key={b.id} value={b.id}>{b.icon} {isRu ? b.nameRu : b.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={() => setIsNamingTemplate(false)} className="flex-1 px-4 py-2 rounded-xl bg-white/5 text-stone-400 font-bold uppercase text-[10px] cursor-pointer">{t('cancel')}</button>
                            <button type="button" onClick={confirmSaveTemplate} disabled={!newName.trim()} className="flex-1 px-4 py-2 rounded-xl bg-accent text-stone-900 font-bold uppercase text-[10px] cursor-pointer disabled:opacity-50">{t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Template Properties Overlay ─────────────────── */}
            {editingTemplate && (
                <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-md">
                    <div className="bg-stone-800 border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-sm font-black text-white uppercase mb-4">{t('edit_properties')}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1 block">{t('template_name', 'Name')}</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input autoFocus type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden" placeholder="Name" />
                                    <input type="text" value={editNameRu} onChange={(e) => setEditNameRu(e.target.value)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden" placeholder="Название" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1 block">{t('template_id', 'File Name / ID')}</label>
                                <input type="text" value={editId} onChange={(e) => setEditId(e.target.value)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-stone-400 focus:border-accent/40 outline-hidden font-mono" placeholder="template-id" />
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1 block">{t('category', 'Category')}</label>
                                    <select
                                        value={editCategoryId || ''}
                                        onChange={(e) => setEditCategoryId(e.target.value || undefined)}
                                        className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden cursor-pointer"
                                    >
                                        <option value="">{t('no_block')}</option>
                                        {allBlocks.map(b => (
                                            <option key={b.id} value={b.id}>{b.icon} {isRu ? b.nameRu : b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="shrink-0">
                                    <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1 block">{t('background', 'Background')}</label>
                                    <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl p-1.5 min-h-[44px]">
                                        <input
                                            type="color"
                                            value={editBackgroundColor}
                                            onChange={(e) => setEditBackgroundColor(e.target.value)}
                                            className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer overflow-hidden p-0"
                                        />
                                        <span className="text-[10px] font-mono text-stone-500 pr-2">{editBackgroundColor.toUpperCase()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={() => setEditingTemplate(null)} className="flex-1 px-4 py-2 rounded-xl bg-white/5 text-stone-400 font-bold uppercase text-[10px] cursor-pointer">{t('cancel')}</button>
                            <button type="button" onClick={handleUpdateTemplateProperties} className="flex-1 px-4 py-2 rounded-xl bg-accent text-stone-900 font-bold uppercase text-[10px] cursor-pointer">{t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Layout Properties Overlay (with parent template) */}
            {editingLayout && (
                <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-md">
                    <div className="bg-stone-800 border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-sm font-black text-white uppercase mb-4">{t('edit_layout')}</h3>
                        <div className="space-y-3">
                            <input autoFocus type="text" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateLayoutProperties(); }} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden" placeholder="Name" />
                            <input type="text" value={editNameRu} onChange={(e) => setEditNameRu(e.target.value)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden" placeholder="Название" />
                            {/* Block/Category Picker */}
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1 block">{t('select_block_category')}</label>
                                <select
                                    value={editCategoryId || ''}
                                    onChange={(e) => setEditCategoryId(e.target.value || undefined)}
                                    className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden cursor-pointer"
                                >
                                    <option value="">{t('no_block')}</option>
                                    {allBlocks.map(b => (
                                        <option key={b.id} value={b.id}>{b.icon} {isRu ? b.nameRu : b.name}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Parent Template Picker */}
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1 block">{t('move_layout_to_template')}</label>
                                <select
                                    value={editParentTemplateId || editingLayout.template.id}
                                    onChange={(e) => setEditParentTemplateId(e.target.value)}
                                    className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden cursor-pointer"
                                >
                                    {allTemplates.filter(t => t.id !== 'blank-dark').map(tmpl => (
                                        <option key={tmpl.id} value={tmpl.id}>{isRu ? tmpl.nameRu : tmpl.name}{tmpl.id === editingLayout.template.id ? ' ●' : ''}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={() => { setEditingLayout(null); setEditParentTemplateId(undefined); }} className="flex-1 px-4 py-2 rounded-xl bg-white/5 text-stone-400 font-bold uppercase text-[10px] cursor-pointer">{t('cancel')}</button>
                            <button type="button" onClick={handleUpdateLayoutProperties} className="flex-1 px-4 py-2 rounded-xl bg-accent text-stone-900 font-bold uppercase text-[10px] cursor-pointer">{t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Move Bunch Overlay ────────────────────────────────── */}
            {movingBunch && (
                <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-md">
                    <div className="bg-stone-800 border border-white/10 rounded-[24px] w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-sm font-black text-white uppercase mb-4 text-center">{t('move_to_block')}</h3>
                        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto no-scrollbar">
                            {allBlocks.map(block => (
                                <button type="button" key={block.id} onClick={() => handleMoveBunch(block.id)} className="px-3 py-3 rounded-xl bg-white/5 hover:bg-accent/10 border border-white/5 hover:border-accent/20 transition-all text-left cursor-pointer">
                                    <span className="text-[10px] font-black uppercase text-stone-400 hover:text-accent tracking-wider">{block.icon} {isRu ? block.nameRu : block.name}</span>
                                </button>
                            ))}
                        </div>
                        <button type="button" onClick={() => setMovingBunch(null)} className="w-full mt-4 px-4 py-2.5 rounded-xl bg-white/5 text-stone-400 font-bold uppercase text-[10px] cursor-pointer">{t('cancel')}</button>
                    </div>
                </div>
            )}

            {/* ── Block Manager Overlay ─────────────────────────────── */}
            {showBlockManager && (
                <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-md">
                    <div className="bg-stone-800 border border-white/10 rounded-[24px] w-full max-w-md p-6 shadow-2xl max-h-[70vh] flex flex-col">
                        <div className="flex items-center justify-between mb-5 shrink-0">
                            <h3 className="text-sm font-black text-white uppercase tracking-wide">{t('manage_blocks')}</h3>
                            <button type="button" onClick={() => { setShowBlockManager(false); setIsAddingBlock(false); setEditingBlock(null); }} className="p-1.5 rounded-xl hover:bg-white/5 text-stone-500 hover:text-white transition-colors cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Block List */}
                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mb-4">
                            {allBlocks.map(block => (
                                <div key={block.id} className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/5 group">
                                    <span className="text-base shrink-0">{block.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-white truncate">{isRu ? block.nameRu : block.name}</p>
                                        <p className="text-[9px] text-stone-500 font-medium">{block.id}</p>
                                    </div>
                                    <div className="w-4 h-4 rounded-full shrink-0 border border-white/10" style={{ backgroundColor: block.color }} />
                                    <button type="button" onClick={() => openBlockForm(block)} className="p-1.5 rounded-lg hover:bg-white/10 text-stone-500 hover:text-accent opacity-0 group-hover:opacity-100 transition-all cursor-pointer" aria-label={t('edit_block')}>
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button type="button" onClick={() => requestDeleteBlock(block)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-stone-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer" aria-label={t('delete_block')}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add/Edit Block Form */}
                        {(isAddingBlock || editingBlock) ? (
                            <div className="bg-black/20 rounded-xl border border-white/5 p-4 space-y-3 shrink-0">
                                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-wider">{editingBlock ? t('edit_block') : t('add_block')}</h4>
                                <div className="flex gap-2">
                                    <input type="text" value={blockFormName} onChange={(e) => setBlockFormName(e.target.value)} placeholder={t('block_name')} className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-accent/40 outline-hidden" autoFocus />
                                    <input type="text" value={blockFormNameRu} onChange={(e) => setBlockFormNameRu(e.target.value)} placeholder={t('block_name_ru')} className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-accent/40 outline-hidden" />
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-[8px] font-bold text-stone-500 uppercase mb-1 block">{t('block_icon')}</label>
                                        <input type="text" value={blockFormIcon} onChange={(e) => setBlockFormIcon(e.target.value)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-accent/40 outline-hidden text-center" maxLength={4} />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[8px] font-bold text-stone-500 uppercase mb-1 block">{t('block_color')}</label>
                                        <div className="flex gap-2 items-center">
                                            <input type="color" value={blockFormColor} onChange={(e) => setBlockFormColor(e.target.value)} className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent" />
                                            <input type="text" value={blockFormColor} onChange={(e) => setBlockFormColor(e.target.value)} className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-accent/40 outline-hidden font-mono" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => { setIsAddingBlock(false); setEditingBlock(null); }} className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-stone-400 font-bold uppercase text-[10px] cursor-pointer">{t('cancel')}</button>
                                    <button type="button" onClick={saveBlock} disabled={!blockFormName.trim()} className="flex-1 px-3 py-2 rounded-lg bg-accent text-stone-900 font-bold uppercase text-[10px] disabled:opacity-50 cursor-pointer">{t('save')}</button>
                                </div>
                            </div>
                        ) : (
                            <button type="button" onClick={() => openBlockForm()} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-accent/10 border border-dashed border-white/10 hover:border-accent/20 text-stone-400 hover:text-accent text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer">
                                <FolderPlus className="w-4 h-4" /> {t('add_block')}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Context Menus ─────────────────────────────────────── */}
            {contextMenu && (
                <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
                    {contextMenu.type === 'template' && (() => {
                        const tmpl = contextMenu.data.template as ITemplate;
                        return (
                            <>
                                <ContextMenuItem icon={<Pencil className="w-full h-full" />} label={t('edit_properties')} onClick={() => {
                                    setEditingTemplate(tmpl);
                                    setEditName(tmpl.name);
                                    setEditNameRu(tmpl.nameRu || '');
                                    setEditId(tmpl.id);
                                    setEditCategoryId(tmpl.category);
                                    setEditBackgroundColor(tmpl.background[0]?.type === 'color' ? tmpl.background[0].color || '#000000' : '#000000');
                                    setContextMenu(null);
                                }} />
                                <ContextMenuItem icon={<Copy className="w-full h-full" />} label={t('duplicate', 'Duplicate')} onClick={() => { handleDuplicateTemplate(tmpl); setContextMenu(null); }} />
                                <ContextMenuItem icon={<Download className="w-full h-full" />} label={t('export', 'Export')} onClick={() => { handleExportTemplate(tmpl); setContextMenu(null); }} />
                                {(isDev || tmpl.isUserCreated) && (
                                    <ContextMenuItem icon={<Trash2 className="w-full h-full" />} label={t('delete')} danger onClick={() => { requestDeleteTemplate(tmpl); setContextMenu(null); }} />
                                )}
                            </>
                        );
                    })()}
                    {contextMenu.type === 'block' && (() => {
                        const tmpl = contextMenu.data.template as ITemplate;
                        const bId = contextMenu.data.blockId as string;
                        return (
                            <>
                                <ContextMenuItem icon={<Plus className="w-full h-full" />} label={t('add_current_slide')} onClick={() => { handleAddSlideToTemplate(null, tmpl, bId); setContextMenu(null); }} />
                                <ContextMenuItem icon={<ArrowRight className="w-full h-full" />} label={t('move')} onClick={() => { setMovingBunch({ template: tmpl, sourceBlockId: bId }); setContextMenu(null); }} />
                                <ContextMenuItem icon={<Trash2 className="w-full h-full" />} label={t('delete')} danger onClick={() => { requestDeleteBlockBunch(tmpl, bId); setContextMenu(null); }} />
                            </>
                        );
                    })()}
                    {contextMenu.type === 'slide' && (() => {
                        const tmpl = contextMenu.data.template as ITemplate;
                        const s = contextMenu.data.slide as ITemplateSlide | 'base';
                        const canUpdate = isDev || tmpl.isUserCreated;
                        return (
                            <>
                                {canUpdate && (
                                    <ContextMenuItem icon={<RefreshCw className="w-full h-full" />} label={t('update_with_current')} onClick={() => { handleUpdateSlideContent(tmpl, s); setContextMenu(null); }} />
                                )}
                                {s !== 'base' && (
                                    <ContextMenuItem icon={<Pencil className="w-full h-full" />} label={t('edit')} onClick={() => {
                                        const slide = s as ITemplateSlide;
                                        setEditingLayout({ template: tmpl, slide });
                                        setEditName(slide.name || '');
                                        setEditNameRu(slide.nameRu || '');
                                        setEditCategoryId(slide.categoryId);
                                        setEditParentTemplateId(undefined);
                                        setContextMenu(null);
                                    }} />
                                )}
                                {s !== 'base' && (
                                    <ContextMenuItem icon={<Trash2 className="w-full h-full" />} label={t('delete')} danger onClick={() => { requestDeleteSlide(tmpl, s); setContextMenu(null); }} />
                                )}
                            </>
                        );
                    })()}
                </ContextMenu>
            )}

            {/* ── Confirm Dialog ────────────────────────────────────── */}
            <ConfirmDialog
                isOpen={confirmState.open}
                onCancel={() => setConfirmState(EMPTY_CONFIRM)}
                onConfirm={handleConfirm}
                title={confirmState.title}
                description={confirmState.description}
                confirmLabel={confirmState.onConfirmOverride ? t('confirm', 'Confirm') : t('delete')}
                cancelLabel={t('cancel')}
                danger={!confirmState.onConfirmOverride}
            >
                {/* Migration option for template deletion */}
                {confirmState.kind === 'template' && confirmState.template?.templateSlides?.length ? (
                    <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 block">{t('move_slides_before_delete')}</label>
                        <select
                            value={confirmState.migrationTargetId || ''}
                            onChange={(e) => setConfirmState(prev => ({ ...prev, migrationTargetId: e.target.value || undefined }))}
                            className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-accent/40 outline-hidden cursor-pointer"
                        >
                            <option value="">{t('select_target_template')}</option>
                            {allTemplates.filter(t => t.id !== confirmState.template?.id && t.id !== 'blank-dark').map(tmpl => (
                                <option key={tmpl.id} value={tmpl.id}>{isRu ? tmpl.nameRu : tmpl.name}</option>
                            ))}
                        </select>
                    </div>
                ) : null}
            </ConfirmDialog>
        </div>,
        document.body
    );
};

export default TemplatePickerModal;
