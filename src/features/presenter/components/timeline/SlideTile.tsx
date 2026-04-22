import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown as ChevronDownIcon, RotateCcw } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ISlide, ICanvasSlide, INestedSlide, IBlock, ITemplate, IPresentationFile } from '@/core/types';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import SmartBadge from './SmartBadge';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useIntersection } from '@/core/hooks/useIntersection';
import type { DraggableSyntheticListeners, DraggableAttributes } from '@dnd-kit/core';

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
    listeners?: DraggableSyntheticListeners;
    attributes?: DraggableAttributes;
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
    listeners,
    attributes
}) => {
    const { t } = useTranslation();
    const { syncNestedPresentation, setCachedNestedPresentation, nestedPresentationsCache } = usePresentationStore();
    const containerRef = React.useRef<HTMLDivElement>(null);
    const isMaster = slide.blockId === 'master-presentation';
    const masterPresId = slide.type === 'normal' ? (slide as ICanvasSlide).masterPresentationId : (slide.type === 'nested' ? (slide as INestedSlide).presentationId : undefined);
    const isNestedActive = isMaster && navigationParentSlideId === slide.id;

    // Viewport-aware lazy loading
    const intersection = useIntersection(containerRef, {
        rootMargin: '200px', // Preload when approaching the viewport
        freezeOnceVisible: true // Once loaded, keep it (cached)
    });
    const isVisible = !!intersection?.isIntersecting;

    // Only fetch if it's a master slide, we're not inside it (which would be handled by the parent), 
    // and it's visible in the viewport.
    const shouldFetch = isMaster && masterPresId && isVisible;

    // Try to resolve from store cache first (instant)
    const cachedPres = masterPresId ? nestedPresentationsCache[masterPresId] : null;

    // Isolated lazy fetch for this specific master thumbnail
    const liveNestedPres = useLiveQuery(
        async () => {
            if (!shouldFetch || cachedPres) return null;
            const pres = await db.presentationFiles.get(masterPresId!);
            if (pres) {
                // Background update the store cache for other tiles of the same presentation
                setCachedNestedPresentation(masterPresId!, pres);
            }
            return pres;
        },
        [shouldFetch, masterPresId, cachedPres]
    );

    // Resolve final presentation (Priority: 1. Props Map (for expanded), 2. Local Query, 3. Cache)
    const nestedPres = (masterPresId ? presentationsMap.get(masterPresId) : null) || liveNestedPres || cachedPres;

    // Use current nested slide for preview if this master presentation is "active", 
    // or fallback to the first slide if we just want a representative thumbnail.
    const activeNestedSlide = isMaster && nestedPres 
        ? (isNestedActive 
            ? (nestedPres.slides.find(s => s.id === previewSlideId) || nestedPres.slides[0]) 
            : nestedPres.slides[0]) 
        : null;
    
    const displaySlide = activeNestedSlide || slide;
    const displayBlock = blocksMap.get(displaySlide.blockId);
    const displayTemplate = templatesMap.get(displaySlide.templateId);

    const isPreview = previewSlideId === slide.id && selectedPresentationId === activePresentationId;
    const isEffectivelyPreviewed = isPreview || isNestedActive;
    const isLive = liveSlideId === slide.id;

    const mediaId = displaySlide.type === 'video' ? (displaySlide as any).videoSettings?.mediaId : null;
    const mediaMetadata = useLiveQuery(async () => {
        if (!mediaId) return null;
        const item = await db.mediaPool.get(mediaId);
        if (item) return { name: item.name };
        const bg = await db.backgrounds.get(mediaId);
        if (bg) return { name: bg.name };
        return null;
    }, [mediaId]);

    return (
        <div
            ref={containerRef}
            data-slide-id={slide.id}
            {...listeners}
            {...attributes}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(slide.id, e);
            }}
            onDoubleClick={() => onLive(slide.id)}
            onContextMenu={(e) => onContextMenu(e, slide.id)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    // Prevent dnd-kit KeyboardSensor from capturing this
                    e.stopPropagation();
                }
            }}
            className={cn(
                "group relative shrink-0 w-32 aspect-video rounded-xl border-2 cursor-grab active:cursor-grabbing overflow-hidden leading-none transition-all duration-300 touch-none bg-stone-900",
                isSelected && isEffectivelyPreviewed && isMultiSelect && "ring-2 ring-accent ring-offset-2 ring-offset-stone-900 border-accent",
                isSelected && (!isEffectivelyPreviewed || !isMultiSelect) && "ring-2 ring-accent border-transparent",
                isMultiDragHidden && "opacity-0 pointer-events-none transition-opacity",
                !isSelected && isEffectivelyPreviewed && !isLive && !isSubItemSelected && "border-accent ring-2 ring-accent/20 scale-105 z-10 shadow-lg shadow-accent/10",
                !isSelected && isEffectivelyPreviewed && !isLive && isSubItemSelected && "border-stone-500/50 ring-1 ring-stone-500/10 scale-[1.02] z-10 shadow-md",
                isLive && !isEffectivelyPreviewed && "border-red-500 ring-2 ring-red-500/20 scale-105 z-10 shadow-lg shadow-red-500/10",
                isEffectivelyPreviewed && isLive && !isSubItemSelected && "border-emerald-500 ring-2 ring-emerald-500/30 scale-105 z-10 shadow-lg shadow-emerald-500/10",
                isEffectivelyPreviewed && isLive && isSubItemSelected && "border-emerald-500/50 ring-1 ring-emerald-500/10 scale-[1.02] z-10 shadow-md",
                !isEffectivelyPreviewed && !isLive && !isSelected && "border-white/5 hover:border-white/20",
                isMaster && !isEffectivelyPreviewed && !isLive && !isSelected && "border-orange-500/30"
            )}
        >
            <div 
                className="absolute top-0 left-0 w-[1920px] h-[1080px] z-0 pointer-events-none isolate origin-top-left"
                style={{ transform: `scale(${128 / 1920})` }}
            >
                {displaySlide && (
                    displaySlide.type === 'video' ? (
                        <div className="w-full h-full bg-stone-950 flex items-center justify-center relative">
                            {((displaySlide as any).videoSettings?.posterFrame) ? (
                                <img src={(displaySlide as any).videoSettings.posterFrame} className="w-full h-full object-cover" alt="Video poster" />
                            ) : (
                                <div className="w-[1920px] h-[1080px] flex items-center justify-center bg-stone-900 border border-white/5">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-700"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 3v18" /><path d="M17 3v18" /><path d="M3 7.5h4" /><path d="M3 12h18" /><path d="M3 16.5h4" /><path d="M17 7.5h4" /><path d="M17 16.5h4" /></svg>
                                </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                               <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="white" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-white/80 drop-shadow-xl"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                            </div>
                            {mediaMetadata?.name && (
                                <div className="absolute bottom-0 inset-x-0 h-[400px] bg-linear-to-t from-black/95 via-black/70 to-transparent flex items-end px-16 pb-32 z-10">
                                    <span className="text-[120px] font-black text-white truncate drop-shadow-2xl tracking-tighter uppercase font-mono leading-none">
                                        {mediaMetadata.name}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <SlideContentRenderer
                            template={displayTemplate}
                            block={displayBlock}
                            variables={displaySlide.type === 'normal' ? (displaySlide as ICanvasSlide).content?.variables : undefined}
                            lang={lang}
                            isPreview={true}
                            scale={1}
                            backgroundOverride={displaySlide.type === 'normal' ? (displaySlide as ICanvasSlide).backgroundOverride : undefined}
                            canvasItems={displaySlide.type === 'normal' ? (displaySlide as ICanvasSlide).content?.canvasItems : []}
                            slide={displaySlide}
                            slideId={displaySlide.id}
                        />
                    )
                )}
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
                className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/40 backdrop-blur-md border border-white/5 text-[8px] font-black text-stone-400 z-50 pointer-events-none"
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
            {isMaster && <div className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-orange-500/20 border border-orange-500/20 text-[6px] font-black text-orange-400 uppercase tracking-tighter z-20">{t('nested', 'Nested')}</div>}
            
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
