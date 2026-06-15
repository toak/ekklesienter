import React from 'react';
import { useTranslation } from 'react-i18next';
import { ITemplate, ITemplateSlide, IBlock } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { Layers } from 'lucide-react';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import { NavLevel } from '../../hooks/useTemplatePickerData';

interface TemplatePickerGridProps {
  currentView: NavLevel;
  templates: ITemplate[];
  blocksMap: Map<string, IBlock>;
  currentSlide: { templateId?: string; blockId: string } | undefined;
  currentBlock: IBlock | undefined;
  isRu: boolean;
  lang: string;
  pushNav: (level: NavLevel) => void;
  setContextMenu: (menu: { x: number; y: number; type: 'template' | 'block' | 'slide'; data: Record<string, unknown> } | null) => void;
  handleSelectTemplate: (...args: unknown[]) => void;
  searchQuery: string;
}

export const TemplatePickerGrid: React.FC<TemplatePickerGridProps> = ({
  currentView,
  templates,
  blocksMap,
  currentSlide,
  currentBlock,
  isRu,
  lang,
  pushNav,
  setContextMenu,
  handleSelectTemplate,
  searchQuery,
}) => {
  const { t } = useTranslation();

  // ─── ALL TEMPLATES VIEW ───
  if (currentView.type === 'all') {
    if (templates.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-2">
            <Layers className="w-8 h-8 text-stone-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('no_templates_found', 'No Templates Found')}</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-[200px]">{searchQuery ? t('try_different_search', 'Try adjusting your search query.') : t('click_save_as_template', 'Click "Save as Template" to create one.')}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3 gap-3">
        {templates.map((template) => {
          const isActive = currentSlide?.templateId === template.id;
          const totalSlides = (template.templateSlides?.length || 0) + (template.canvasItems ? 1 : 0);
          return (
            <div key={template.id} className="relative group">
              <button
                type="button"
                onClick={() => pushNav({ type: 'template', template })}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'template', data: { template } }); }}
                className={cn("w-full aspect-video rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden block text-left bg-stone-900", isActive ? "border-accent ring-2 ring-accent/20" : "border-white/5 hover:border-white/20", "hover:scale-[1.02]")}
              >
                <SlideContentRenderer template={template} block={currentBlock || blocksMap.get(template.category)} variables={{}} lang={lang} isPreview={true} scale={180 / 1920} canvasItems={template.canvasItems || []} showLockBadge={!template.isUserCreated} hideOverlays={true} />
                <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent px-2 py-1.5"><span className={cn("text-[8px] font-bold uppercase tracking-tight line-clamp-1", isActive ? "text-accent" : "text-white/70")}>{isRu ? template.nameRu : template.name}</span></div>
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/10 z-20"><Layers className="w-2.5 h-2.5 text-stone-300" /><span className="text-[8px] font-bold text-stone-300">{totalSlides}</span></div>
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── TEMPLATE VIEW (grouped by block) ───
  if (currentView.type === 'template') {
    const slidesByBlock = new Map<string, (ITemplateSlide | 'base')[]>();
    const baseBlockId = currentView.template.category || 'none';
    slidesByBlock.set(baseBlockId, ['base']);
    currentView.template.templateSlides?.forEach(s => {
      const bId = s.categoryId || baseBlockId;
      const list = slidesByBlock.get(bId) || []; list.push(s); slidesByBlock.set(bId, list);
    });
    const blockEntries = Array.from(slidesByBlock.entries()).filter(([_, slides]) => slides.length > 0);

    return (
      <div className="grid grid-cols-3 gap-3">
        {blockEntries.map(([bId, slides]) => {
          const block = blocksMap.get(bId);
          return (
            <div key={bId} className="relative group">
              <button
                type="button"
                onClick={() => pushNav({ type: 'block', template: currentView.template, blockId: bId })}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'block', data: { template: currentView.template, blockId: bId } }); }}
                className="w-full aspect-video rounded-xl border-2 border-white/5 hover:border-white/20 bg-stone-900 relative overflow-hidden transition-all hover:scale-[1.02] cursor-pointer"
              >
                <SlideContentRenderer template={currentView.template} block={block} variables={{}} lang={lang} isPreview={true} scale={180 / 1920} canvasItems={slides[0] === 'base' ? (currentView.template.canvasItems || []) : slides[0].canvasItems} backgroundOverride={slides[0] === 'base' ? undefined : slides[0].backgroundOverride} hideOverlays={true} />
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-[10px] font-black uppercase text-white tracking-widest px-3 py-1 bg-stone-900/80 rounded-full border border-white/10">{t('slides_count', { count: slides.length, defaultValue: '{{count}} slides' })}</span></div>
                <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent px-2.5 py-2 z-20"><span className="text-[9px] font-black uppercase tracking-wider text-white">{block ? (isRu ? block.nameRu : block.name) : t('unknown_category', 'Unknown Category')}</span></div>
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── BLOCK VIEW (individual slides) ───
  if (currentView.type === 'block') {
    const allInBlock: (ITemplateSlide | 'base')[] = [];
    if (currentView.template.category === currentView.blockId) allInBlock.push('base');
    (currentView.template.templateSlides || []).forEach(s => {
      if (s.categoryId === currentView.blockId || (!s.categoryId && currentView.template.category === currentView.blockId)) allInBlock.push(s);
    });

    return (
      <div className="grid grid-cols-3 gap-3">
        {allInBlock.map((s, idx) => (
          <div key={idx} className="relative group">
            <button
              type="button"
              onClick={() => handleSelectTemplate(currentView.template, s === 'base' ? undefined : s)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'slide', data: { template: currentView.template, slide: s } }); }}
              className="w-full aspect-video rounded-xl border-2 border-white/5 hover:border-white/20 bg-stone-900 relative overflow-hidden transition-all hover:scale-[1.02] cursor-pointer"
            >
              <SlideContentRenderer template={currentView.template} block={blocksMap.get(currentView.blockId)} variables={{}} lang={lang} isPreview={true} scale={180 / 1920} canvasItems={s === 'base' ? (currentView.template.canvasItems || []) : s.canvasItems} backgroundOverride={s === 'base' ? undefined : s.backgroundOverride} hideOverlays={true} />
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent px-2 py-1.5"><span className="text-[8px] font-bold uppercase tracking-tight line-clamp-1 text-white/70">{s === 'base' ? t('base_layout') : (isRu ? s.nameRu : s.name)}</span></div>
            </button>
          </div>
        ))}
      </div>
    );
  }

  return null;
};
