import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown as ChevronDownIcon, RotateCcw } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ISlide, ICanvasSlide, INestedSlide, IBlock, ITemplate, IPresentationFile } from '@/core/types';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import SmartBadge from './SmartBadge';

export interface SlideTileProps {
    slide: ISlide;
    index: number;
    activePresentationId: string;
    previewSlideId: string | null;
    selectedPresentationId: string | null;
    liveSlideId: string | null;
    blocksMap: Map<string, IBlock>;
    templatesMap: Map<string, ITemplate>;
    lang: string;
    onSelect: (id: string, e?: React.MouseEvent) => void;
    onLive: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    onToggleExpansion: (id: string) => void;
    isSelected?: boolean;
    isMultiSelect?: boolean;
    isSubItemSelected?: boolean;
    isMultiDragHidden?: boolean;
    presentationsMap: Map<string, IPresentationFile>;
    navigationParentSlideId: string | null;
    listeners?: any;
}

/**
 * SlideTile component for the presentation timeline.
 * Renders a thumbnail preview of a slide with status indicators and interaction handles.
 */
export const SlideTile: React.FC<SlideTileProps> = ({
    slide,
    index,
    activePresentationId,
    previewSlideId,
    selectedPresentationId,
    liveSlideId,
    blocksMap,
    templatesMap,
    lang,
    onSelect,
    onLive,
    onContextMenu,
    onToggleExpansion,
    isSelected,
    isMultiSelect,
    isSubItemSelected,
    isMultiDragHidden,
    presentationsMap,
    navigationParentSlideId,
    listeners
}) => {
    const { t } = useTranslation();
    const { syncNestedPresentation } = usePresentationStore();
    const isMaster = slide.blockId === 'master-presentation';
    const masterPresId = slide.type === 'normal' ? (slide as ICanvasSlide).masterPresentationId : (slide.type === 'nested' ? (slide as INestedSlide).presentationId : undefined);
    const nestedPres = isMaster && masterPresId ? presentationsMap.get(masterPresId) : null;
    const isNestedActive = isMaster && navigationParentSlideId === slide.id;

    // Use current nested slide for preview if this master presentation is "active"
    const activeNestedSlide = isNestedActive && nestedPres 
        ? (nestedPres.slides.find(s => s.id === previewSlideId) || nestedPres.slides[0]) 
        : null;
    
    // @ts-ignore - masterPresentationId is checked by type guard if needed, but here we just need types to match
    const displaySlide = activeNestedSlide || slide;
    const displayBlock = blocksMap.get(displaySlide.blockId);
    const displayTemplate = templatesMap.get(displaySlide.templateId);

    const isPreview = previewSlideId === slide.id && selectedPresentationId === activePresentationId;
    const isEffectivelyPreviewed = isPreview || isNestedActive;
    const isLive = liveSlideId === slide.id;

    return (
        <div
            data-slide-id={slide.id}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(slide.id, e);
            }}
            onDoubleClick={() => onLive(slide.id)}
            onContextMenu={(e) => onContextMenu(e, slide.id)}
            className={cn(
                "group relative shrink-0 w-32 aspect-video rounded-xl border-2 cursor-pointer overflow-hidden leading-none transition-all duration-300",
                isSelected && isEffectivelyPreviewed && isMultiSelect && "ring-2 ring-accent ring-offset-2 ring-offset-stone-900 border-accent",
                isSelected && (!isEffectivelyPreviewed || !isMultiSelect) && "ring-2 ring-accent border-transparent",
                isMultiDragHidden && "opacity-0 pointer-events-none transition-opacity",
                !isSelected && isEffectivelyPreviewed && !isLive && !isSubItemSelected && "border-accent ring-2 ring-accent/20 scale-105 z-10 shadow-lg shadow-accent/10",
                !isSelected && isEffectivelyPreviewed && !isLive && isSubItemSelected && "border-stone-500/50 ring-1 ring-stone-500/10 scale-[1.02] z-10 shadow-md",
                isLive && !isEffectivelyPreviewed && "border-red-500 ring-2 ring-red-500/20 scale-105 z-10 shadow-lg shadow-red-500/10",
                isEffectivelyPreviewed && isLive && !isSubItemSelected && "border-emerald-500 ring-2 ring-emerald-500/30 scale-105 z-10 shadow-lg shadow-emerald-500/10",
                isEffectivelyPreviewed && isLive && isSubItemSelected && "border-emerald-500/50 ring-1 ring-emerald-500/10 scale-[1.02] z-10 shadow-md",
                !isEffectivelyPreviewed && !isLive && !isSelected && "border-white/5 hover:border-white/20 bg-stone-900",
                isMaster && !isEffectivelyPreviewed && !isLive && !isSelected && "border-orange-500/30"
            )}
        >
            <div className="absolute inset-0 z-0 pointer-events-none isolate">
                <SlideContentRenderer
                    template={displayTemplate}
                    block={displayBlock}
                    variables={displaySlide.type === 'normal' ? (displaySlide as ICanvasSlide).content?.variables : undefined}
                    lang={lang}
                    isPreview={true}
                    scale={128 / 1920}
                    backgroundOverride={displaySlide.type === 'normal' ? (displaySlide as ICanvasSlide).backgroundOverride : undefined}
                    canvasItems={displaySlide.type === 'normal' ? (displaySlide as ICanvasSlide).content?.canvasItems : []}
                    slide={displaySlide}
                    slideId={displaySlide.id}
                />
            </div>
            <div className="absolute inset-x-0 top-0 h-8 bg-linear-to-b from-black/60 to-transparent z-10 pointer-events-none" />
            <div className="absolute z-20"><SmartBadge slide={slide} /></div>
            {isMaster && (
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleExpansion(slide.id); }}
                    className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-orange-500/30 text-white/60 hover:text-orange-400 rounded-md transition-all border border-white/10 z-20 cursor-pointer"
                >
                    {slide.isExpanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
            )}
            <div 
                {...listeners}
                className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/40 backdrop-blur-md border border-white/5 text-[8px] font-black text-stone-400 z-20 cursor-grab active:cursor-grabbing hover:bg-black/60 transition-colors"
                title={t('drag_to_reorder', 'Drag to reorder')}
            >
                {slide.order + 1}
            </div>
            
            {/* Nested Progress Badge */}
            {isNestedActive && nestedPres && (
                <div className="absolute top-1 left-7 px-1.5 py-0.5 rounded-md bg-accent border border-accent/50 text-[8px] font-black text-white z-30 shadow-lg animate-in fade-in slide-in-from-left-2 duration-300">
                    {nestedPres.slides.findIndex(s => s.id === previewSlideId) + 1} / {nestedPres.slides.length}
                </div>
            )}

            {isLive && <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-red-500/30 backdrop-blur-md border border-red-500/30 text-[7px] font-black text-red-300 uppercase tracking-wider animate-pulse z-20">LIVE</div>}
            {isMaster && <div className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-orange-500/20 border border-orange-500/20 text-[6px] font-black text-orange-400 uppercase tracking-tighter z-20">Master</div>}
            
            {/* Sync Badge */}
            {(() => {
                const canvasSlide = slide.type === 'normal' ? slide as ICanvasSlide : null;
                const nestedSlide = slide.type === 'nested' ? slide as INestedSlide : null;
                const linkedId = nestedSlide?.presentationId || canvasSlide?.linkedPresentationId;
                const lastSynced = canvasSlide?.lastSyncedAt;

                if (!isMaster || !linkedId || !lastSynced) return null;
                const libraryOriginal = presentationsMap.get(linkedId);
                if (!libraryOriginal) return null;

                const isOutOfSync = libraryOriginal.updatedAt && lastSynced && new Date(libraryOriginal.updatedAt) > new Date(lastSynced);
                if (!isOutOfSync) return null;

                return (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            syncNestedPresentation(slide.id);
                        }}
                        className="absolute bottom-1 right-1 px-2 py-0.5 rounded bg-blue-500 hover:bg-blue-400 border border-blue-400/50 text-[7px] font-black text-white uppercase tracking-wider z-30 shadow-lg shadow-blue-500/20 animate-in fade-in zoom-in-50 duration-300 flex items-center gap-1 cursor-pointer"
                        title={t('sync_library_update', 'Sync Library Update')}
                    >
                        <RotateCcw className="w-2.5 h-2.5" />
                        {t('sync', 'Sync')}
                    </button>
                );
            })()}
        </div>
    );
};
