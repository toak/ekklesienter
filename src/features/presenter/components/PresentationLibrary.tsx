import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAtom } from 'jotai';
import { db } from '@/core/db/index';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useTranslation } from 'react-i18next';
import { BookOpen, Monitor, Music, Coins, Baby, Mic2, Megaphone, Plus, Presentation, LayoutTemplate, Layers, Layout, type LucideIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/core/utils/cn';
import { themeAccentAtom, devModeAtom } from '@/core/store/uiAtoms';
import { IBlock, ISlide, ICanvasSlide, ITemplate, ITemplateSlide } from '@/core/types';
import PresentationSelector from './library/PresentationSelector';
import SlideContentRenderer from './slide-editor/SlideContentRenderer';
import { GraceLibBin } from './library/GraceLibBin';
import { EktpService } from '@/features/presenter/services/ektpService';
import { EktmpService } from '@/features/presenter/services/ektmpService';
import { MediaType } from '@/core/types';
import { GraceLibExportService } from '@/features/presenter/services/GraceLibExportService';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';
import { Edit2, RefreshCw, ChevronRight, FolderPlus, MoreVertical, Folder, Download } from 'lucide-react';
import { TemplateItem } from './library/TemplateItem';
import { LibraryImportService } from '../services/LibraryImportService';

const ICON_MAP: Record<string, LucideIcon> = {
    Monitor, Music, Coins, Baby, Mic2, Megaphone, BookOpen, Plus, Presentation, Layers, Layout
};

// TemplateItem is now imported from ./library/TemplateItem

const PresentationLibrary: React.FC = () => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const isRu = lang === 'ru';

    const {
        activePresentationId,
        activeServiceId,
        activeService,
        updatePresentationSlides,
        setPreviewSlide,
        activeBlockId,
        setActiveBlockId,
        previewSlideId,
        graceLibSection,
        setGraceLibSection,
        graceLibMediaBins,
        addMediaBin,
        updateMediaBin,
        removeMediaBin,
        templateNavPath,
        pushTemplateNav,
        popTemplateNav,
        setTemplateNavPath,
        presentationBinNavPath,
        setPresentationBinNavPath,
        createPresentationBin,
        renamePresentationBin,
        removePresentationBin,
        movePresentationToBin,
        overrideTemplateSlide,
        updateTemplate,
        removeTemplate,
        renameTemplateSlide,
        removeTemplateSlide
    } = usePresentationStore();

    const { openModal: openGlobalModal } = useModalStore();

    const [devMode] = useAtom(devModeAtom);

    const [contextMenu, setContextMenu] = useState<{
        x: number,
        y: number,
        item: any,
        type: 'template' | 'media-bin' | 'template-slide' | 'presentation-bin' | 'presentation'
    } | null>(null);

    const blocks = useLiveQuery(() => db.blocks.toArray()) || [];
    const presentation = useLiveQuery(
        () => activePresentationId ? db.presentationFiles.get(activePresentationId) : undefined,
        [activePresentationId]
    );
    const allPresentations = useLiveQuery(() => db.presentationFiles.toArray()) || [];

    const presentationBins = useLiveQuery(() => db.presentationBins.toArray()) || [];

    const allTemplates = useLiveQuery(() => db.templates.toArray()) || [];

    const templatesInCurrentBlock = useLiveQuery(
        () => activeBlockId ? db.templates.where('category').equals(activeBlockId).toArray() : [],
        [activeBlockId]
    ) || [];

    const selectedSlide = useMemo(() =>
        presentation?.slides?.find(s => s.id === previewSlideId),
        [presentation, previewSlideId]
    );

    const currentBinId = presentationBinNavPath.length > 0 ? presentationBinNavPath[presentationBinNavPath.length - 1] : null;

    const filteredPresentations = useMemo(() => {
        return allPresentations.filter(p => !p.serviceId && (p.binId || null) === (currentBinId || null));
    }, [allPresentations, currentBinId]);

    const filteredBins = useMemo(() => {
        return presentationBins.filter(b => (b.parentId || null) === (currentBinId || null));
    }, [presentationBins, currentBinId]);

    const handleImportFiles = (filesOrPaths: File[] | string[]) => {
        LibraryImportService.importFiles(filesOrPaths, currentBinId || undefined, t);
    };

    const handleImportClick = async () => {
        if (!window.electron?.ipcRenderer?.selectFile) {
            // Web fallback
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = '.ektp,.ektmp,.ektgl,.pptx,image/*,video/*,audio/*';
            input.onchange = (e) => {
                const files = Array.from((e.target as HTMLInputElement).files || []);
                handleImportFiles(files);
            };
            input.click();
            return;
        }

        try {
            const files = await window.electron.ipcRenderer.selectFile({
                properties: ['openFile', 'multiSelections'],
                filters: [
                    { name: 'Supported Files', extensions: ['ektp', 'ektmp', 'ektgl', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'mp4', 'webm', 'ogg', 'mp3', 'wav', 'm4a', 'aac', 'flac'] }
                ]
            });
            if (!files) return;
            const filePaths = Array.isArray(files) ? files : [files];
            handleImportFiles(filePaths);
        } catch (error) {
            console.error('Failed to open file picker:', error);
        }
    };

    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        // Check for internal drag-and-drop JSON payload to move presentation
        try {
            const dataStr = e.dataTransfer.getData('application/json');
            if (dataStr) {
                const data = JSON.parse(dataStr);
                if (data.source === 'presentation-library' && data.presentationId) {
                    const pres = await db.presentationFiles.get(data.presentationId);
                    if (pres) {
                        if (pres.serviceId) {
                            // Dragged from active service selector -> Create a standalone copy in GraceLib
                            const cloneId = crypto.randomUUID();
                            const clone = {
                                ...pres,
                                id: cloneId,
                                serviceId: undefined,
                                isMaster: false,
                                binId: currentBinId || undefined,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            };
                            await db.presentationFiles.add(clone);
                            toast.success(t('added_to_gracelib', 'Added presentation to GraceLib'));
                        } else {
                            // Dragged from within GraceLib -> Move to current viewed bin
                            await db.presentationFiles.update(data.presentationId, { binId: currentBinId || undefined });
                            toast.success(t('moved_presentation', 'Moved presentation to bin'));
                        }
                    }
                    return;
                }
            }
        } catch (err) { }

        const files = Array.from(e.dataTransfer.files);
        handleImportFiles(files);
    };

    useEffect(() => {
        if (!(window as any).electron?.ipcRenderer) return;

        const unsubs = [
            (window as any).electron.ipcRenderer.on('menu:export-gracelib', () => {
                GraceLibExportService.exportGraceLib();
            }),
            (window as any).electron.ipcRenderer.on('menu:export-presentations', () => {
                GraceLibExportService.exportCollection('presentations');
            }),
            (window as any).electron.ipcRenderer.on('menu:export-templates', () => {
                GraceLibExportService.exportCollection('templates');
            })
        ];

        return () => {
            unsubs.forEach((unsub: () => void) => unsub());
        };
    }, []);

    const handleTemplateClick = async (template: ITemplate, templateSlideId?: string, isBefore?: boolean) => {
        if (!activePresentationId || !presentation) return;

        const slides = presentation.slides || [];
        const currentSlideIdx = slides.findIndex(s => s.id === previewSlideId);

        // Find the specific template slide layout if provided, otherwise fallback to base canvasItems
        let slideLayout: ITemplateSlide | undefined;
        if (templateSlideId && template.templateSlides) {
            slideLayout = template.templateSlides.find(s => s.id === templateSlideId);
        }

        // Deep clone canvas items
        const sourceCanvasItems = slideLayout?.canvasItems || template.canvasItems || [];
        const newCanvasItems = sourceCanvasItems.map(item => ({
            ...item,
            id: crypto.randomUUID()
        }));

        const newSlide: ICanvasSlide = {
            id: crypto.randomUUID(),
            type: 'normal',
            order: slides.length, // Will be re-calculated below
            blockId: slideLayout?.categoryId || template.category,
            templateId: template.id,
            backgroundOverride: slideLayout?.backgroundOverride || undefined,
            content: {
                variables: template.assets?.[0]?.type === 'text' ? { content: template.assets[0].content } : {},
                canvasItems: newCanvasItems.length > 0 ? newCanvasItems : undefined
            },
        };

        let newSlides = [...slides];
        if (isBefore && currentSlideIdx !== -1) {
            newSlides.splice(currentSlideIdx, 0, newSlide);
        } else if (currentSlideIdx !== -1) {
            newSlides.splice(currentSlideIdx + 1, 0, newSlide);
        } else {
            newSlides.push(newSlide);
        }

        // Re-order all slides
        newSlides = newSlides.map((s, i) => ({ ...s, order: i }));

        await updatePresentationSlides(activePresentationId, newSlides);
        setPreviewSlide(newSlide.id);
    };

    const handleOverrideTemplateSlide = async (template: ITemplate, layoutSlideId: string) => {
        if (!selectedSlide) return;
        await overrideTemplateSlide(template.id, layoutSlideId, selectedSlide, devMode);
    };

    const handlePresentationClick = async (targetPres: any) => {
        if (!activePresentationId || !presentation) return;
        if (targetPres.id === activePresentationId) return;

        const slides = presentation.slides || [];
        const newSlide: ICanvasSlide = {
            id: crypto.randomUUID(),
            type: 'normal',
            order: slides.length,
            blockId: 'master-presentation',
            templateId: 'default', // Master presentations don't use templates in the same way, but we need a valid ID
            backgroundOverride: undefined,
            content: { variables: {} },
            masterPresentationId: targetPres.id,
            isExpanded: false
        };

        const newSlides = [...slides, newSlide];
        await updatePresentationSlides(activePresentationId, newSlides);
        setPreviewSlide(newSlide.id);
    };

    const selectedBlock = blocks.find(b => b.id === activeBlockId);

    // ─── Render ───

    const currentNav = templateNavPath[templateNavPath.length - 1];

    const renderTemplatesSection = () => {
        // Root view: All Templates & Blocks system bins
        if (currentNav.type === 'root') {
            return (
                <div className="grid grid-cols-1 gap-2">
                    <GraceLibBin
                        id="all-templates"
                        name={t('all_templates', 'All Templates')}
                        icon={Layers}
                        isActive={false}
                        onClick={() => pushTemplateNav({ id: 'all-templates', type: 'all', name: 'All Templates' })}
                        description={t('all_templates_desc', 'Browse all available templates')}
                    />
                    <GraceLibBin
                        id="blocks-bin"
                        name={t('blocks', 'Blocks')}
                        icon={Layout}
                        isActive={false}
                        onClick={() => pushTemplateNav({ id: 'blocks-bin', type: 'blocks', name: 'Blocks' })}
                        description={t('blocks_desc', 'Filter templates by block types')}
                    />
                </div>
            );
        }

        // All Templates view: List of template bins
        if (currentNav.type === 'all') {
            return (
                <div className="grid grid-cols-1 gap-2">
                    {allTemplates.map(tmpl => (
                        <GraceLibBin
                            key={tmpl.id}
                            id={tmpl.id}
                            name={isRu ? tmpl.nameRu : tmpl.name}
                            icon={Layers}
                            isActive={false}
                            onClick={() => pushTemplateNav({
                                id: tmpl.id,
                                type: 'template',
                                name: tmpl.name,
                                nameRu: tmpl.nameRu
                            })}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                if (tmpl.isUserCreated || devMode) {
                                    setContextMenu({
                                        x: e.clientX,
                                        y: e.clientY,
                                        item: { id: tmpl.id, name: tmpl.name, nameRu: tmpl.nameRu, type: 'template', isSystem: !tmpl.isUserCreated },
                                        type: 'template'
                                    });
                                }
                            }}
                            description={tmpl.isUserCreated ? t('user_template', 'User Template') : t('system_template', 'System Template')}
                        />
                    ))}
                </div>
            );
        }

        // Inside a Template bin: Slides + block bins if 2+ share a block
        if (currentNav.type === 'template') {
            const template = allTemplates.find(t => t.id === currentNav.id);
            if (!template) return null;

            const slides = template.templateSlides || [];
            // Group slides by blockId
            const groupedByBlock = slides.reduce((acc, s) => {
                const bId = s.categoryId || 'undefined';
                if (!acc[bId]) acc[bId] = [];
                acc[bId].push(s);
                return acc;
            }, {} as Record<string, ITemplateSlide[]>);

            const blockBins = Object.entries(groupedByBlock).filter(([bId, slds]) => bId !== 'undefined' && slds.length >= 2);
            const blockBinIds = new Set(blockBins.map(([bId]) => bId));

            // Slides not in any block bin
            const independentSlides = slides.filter(s => {
                const bId = s.categoryId || 'undefined';
                return !blockBinIds.has(bId);
            });

            return (
                <div className="space-y-4">
                    {blockBins.length > 0 && (
                        <div className="grid grid-cols-1 gap-2">
                            {blockBins.map(([bId, slds]) => {
                                const block = blocks.find(b => b.id === bId);
                                return (
                                    <GraceLibBin
                                        key={bId}
                                        id={bId}
                                        name={block ? (isRu ? block.nameRu : block.name) : bId}
                                        icon={ICON_MAP[block?.icon || ''] || Layout}
                                        isActive={false}
                                        onClick={() => pushTemplateNav({
                                            id: `${template.id}:${bId}`,
                                            type: 'block',
                                            name: block ? block.name : bId,
                                            nameRu: block ? block.nameRu : undefined
                                        })}
                                        count={slds.length}
                                    />
                                );
                            })}
                        </div>
                    )}
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                        {independentSlides.map((slide) => (
                            <TemplateItem
                                key={slide.id}
                                template={template}
                                layoutSlide={slide}
                                selectedBlock={blocks.find(b => b.id === (slide.categoryId || template.category))}
                                selectedSlide={selectedSlide}
                                lang={lang}
                                isRu={isRu}
                                activePresentationId={activePresentationId}
                                onClick={handleTemplateClick}
                                onOverride={(template.isUserCreated || devMode) ? handleOverrideTemplateSlide : undefined}
                                blocks={blocks}
                                t={t}
                            />
                        ))}
                        {/* Fallback to base template if no slides defined */}
                        {slides.length === 0 && (
                            <TemplateItem
                                template={template}
                                selectedBlock={blocks.find(b => b.id === template.category)}
                                selectedSlide={selectedSlide}
                                lang={lang}
                                isRu={isRu}
                                activePresentationId={activePresentationId}
                                onClick={handleTemplateClick}
                                onContextMenu={(e, t, s) => {
                                    e.preventDefault();
                                    if (template.isUserCreated || devMode) {
                                        setContextMenu({
                                            x: e.clientX,
                                            y: e.clientY,
                                            item: { templateId: t.id, slide: s },
                                            type: 'template-slide'
                                        });
                                    }
                                }}
                                blocks={blocks}
                                t={t}
                            />
                        )}
                    </div>
                </div>
            );
        }

        // Blocks view: List of block bins
        if (currentNav.type === 'blocks') {
            return (
                <div className="grid grid-cols-1 gap-2">
                    {blocks.map(block => {
                        // Count template slides across all templates for this block
                        const count = allTemplates.reduce((acc, tmpl) =>
                            acc + (tmpl.templateSlides?.filter(s => s.categoryId === block.id).length || 0), 0
                        );
                        return (
                            <GraceLibBin
                                key={block.id}
                                id={block.id}
                                name={isRu ? block.nameRu : block.name}
                                icon={ICON_MAP[block.icon] || Presentation}
                                isActive={false}
                                onClick={() => pushTemplateNav({
                                    id: block.id,
                                    type: 'block',
                                    name: block.name,
                                    nameRu: block.nameRu
                                })}
                                count={count}
                            />
                        );
                    })}
                </div>
            );
        }

        // Inside a Block bin (from Blocks view OR from Template view)
        if (currentNav.type === 'block') {
            const isFromTemplate = currentNav.id.includes(':');
            let blockId = currentNav.id;
            let targetTemplateId: string | undefined;

            if (isFromTemplate) {
                [targetTemplateId, blockId] = currentNav.id.split(':');
            }

            const activeBlock = blocks.find(b => b.id === blockId);

            // Collect all slides for this block
            const allSlidesForBlock: Array<{ template: ITemplate, slide: ITemplateSlide }> = [];
            allTemplates.forEach(tmpl => {
                if (targetTemplateId && tmpl.id !== targetTemplateId) return;
                tmpl.templateSlides?.forEach(s => {
                    if (s.categoryId === blockId) {
                        allSlidesForBlock.push({ template: tmpl, slide: s });
                    }
                });
            });

            // Group by template if not targetTemplateId
            if (!targetTemplateId) {
                const groupedByTemplate: Record<string, typeof allSlidesForBlock> = {};
                allSlidesForBlock.forEach(item => {
                    if (!groupedByTemplate[item.template.id]) groupedByTemplate[item.template.id] = [];
                    groupedByTemplate[item.template.id].push(item);
                });

                const templateBins = Object.entries(groupedByTemplate).filter(([tId, items]) => items.length >= 2);
                const templateBinIds = new Set(templateBins.map(([tId]) => tId));

                const independentItems = allSlidesForBlock.filter(item => !templateBinIds.has(item.template.id));

                return (
                    <div className="space-y-4">
                        {templateBins.length > 0 && (
                            <div className="grid grid-cols-1 gap-2">
                                {templateBins.map(([tId, items]) => (
                                    <GraceLibBin
                                        key={tId}
                                        id={tId}
                                        name={isRu ? items[0].template.nameRu : items[0].template.name}
                                        icon={Layers}
                                        isActive={false}
                                        onClick={() => pushTemplateNav({
                                            id: `${tId}:${blockId}`,
                                            type: 'block',
                                            name: items[0].template.name,
                                            nameRu: items[0].template.nameRu
                                        })}
                                        count={items.length}
                                    />
                                ))}
                            </div>
                        )}
                        <div className="grid grid-cols-1 @[280px]:grid-cols-2 @[420px]:grid-cols-3 gap-3">
                            {independentItems.map(({ template, slide }) => (
                                <TemplateItem
                                    key={slide.id}
                                    template={template}
                                    layoutSlide={slide}
                                    selectedBlock={activeBlock}
                                    selectedSlide={selectedSlide}
                                    lang={lang}
                                    isRu={isRu}
                                    activePresentationId={activePresentationId}
                                    onClick={handleTemplateClick}
                                    onOverride={(template.isUserCreated || devMode) ? handleOverrideTemplateSlide : undefined}
                                    onContextMenu={(e, t, s) => {
                                        e.preventDefault();
                                        if (template.isUserCreated || devMode) {
                                            setContextMenu({
                                                x: e.clientX,
                                                y: e.clientY,
                                                item: { templateId: t.id, slide: s },
                                                type: 'template-slide'
                                            });
                                        }
                                    }}
                                    onExport={() => GraceLibExportService.exportItem(template.id, 'template', template.name)}
                                    blocks={blocks}
                                    t={t}
                                />
                            ))}
                        </div>
                    </div>
                );
            } else {
                // We are inside a template-group within a block
                return (
                    <div className="grid grid-cols-1 @[280px]:grid-cols-2 @[420px]:grid-cols-3 gap-3">
                        {allSlidesForBlock.map(({ template, slide }) => (
                            <TemplateItem
                                key={slide.id}
                                template={template}
                                layoutSlide={slide}
                                selectedBlock={activeBlock}
                                selectedSlide={selectedSlide}
                                lang={lang}
                                isRu={isRu}
                                activePresentationId={activePresentationId}
                                onClick={handleTemplateClick}
                                onOverride={(template.isUserCreated || devMode) ? handleOverrideTemplateSlide : undefined}
                                onExport={() => GraceLibExportService.exportItem(template.id, 'template', template.name)}
                                blocks={blocks}
                                t={t}
                            />
                        ))}
                    </div>
                );
            }
        }

        return null;
    };

    const renderPresentationsSection = () => {
        return (
            <div
                className={cn(
                    "space-y-4 min-h-[400px] transition-colors rounded-2xl p-2",
                    isDragging && "bg-accent/10 border-2 border-dashed border-accent/40"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">{t('bins', 'Bins')}</span>
                    </div>
                    <button
                        onClick={() => {
                            openGlobalModal(ModalType.PROMPT, {
                                title: t('enter_bin_name', 'Enter bin name:'),
                                onSelection: (name: string | null) => {
                                    if (name) createPresentationBin(name);
                                }
                            });
                        }}
                        className="p-1 hover:bg-white/5 rounded-lg text-stone-500 hover:text-accent transition-all"
                    >
                        <FolderPlus className="w-4 h-4" />
                    </button>
                </div>

                <div className="grid grid-cols-1 @[280px]:grid-cols-2 @[420px]:grid-cols-3 gap-3">
                    {filteredBins.map(bin => (
                        <button
                            key={bin.id}
                            onClick={() => setPresentationBinNavPath([...presentationBinNavPath, bin.id])}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = 'move';
                            }}
                            onDrop={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                try {
                                    const dataStr = e.dataTransfer.getData('application/json');
                                    if (dataStr) {
                                        const data = JSON.parse(dataStr);
                                        if (data.source === 'presentation-library' && data.presentationId) {
                                            const pres = await db.presentationFiles.get(data.presentationId);
                                            if (pres) {
                                                if (pres.serviceId) {
                                                    const cloneId = crypto.randomUUID();
                                                    const clone = {
                                                        ...pres,
                                                        id: cloneId,
                                                        serviceId: undefined,
                                                        isMaster: false,
                                                        binId: bin.id,
                                                        createdAt: new Date(),
                                                        updatedAt: new Date()
                                                    };
                                                    await db.presentationFiles.add(clone);
                                                    toast.success(t('added_to_gracelib', 'Added presentation to bin'));
                                                } else {
                                                    await db.presentationFiles.update(data.presentationId, { binId: bin.id });
                                                    toast.success(t('moved_presentation', 'Moved presentation to bin'));
                                                }
                                            }
                                        }
                                    }
                                } catch (err) { }
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    item: bin,
                                    type: 'presentation-bin'
                                });
                            }}
                            className="bg-stone-900/60 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 group hover:border-accent/40 hover:bg-stone-800/80 transition-all aspect-video shadow-lg shadow-black/20"
                        >
                            <div className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform">
                                <Folder className="w-5 h-5 text-stone-400 group-hover:text-accent transition-colors" />
                            </div>
                            <span className="text-[10px] font-bold text-stone-400 group-hover:text-stone-200 uppercase tracking-tight truncate w-full px-2 text-center">
                                {bin.name}
                            </span>
                        </button>
                    ))}

                    {filteredPresentations.map(p => (
                        <button
                            key={p.id}
                            draggable
                            onDragStart={(e) => {
                                e.stopPropagation();
                                e.dataTransfer.setData('application/json', JSON.stringify({
                                    source: 'presentation-library',
                                    presentationId: p.id
                                }));
                                e.dataTransfer.effectAllowed = 'copyMove';
                            }}
                            onClick={() => {
                                openGlobalModal(ModalType.PRESENTATION_IMPORTER, { presentationId: p.id });
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    item: p,
                                    type: 'presentation'
                                });
                            }}
                            className="bg-stone-900/60 border border-white/5 rounded-2xl overflow-hidden group hover:border-accent/40 transition-all aspect-video shadow-lg shadow-black/20 relative"
                        >
                            {p.thumbnailUrl ? (
                                <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-stone-800/40">
                                    <Presentation className="w-6 h-6 text-stone-600 group-hover:text-accent/60 transition-colors" />
                                </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/80 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 p-2">
                                <span className="text-[10px] font-bold text-white uppercase tracking-tight truncate block mb-1">
                                    {p.name}
                                </span>
                                <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest block">
                                    {new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(new Date(p.updatedAt || p.createdAt))}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>

                {filteredBins.length === 0 && filteredPresentations.length === 0 && (
                    <div className="py-20 text-center opacity-30 flex flex-col items-center gap-3">
                        <Layers className="w-10 h-10" />
                        <p className="text-xs italic">{t('empty_library', 'Library is empty. Drag presentations here to upload.')}</p>
                    </div>
                )}
            </div>
        );
    };

    const renderMediaSection = () => {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">{t('media_bins', 'Media Bins')}</span>
                    <button
                        onClick={() => {
                            openGlobalModal(ModalType.PROMPT, {
                                title: t('enter_bin_name', 'Enter bin name:'),
                                onSelection: (name: string | null) => {
                                    if (name) addMediaBin(name);
                                }
                            });
                        }}
                        className="p-1 hover:bg-white/5 rounded-lg text-stone-500 hover:text-accent transition-all"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                    {graceLibMediaBins.map(bin => (
                        <div
                            key={bin.id}
                            className="group relative"
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    item: bin,
                                    type: 'media-bin'
                                });
                            }}
                        >
                            <GraceLibBin
                                id={bin.id}
                                name={bin.name}
                                icon={Music}
                                onClick={() => { }} // Could open bin content
                                count={bin.mediaIds.length}
                            />
                        </div>
                    ))}

                    {graceLibMediaBins.length === 0 && (
                        <div className="py-20 text-center opacity-30 flex flex-col items-center gap-3">
                            <Music className="w-10 h-10" />
                            <p className="text-xs italic">{t('configure_media_bins', 'Create bins to organize local media')}</p>
                        </div>
                    )}
                </div>

            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-stone-900/30 border-r border-white/5">
            {/* Header / Breadcrumbs */}
            <div className="p-4 border-b border-white/5 flex items-center gap-2 shrink-0 h-[60px] overflow-hidden">
                <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar scroll-smooth">
                    {graceLibSection === 'templates' && templateNavPath.map((nav, index) => (
                        <React.Fragment key={`${nav.id}-${index}`}>
                            {index > 0 && <ChevronRight className="w-3 h-3 text-stone-700 shrink-0" />}
                            <button
                                onClick={() => setTemplateNavPath(templateNavPath.slice(0, index + 1))}
                                className={cn(
                                    "text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors flex items-center gap-1.5",
                                    index === templateNavPath.length - 1
                                        ? "text-stone-300 pointer-events-none"
                                        : "text-stone-600 hover:text-accent cursor-pointer"
                                )}
                            >
                                {index === 0 && <LayoutTemplate className="w-3.5 h-3.5" />}
                                {isRu ? nav.nameRu || nav.name : nav.name}
                            </button>
                        </React.Fragment>
                    ))}

                    {graceLibSection === 'presentations' && (
                        <div className="flex items-center gap-1.5 min-w-0">
                            <button
                                onClick={() => setPresentationBinNavPath([])}
                                className={cn(
                                    "text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors flex items-center gap-1.5",
                                    presentationBinNavPath.length === 0 ? "text-stone-300" : "text-stone-600 hover:text-accent"
                                )}
                            >
                                <Presentation className="w-3.5 h-3.5" />
                                {t('grace_presentations', 'Grace Presentations')}
                            </button>
                            {presentationBinNavPath.map((binId, index) => {
                                const bin = presentationBins.find(b => b.id === binId);
                                if (!bin) return null;
                                return (
                                    <React.Fragment key={binId}>
                                        <ChevronRight className="w-3 h-3 text-stone-700 shrink-0" />
                                        <button
                                            onClick={() => setPresentationBinNavPath(presentationBinNavPath.slice(0, index + 1))}
                                            className={cn(
                                                "text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors",
                                                index === presentationBinNavPath.length - 1
                                                    ? "text-stone-300 pointer-events-none"
                                                    : "text-stone-600 hover:text-accent cursor-pointer"
                                            )}
                                        >
                                            {bin.name}
                                        </button>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    )}

                    {graceLibSection === 'media' && (
                        <h3 className="text-[9px] font-bold text-stone-300 uppercase tracking-widest flex items-center gap-2">
                            <Music className="w-3.5 h-3.5" />
                            {t('grace_media', 'Grace Media')}
                        </h3>
                    )}

                    {!graceLibSection && (
                        <h3 className="text-[9px] font-bold text-stone-300 uppercase tracking-widest flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5" />
                            {t('grace_lib', 'GraceLib')}
                        </h3>
                    )}
                </div>

                {/* Import Button */}
                <button
                    onClick={handleImportClick}
                    className="ml-auto flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent border border-accent/20 transition-all shrink-0 cursor-pointer shadow-lg outline-none"
                    title={t('import_files_desc', 'Import presentations, templates, or media')}
                >
                    <Download className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{t('import', 'Import')}</span>
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3">
                {!graceLibSection ? (
                    <div className="flex flex-col items-center justify-center h-full text-stone-600 gap-3 px-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-stone-800/50 flex items-center justify-center">
                            <Layers className="w-6 h-6 opacity-30" />
                        </div>
                        <p className="text-xs font-medium italic opacity-50">
                            {t('select_library_hint', 'Select a section in GraceLib to browse content')}
                        </p>
                    </div>
                ) : (
                    <>
                        {graceLibSection === 'templates' && renderTemplatesSection()}
                        {graceLibSection === 'presentations' && renderPresentationsSection()}
                        {graceLibSection === 'media' && renderMediaSection()}
                    </>
                )}
            </div>

            {/* Bottom: Presentation Selector Only */}
            <div className="shrink-0 p-3 border-t border-white/5 bg-stone-950/40 relative z-30">
                <PresentationSelector className="h-[60px]" />
            </div>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                >
                    {contextMenu.type === 'template' || contextMenu.type === 'media-bin' ? (
                        <>
                            <ContextMenuItem
                                icon={<Edit2 className="w-3 h-3" />}
                                label={t('rename', 'Rename')}
                                onClick={() => {
                                    openGlobalModal(ModalType.PROMPT, {
                                        title: t('rename_item', 'New name:'),
                                        defaultValue: isRu ? contextMenu.item.nameRu || contextMenu.item.name : contextMenu.item.name,
                                        onSelection: (newName: string | null) => {
                                            if (newName && newName !== (isRu ? contextMenu.item.nameRu : contextMenu.item.name)) {
                                                if (contextMenu.type === 'template') {
                                                    updateTemplate(contextMenu.item.id, isRu ? { nameRu: newName } : { name: newName }, devMode);
                                                } else if (contextMenu.type === 'presentation-bin') {
                                                    renamePresentationBin(contextMenu.item.id, newName);
                                                } else {
                                                    updateMediaBin(contextMenu.item.id, { name: newName });
                                                }
                                            }
                                        }
                                    });
                                    setContextMenu(null);
                                }}
                            />
                            <ContextMenuItem
                                icon={<Download className="w-3 h-3" />}
                                label={t('export', 'Export')}
                                onClick={() => {
                                    GraceLibExportService.exportItem(contextMenu.item.id, contextMenu.type === 'template' ? 'template' : 'presentation', contextMenu.item.name);
                                    setContextMenu(null);
                                }}
                            />
                            <div className="h-px bg-white/5 my-1 mx-2" />
                            <ContextMenuItem
                                icon={<Trash2 className="w-3 h-3" />}
                                label={t('delete', 'Delete')}
                                danger
                                onClick={() => {
                                    openGlobalModal(ModalType.CONFIRM, {
                                        title: t('confirm_delete', 'Confirm Delete'),
                                        message: t('confirm_remove_item', 'Remove this item?'),
                                        variant: 'danger',
                                        onSelection: (confirmed: boolean) => {
                                            if (confirmed) {
                                                if (contextMenu.type === 'template') {
                                                    removeTemplate(contextMenu.item.id, devMode).then(() => {
                                                        if (templateNavPath.some(path => path.id === contextMenu.item.id)) {
                                                            setTemplateNavPath(templateNavPath.filter(path => path.id !== contextMenu.item.id));
                                                        }
                                                    });
                                                } else if (contextMenu.type === 'presentation-bin') {
                                                    removePresentationBin(contextMenu.item.id).then(() => {
                                                        if (presentationBinNavPath.includes(contextMenu.item.id)) {
                                                            setPresentationBinNavPath(presentationBinNavPath.slice(0, presentationBinNavPath.indexOf(contextMenu.item.id)));
                                                        }
                                                    });
                                                } else {
                                                    removeMediaBin(contextMenu.item.id);
                                                }
                                            }
                                        }
                                    });
                                    setContextMenu(null);
                                }}
                            />
                        </>
                    ) : contextMenu.type === 'presentation' ? (
                        <>
                            <ContextMenuItem
                                icon={<Edit2 className="w-3 h-3" />}
                                label={t('rename', 'Rename')}
                                onClick={() => {
                                    openGlobalModal(ModalType.PROMPT, {
                                        title: t('rename_presentation', 'New name:'),
                                        defaultValue: contextMenu.item.name,
                                        onSelection: (newName: string | null) => {
                                            if (newName) {
                                                db.presentationFiles.update(contextMenu.item.id, { name: newName });
                                            }
                                        }
                                    });
                                    setContextMenu(null);
                                }}
                            />
                            <ContextMenuItem
                                icon={<Download className="w-3 h-3" />}
                                label={t('export', 'Export')}
                                onClick={() => {
                                    GraceLibExportService.exportItem(contextMenu.item.id, 'presentation', contextMenu.item.name);
                                    setContextMenu(null);
                                }}
                            />
                            <div className="h-px bg-white/5 my-1 mx-2" />
                            <ContextMenuItem
                                icon={<Trash2 className="w-3 h-3" />}
                                label={t('delete', 'Delete')}
                                danger
                                onClick={() => {
                                    openGlobalModal(ModalType.CONFIRM, {
                                        title: t('confirm_delete', 'Confirm Delete'),
                                        message: t('confirm_remove_presentation', 'Remove this presentation from library?'),
                                        variant: 'danger',
                                        onSelection: (confirmed: boolean) => {
                                            if (confirmed) {
                                                db.presentationFiles.delete(contextMenu.item.id);
                                            }
                                        }
                                    });
                                    setContextMenu(null);
                                }}
                            />
                        </>
                    ) : contextMenu.type === 'template-slide' ? (
                        <>
                            <ContextMenuItem
                                icon={<RefreshCw className="w-3 h-3" />}
                                label={t('override_template_slide', "Override template's slide")}
                                onClick={() => {
                                    if (contextMenu.item.slide) {
                                        handleOverrideTemplateSlide({ id: contextMenu.item.templateId } as any, contextMenu.item.slide.id);
                                    }
                                    setContextMenu(null);
                                }}
                            />
                            <div className="h-px bg-white/5 my-1 mx-2" />
                            <ContextMenuItem
                                icon={<Edit2 className="w-3 h-3" />}
                                label={t('rename_slide', 'Rename Slide')}
                                onClick={() => {
                                    if (contextMenu.item.slide) {
                                        const currentName = isRu ? contextMenu.item.slide.nameRu || contextMenu.item.slide.name : contextMenu.item.slide.name;
                                        openGlobalModal(ModalType.PROMPT, {
                                            title: t('rename_slide', 'Rename Slide:'),
                                            defaultValue: currentName,
                                            onSelection: (newName: string | null) => {
                                                if (newName && newName !== currentName) {
                                                    renameTemplateSlide(contextMenu.item.templateId, contextMenu.item.slide.id, newName, devMode);
                                                }
                                            }
                                        });
                                    }
                                    setContextMenu(null);
                                }}
                            />
                            <ContextMenuItem
                                icon={<Trash2 className="w-3 h-3" />}
                                label={t('delete_slide', 'Delete Slide')}
                                danger
                                onClick={() => {
                                    if (contextMenu.item.slide) {
                                        openGlobalModal(ModalType.CONFIRM, {
                                            title: t('confirm_delete_slide', 'Confirm Delete Slide'),
                                            message: t('confirm_remove_slide', 'Remove this slide from template?'),
                                            variant: 'danger',
                                            onSelection: (confirmed: boolean) => {
                                                if (confirmed) {
                                                    removeTemplateSlide(contextMenu.item.templateId, contextMenu.item.slide.id, devMode);
                                                }
                                            }
                                        });
                                    }
                                    setContextMenu(null);
                                }}
                            />
                        </>
                    ) : null}
                </ContextMenu>
            )}
        </div>
    );
};

export default PresentationLibrary;
