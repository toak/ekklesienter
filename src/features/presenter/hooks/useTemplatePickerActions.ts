import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '@/core/db';
import { ITemplate, ITemplateSlide, ISlide, ICanvasSlide, ICanvasItem, IBlock } from '@/core/types';
import { EktmpService } from '@/features/presenter/services/ektmpService';
import { toast } from '@/core/utils/toast';

// ────────────────────────────────────────────────────────────────────────────
// Confirm Dialog State
// ────────────────────────────────────────────────────────────────────────────
export interface ConfirmState {
  open: boolean;
  kind: 'slide' | 'group' | 'template' | 'block';
  title: string;
  description: string;
  template?: ITemplate;
  slide?: ITemplateSlide | 'base';
  blockId?: string;
  block?: IBlock;
  migrationTargetId?: string;
  onConfirmOverride?: () => Promise<void>;
}

export const EMPTY_CONFIRM: ConfirmState = { open: false, kind: 'slide', title: '', description: '' };

interface UseTemplatePickerActionsParams {
  isDev: boolean;
  allTemplates: ITemplate[];
  allBlocks: IBlock[];
  blocksMap: Map<string, IBlock>;
  currentSlide: ISlide | undefined;
  currentBlock: IBlock | undefined;
  refreshNavTemplate: (t: ITemplate) => void;
  pushNav: (level: { type: 'template'; template: ITemplate }) => void;
  popNav: () => void;
  currentView: { type: string; template?: ITemplate };
}

/**
 * Hook for all template picker CRUD actions.
 */
