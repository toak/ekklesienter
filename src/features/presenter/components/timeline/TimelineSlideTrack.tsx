import React from 'react';
import { 
    SortableContext, 
    horizontalListSortingStrategy 
} from '@dnd-kit/sortable';
import { ISlide, IBlock, ITemplate, IPresentationFile } from '@/core/types';
import { TimelineDroppableZone } from './TimelineDroppableZone';
import { SortableSlideBlock } from './SortableSlideBlock';
import { TimelineItem } from './hooks/useTimelineLayout';
import TrackContainer, { TrackContainerHandle } from './TrackContainer';

interface TimelineSlideTrackProps {
    localSlides: ISlide[];
    visualTimeline: TimelineItem[];
    // Handlers (DndContext now in parent)
    handleDragStart: (event: any) => void;
    handleDragOver: (event: any) => void;
    handleDragEnd: (event: any) => Promise<void>;
    handleDragCancel: () => void;
    handleAddSlide: (blockId: string, e?: React.MouseEvent) => void;
    addPresentationToTimeline: (pid: string, idx?: number) => Promise<void>;
    setNativeDropIndex: (idx: number | null) => void;
    trackRef: React.RefObject<TrackContainerHandle>;
    activePresentationId: string;
    previewSlideId: string | null;
    liveSlideId: string | null;
    selectedSlideIds: string[];
    selectedPresentationId: string | null;
    isDetached: boolean;
    templatesMap: Map<string, ITemplate>;
    blocksMap: Map<string, IBlock>;
    presentationsMap: Map<string, IPresentationFile>;
    navigationParentSlideId: string | null;
    lang: string;
    setPreviewSlide: (id: string, pid?: string) => void;
    setLiveSlide: (id: string) => void;
    toggleSlideSelection: (id: string, multi: boolean, range?: boolean) => void;
    toggleSlideExpansion: (id: string) => void;
    setContextMenu: (menu: any) => void;
    isSubItemSelected: boolean;
    dragActiveId: string | null;
    audioTrack?: React.ReactNode;
    children?: React.ReactNode;
}

/**
 * TimelineSlideTrack - Pure layout component for the slide track.
 * The DndContext and DragOverlay are managed by the parent SlideTimeline.
 */
export const TimelineSlideTrack: React.FC<TimelineSlideTrackProps> = ({
    localSlides,
    visualTimeline,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    handleAddSlide,
    addPresentationToTimeline,
    setNativeDropIndex,
    trackRef,
    activePresentationId,
    previewSlideId,
    liveSlideId,
    selectedSlideIds,
    selectedPresentationId,
    isDetached,
    templatesMap,
    blocksMap,
    presentationsMap,
    navigationParentSlideId,
    lang,
    setPreviewSlide,
    setLiveSlide,
    toggleSlideSelection,
    toggleSlideExpansion,
    setContextMenu,
    isSubItemSelected,
    dragActiveId,
    audioTrack,
    children
}) => {
    const handleSelect = React.useCallback((id: string, e?: React.MouseEvent) => {
        toggleSlideSelection(id, !!(e?.metaKey || e?.ctrlKey), e?.shiftKey);
    }, [toggleSlideSelection]);

    const handleContextMenu = React.useCallback((e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            slideId: id,
            presentationId: activePresentationId
        });
    }, [setContextMenu, activePresentationId]);

    const handleAddPresentation = React.useCallback((pid: string, idx?: number) => {
        addPresentationToTimeline(pid, idx);
        setNativeDropIndex(null);
    }, [addPresentationToTimeline, setNativeDropIndex]);

    const sortableIds = React.useMemo(() => localSlides.map(s => s.id), [localSlides]);

    return (
        <div className="flex-1 overflow-hidden relative">
            <TrackContainer ref={trackRef}>
                <div className="flex flex-col min-h-full min-w-full">
                    {/* Lane 1: Slides */}
                    <div className="flex-1 flex items-center px-8 py-4 min-w-full relative">
                        <TimelineDroppableZone 
                            disabled={!!dragActiveId && dragActiveId !== 'presentation-item-drag'}
                            onAddSlide={handleAddSlide} 
                            onAddPresentation={handleAddPresentation} 
                            visualTimeline={visualTimeline}
                            onNativeDragOver={setNativeDropIndex}
                        />
                        
                        <div className="flex items-center gap-3 relative z-10">
                            <SortableContext
                                items={sortableIds}
                                strategy={horizontalListSortingStrategy}
                            >
                                {localSlides.map((slide, index) => (
                                    <SortableSlideBlock
                                        key={slide.id}
                                        slide={slide}
                                        index={index}
                                        activePresentationId={activePresentationId}
                                        previewSlideId={previewSlideId}
                                        selectedPresentationId={selectedPresentationId}
                                        liveSlideId={liveSlideId}
                                        blocksMap={blocksMap}
                                        templatesMap={templatesMap}
                                        presentationsMap={presentationsMap}
                                        navigationParentSlideId={navigationParentSlideId}
                                        lang={lang}
                                        onSelect={handleSelect}
                                        onLive={setLiveSlide}
                                        onContextMenu={handleContextMenu}
                                        onToggleExpansion={toggleSlideExpansion}
                                        isSelected={selectedSlideIds.includes(slide.id)}
                                        isMultiSelect={selectedSlideIds.length > 1}
                                        isSubItemSelected={isSubItemSelected}
                                        isMultiDragHidden={!!dragActiveId && selectedSlideIds.length > 1 && selectedSlideIds.includes(slide.id) && slide.id !== dragActiveId}
                                        setContextMenu={setContextMenu}
                                    />
                                ))}
                            </SortableContext>
                            
                            {/* DragOverlay is now in SlideTimeline */}
                            {children}
                        </div>
                    </div>

                    {/* Lane 2: Audio */}
                    {audioTrack && (
                        <div className="shrink-0 h-[98px] border-t border-white/5 bg-stone-950/20 relative min-w-full px-8 pt-[10px] pb-4">
                            {audioTrack}
                        </div>
                    )}
                </div>
            </TrackContainer>
        </div>
    );
};
