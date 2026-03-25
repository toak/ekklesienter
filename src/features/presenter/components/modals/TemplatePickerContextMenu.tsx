import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Copy, Download, Trash2, Plus, ArrowRight, RefreshCw } from 'lucide-react';
import { ITemplate, ITemplateSlide } from '@/core/types';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';

interface TemplatePickerContextMenuProps {
  isDev: boolean;
  contextMenu: { x: number; y: number; type: 'template' | 'block' | 'slide'; data: Record<string, unknown> } | null;
  setContextMenu: (v: null) => void;
  // Template actions
  setEditingTemplate: (v: ITemplate) => void;
  setEditName: (v: string) => void;
  setEditNameRu: (v: string) => void;
  setEditId: (v: string) => void;
  setEditCategoryId: (v: string | undefined) => void;
  setEditBackgroundColor: (v: string) => void;
  handleDuplicateTemplate: (t: ITemplate) => void;
  handleExportTemplate: (t: ITemplate) => void;
  requestDeleteTemplate: (t: ITemplate) => void;
  // Block actions
  handleAddSlideToTemplate: (e: null, t: ITemplate, bId: string) => void;
  setMovingBunch: (v: { template: ITemplate; sourceBlockId: string }) => void;
  requestDeleteBlockBunch: (t: ITemplate, bId: string) => void;
  // Slide actions
  handleUpdateSlideContent: (t: ITemplate, s: ITemplateSlide | 'base') => void;
  setEditingLayout: (v: { template: ITemplate; slide: ITemplateSlide }) => void;
  setEditParentTemplateId: (v: undefined) => void;
  requestDeleteSlide: (t: ITemplate, s: ITemplateSlide | 'base') => void;
}

export const TemplatePickerContextMenu: React.FC<TemplatePickerContextMenuProps> = ({
  isDev,
  contextMenu,
  setContextMenu,
  setEditingTemplate,
  setEditName,
  setEditNameRu,
  setEditId,
  setEditCategoryId,
  setEditBackgroundColor,
  handleDuplicateTemplate,
  handleExportTemplate,
  requestDeleteTemplate,
  handleAddSlideToTemplate,
  setMovingBunch,
  requestDeleteBlockBunch,
  handleUpdateSlideContent,
  setEditingLayout,
  setEditParentTemplateId,
  requestDeleteSlide,
}) => {
  const { t } = useTranslation();

  if (!contextMenu) return null;

  return (
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
  );
};
