import React from 'react';
import { 
    DndContext, 
    closestCorners, 
    MeasuringStrategy,
    SensorDescriptor,
    SensorOptions,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
    DragMoveEvent
} from '@dnd-kit/core';
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
    sensors: SensorDescriptor<SensorOptions>[];
    handleDragStart: (event: DragStartEvent) => void;
    handleDragOver: (event: DragOverEvent) => void;
    handleDragEnd: (event: DragEndEvent) => Promise<void>;
    handleDragCancel: () => void;
    handleDragMove: (event: DragMoveEvent) => void;
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
    children?: React.ReactNode;
}

export const TimelineSlideTrack: React.FC<TimelineSlideTrackProps> = ({
    localSlides,
    visualTimeline,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    handleDragMove,
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
    children
}) => {
    return (
        <div className="flex-1 overflow-hidden relative">
            <TrackContainer ref={trackRef}>
                <div className="flex flex-col min-h-full">
                    {/* Lane 1: Slides */}
                    <div className="flex items-center px-8 py-4 min-w-full relative">
                        <TimelineDroppableZone 
                            onAddSlide={handleAddSlide} 
                            onAddPresentation={(pid, idx) => {
                                addPresentationToTimeline(pid, idx);
                                setNativeDropIndex(null);
                            }} 
                            visualTimeline={visualTimeline}
                            onNativeDragOver={setNativeDropIndex}
                        />
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCorners}
                            measuring={{
                                droppable: {
                                    strategy: MeasuringStrategy.Always,
                                },
                            }}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            onDragCancel={handleDragCancel}
                            onDragMove={handleDragMove}
                        >
                            <div className="flex items-center gap-3 relative">
                                <SortableContext
                                    items={localSlides.map(s => s.id)}
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
                                            onSelect={(id, e) => toggleSlideSelection(id, !!(e?.metaKey || e?.ctrlKey), e?.shiftKey)}
                                            onLive={setLiveSlide}
                                            onContextMenu={(e, id) => {
                                                e.preventDefault();
                                                setContextMenu({
                                                    x: e.clientX,
                                                    y: e.clientY,
                                                    slideId: id,
                                                    presentationId: activePresentationId
                                                });
                                            }}
                                            onToggleExpansion={toggleSlideExpansion}
                                            isSelected={selectedSlideIds.includes(slide.id)}
                                            isMultiSelect={selectedSlideIds.length > 1}
                                            isSubItemSelected={isSubItemSelected}
                                            isMultiDragHidden={!!dragActiveId && selectedSlideIds.length > 1 && selectedSlideIds.includes(slide.id) && slide.id !== dragActiveId}
                                            setContextMenu={setContextMenu}
                                        />
                                    ))}
                                </SortableContext>
                                {children}
                            </div>
                        </DndContext>
                    </div>
                </div>
            </TrackContainer>
        </div>
    );
};
