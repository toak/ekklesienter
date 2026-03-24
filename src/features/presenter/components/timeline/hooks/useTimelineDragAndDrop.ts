import { useState, useRef, useCallback } from 'react';
import { 
    PointerSensor, 
    useSensor, 
    useSensors, 
    DragStartEvent,
    DragMoveEvent, 
    DragOverEvent, 
    DragEndEvent 
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ISlide } from '@/core/types';
import { TrackContainerHandle } from '../TrackContainer';

interface UseTimelineDragAndDropProps {
    activePresentationId: string | null;
    slides: ISlide[];
    localSlides: ISlide[];
    setLocalSlides: (slides: ISlide[] | ((prev: ISlide[]) => ISlide[])) => void;
    selectedSlideIds: string[];
    trackRef: React.RefObject<TrackContainerHandle>;
    dragActiveRef: React.MutableRefObject<boolean>;
    pendingUpdateRef: React.MutableRefObject<boolean>;
    updatePresentationSlides: (id: string, slides: ISlide[]) => Promise<void>;
    addPresentationToTimeline: (pid: string, idx?: number) => Promise<void>;
}

/**
 * Hook to handle all drag-and-drop logic for the timeline, including auto-scroll.
 */
export const useTimelineDragAndDrop = ({
    activePresentationId,
    slides,
    localSlides,
    setLocalSlides,
    selectedSlideIds,
    trackRef,
    dragActiveRef,
    pendingUpdateRef,
    updatePresentationSlides,
    addPresentationToTimeline
}: UseTimelineDragAndDropProps) => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const scrollSpeedRef = useRef(0);
    const autoScrollRafRef = useRef<number | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const stopAutoScroll = useCallback(() => {
        if (autoScrollRafRef.current !== null) {
            cancelAnimationFrame(autoScrollRafRef.current);
            autoScrollRafRef.current = null;
        }
    }, []);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        dragActiveRef.current = true;
        setActiveId(event.active.id as string);
    }, [dragActiveRef]);

    const handleDragMove = useCallback((event: DragMoveEvent) => {
        const scrollEl = trackRef.current?.getScrollElement();
        if (!scrollEl) return;

        const rect = scrollEl.getBoundingClientRect();
        const pointerEvent = event.activatorEvent as PointerEvent;
        const startX = pointerEvent.clientX;
        const currentX = startX + event.delta.x;

        const EDGE_ZONE = 80;
        const MAX_SPEED = 14;

        const leftEdge = rect.left + EDGE_ZONE;
        const rightEdge = rect.right - EDGE_ZONE;

        let scrollSpeed = 0;

        if (currentX < leftEdge) {
            const depth = (leftEdge - currentX) / EDGE_ZONE;
            scrollSpeed = -Math.round(MAX_SPEED * Math.min(depth, 1));
        } else if (currentX > rightEdge) {
            const depth = (currentX - rightEdge) / EDGE_ZONE;
            scrollSpeed = Math.round(MAX_SPEED * Math.min(depth, 1));
        }

        scrollSpeedRef.current = scrollSpeed;

        if (scrollSpeed !== 0) {
            if (autoScrollRafRef.current === null) {
                const tick = () => {
                    if (!scrollEl || !dragActiveRef.current || scrollSpeedRef.current === 0) {
                        autoScrollRafRef.current = null;
                        return;
                    }
                    scrollEl.scrollLeft += scrollSpeedRef.current;
                    autoScrollRafRef.current = requestAnimationFrame(tick);
                };
                autoScrollRafRef.current = requestAnimationFrame(tick);
            }
        } else {
            stopAutoScroll();
        }
    }, [trackRef, dragActiveRef, stopAutoScroll]);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeIdStr = active.id as string;
        const overIdStr = over.id as string;

        if (overIdStr === 'presentation-item-drag') return;

        setLocalSlides((currentSlides) => {
            const oldIndex = currentSlides.findIndex(s => s.id === activeIdStr);
            const newIndex = currentSlides.findIndex(s => s.id === overIdStr);

            if (oldIndex === -1 || newIndex === -1) return currentSlides;

            const isPartOfSelection = selectedSlideIds.includes(activeIdStr);
            const draggedIds = isPartOfSelection ? selectedSlideIds : [activeIdStr];
            const validDraggedIds = draggedIds.filter(id => currentSlides.some(s => s.id === id));

            if (validDraggedIds.includes(overIdStr)) return currentSlides;

            if (validDraggedIds.length <= 1) {
                return arrayMove(currentSlides, oldIndex, newIndex);
            }

            const remaining = currentSlides.filter(s => !validDraggedIds.includes(s.id));
            const overIdxInRemaining = remaining.findIndex(s => s.id === overIdStr);
            
            if (overIdxInRemaining === -1) return currentSlides;

            const sortedDragged = [...validDraggedIds].sort((a, b) => {
                return currentSlides.findIndex(s => s.id === a) - currentSlides.findIndex(s => s.id === b);
            });

            const insertionIdx = oldIndex < newIndex ? overIdxInRemaining + 1 : overIdxInRemaining;
            
            return [
                ...remaining.slice(0, insertionIdx),
                ...sortedDragged.map(id => currentSlides.find(s => s.id === id)!),
                ...remaining.slice(insertionIdx)
            ];
        });
    }, [selectedSlideIds, setLocalSlides]);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        stopAutoScroll();
        dragActiveRef.current = false;
        setActiveId(null);
        const { active, over } = event;

        if (over && active.id === 'presentation-item-drag') {
            const presentationId = active.data.current?.presentationId;
            if (presentationId) {
                await addPresentationToTimeline(presentationId);
                return;
            }
        }

        if (over) {
            let finalSlidesOrdered: ISlide[] = [];
            
            setLocalSlides(current => {
                finalSlidesOrdered = current.map((s, i) => ({
                    ...s,
                    order: i,
                }));
                return finalSlidesOrdered;
            });

            if (activePresentationId && finalSlidesOrdered.length > 0) {
                pendingUpdateRef.current = true;
                updatePresentationSlides(activePresentationId, finalSlidesOrdered).finally(() => {
                    pendingUpdateRef.current = false;
                });
            }
        }
    }, [activePresentationId, addPresentationToTimeline, dragActiveRef, pendingUpdateRef, setLocalSlides, stopAutoScroll, updatePresentationSlides]);

    const handleDragCancel = useCallback(() => {
        stopAutoScroll();
        scrollSpeedRef.current = 0;
        dragActiveRef.current = false;
        setActiveId(null);
        setLocalSlides([...slides]);
    }, [dragActiveRef, setLocalSlides, slides, stopAutoScroll]);

    return {
        activeId,
        sensors,
        handleDragStart,
        handleDragMove,
        handleDragOver,
        handleDragEnd,
        handleDragCancel
    };
};