export function useTemplatePickerActions({
  isDev,
  allTemplates,
  allBlocks,
  blocksMap,
  currentSlide,
  currentBlock,
  refreshNavTemplate,
  pushNav,
  popNav,
  currentView,
}: UseTemplatePickerActionsParams) {
  const { t, i18n } = useTranslation();
  const isRu = (i18n.language?.substring(0, 2) || 'en') === 'ru';

  // ─── Naming states ───
  const [isNamingTemplate, setIsNamingTemplate] = useState(false);
  const [namingTargetTemplate, setNamingTargetTemplate] = useState<ITemplate | null>(null);
  const [newName, setNewName] = useState('');
  const [newNameRu, setNewNameRu] = useState('');
  const [targetBlockId, setTargetBlockId] = useState<string | undefined>(undefined);

  // ─── Context Menu State ───
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'template' | 'block' | 'slide'; data: Record<string, unknown> } | null>(null);

  // ─── Confirm Dialog State ───
  const [confirmState, setConfirmState] = useState<ConfirmState>(EMPTY_CONFIRM);

  // ─── Edit Property State ───
  const [editingTemplate, setEditingTemplate] = useState<ITemplate | null>(null);
  const [editingLayout, setEditingLayout] = useState<{ template: ITemplate; slide: ITemplateSlide } | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameRu, setEditNameRu] = useState('');
  const [editId, setEditId] = useState('');
  const [editBackgroundColor, setEditBackgroundColor] = useState('#000000');
  const [editCategoryId, setEditCategoryId] = useState<string | undefined>(undefined);
  const [editParentTemplateId, setEditParentTemplateId] = useState<string | undefined>(undefined);

  // ─── Move Bunch State ───
  const [movingBunch, setMovingBunch] = useState<{ template: ITemplate; sourceBlockId: string } | null>(null);

  // ─── Block Manager State ───
  const [showBlockManager, setShowBlockManager] = useState(false);
  const [editingBlock, setEditingBlock] = useState<IBlock | null>(null);
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [blockFormName, setBlockFormName] = useState('');
  const [blockFormNameRu, setBlockFormNameRu] = useState('');
  const [blockFormColor, setBlockFormColor] = useState('#6366f1');
  const [blockFormIcon, setBlockFormIcon] = useState('📄');

  // ────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ────────────────────────────────────────────────────────────────────────

  /** Select a template and insert slide into presentation */
  const handleSelectTemplate = async (
    template: ITemplate,
    nestedSlide: ITemplateSlide | undefined,
    activePresentationId: string,
    presentation: { slides: ISlide[] },
    slideId: string,
    updatePresentationSlides: (id: string, slides: ISlide[]) => Promise<void>,
    setPreviewSlide: (id: string, presId: string) => void,
    closeModal: (type: string) => void,
    modalType: string
  ) => {
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
    closeModal(modalType);
  };

  /** Duplicate a template */
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

  /** Export a template as .ektmp */
  const handleExportTemplate = async (template: ITemplate) => {
    try {
      await EktmpService.saveAsEktmpFile(template.id);
      const fileBlob = await EktmpService.pack(template.id);
      if (!fileBlob) throw new Error('File not found');

      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.id}.ektmp`;
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

  /** Open "Save as Template" naming overlay */
  const handleSaveAsTemplate = () => {
    if (!currentSlide || !currentBlock) return;
    setNewName('New Template');
    setNewNameRu('Новый шаблон');
    setTargetBlockId(undefined);
    setIsNamingTemplate(true);
    setNamingTargetTemplate(null);
  };

  /** Confirm saving a new template or layout */
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

  /** Add a slide to a template (with block/category prompt) */
  const handleAddSlideToTemplate = (e: React.MouseEvent | null, template: ITemplate, bId?: string) => {
    if (e) e.stopPropagation();
    if (!currentSlide || (!isDev && !template.isUserCreated)) return;

    const slideBlockId = currentSlide.blockId;
    const tBlockId = bId || template.category;
    const hasSlideInBlock = template.category === slideBlockId ||
      (template.templateSlides?.some(s => s.categoryId === slideBlockId));

    const initNaming = () => {
      setNewName('New Layout');
      setNewNameRu('Новый вариант');
      setNamingTargetTemplate(template);
      setTargetBlockId(tBlockId);
      setIsNamingTemplate(true);
    };

    if (!hasSlideInBlock && slideBlockId !== tBlockId) {
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

  /** Update template properties (name, category, background, ID) */
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
      await db.templates.delete(oldId);
      await EktmpService.deleteFromFilesystem(oldId);
    }

    await db.templates.put(updatedTemplate);
    refreshNavTemplate(updatedTemplate);
    await EktmpService.saveAsEktmpFile(updatedTemplate.id);
    setEditingTemplate(null);
    toast.success(t('edit_properties'));
  };

  /** Update layout properties (name, category, optional parent move) */
  const handleUpdateLayoutProperties = async () => {
    if (!editingLayout || !editName) return;
    const { template, slide } = editingLayout;

    if (editParentTemplateId && editParentTemplateId !== template.id) {
      const targetTemplate = allTemplates.find(t => t.id === editParentTemplateId);
      if (targetTemplate) {
        const movedSlide: ITemplateSlide = { ...slide, name: editName, nameRu: editNameRu || editName, categoryId: editCategoryId };
        const updatedSource: ITemplate = { ...template, templateSlides: template.templateSlides?.filter((ts: ITemplateSlide) => ts.id !== slide.id) };
        await db.templates.put(updatedSource);
        refreshNavTemplate(updatedSource);
        await EktmpService.saveAsEktmpFile(updatedSource.id);
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

  /** Move slides from one block to another */
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

  /** Update slide content from current slide */
  const handleUpdateSlideContent = async (template: ITemplate, s: ITemplateSlide | 'base') => {
    if (!currentSlide) return;
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

  // ─── Delete Handlers ───

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
    if (currentView.type === 'template' && currentView.template?.id === template.id) popNav();
    setConfirmState(EMPTY_CONFIRM);
    toast.success(t('template_deleted'));
  };

  // ─── Block Manager ───

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

  // ─── Confirm Dispatch ───
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

  return {
    // Naming
    isNamingTemplate, setIsNamingTemplate,
    namingTargetTemplate, setNamingTargetTemplate,
    newName, setNewName,
    newNameRu, setNewNameRu,
    targetBlockId, setTargetBlockId,
    // Context Menu
    contextMenu, setContextMenu,
    // Confirm
    confirmState, setConfirmState,
    // Edit Properties
    editingTemplate, setEditingTemplate,
    editingLayout, setEditingLayout,
    editName, setEditName,
    editNameRu, setEditNameRu,
    editId, setEditId,
    editBackgroundColor, setEditBackgroundColor,
    editCategoryId, setEditCategoryId,
    editParentTemplateId, setEditParentTemplateId,
    // Move
    movingBunch, setMovingBunch,
    // Block Manager
    showBlockManager, setShowBlockManager,
    editingBlock, setEditingBlock,
    isAddingBlock, setIsAddingBlock,
    blockFormName, setBlockFormName,
    blockFormNameRu, setBlockFormNameRu,
    blockFormColor, setBlockFormColor,
    blockFormIcon, setBlockFormIcon,
    // Handlers
    handleSelectTemplate,
    handleDuplicateTemplate,
    handleExportTemplate,
    handleSaveAsTemplate,
    confirmSaveTemplate,
    handleAddSlideToTemplate,
    handleUpdateTemplateProperties,
    handleUpdateLayoutProperties,
    handleMoveBunch,
    handleUpdateSlideContent,
    requestDeleteSlide,
    requestDeleteBlockBunch,
    requestDeleteTemplate,
    openBlockForm,
    saveBlock,
    requestDeleteBlock,
    handleConfirm,
  };
}
