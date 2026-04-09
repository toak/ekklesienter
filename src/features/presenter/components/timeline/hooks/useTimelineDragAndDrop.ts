import { useState, useRef, useCallback, useEffect } from 'react';
import { 
    PointerSensor,
    KeyboardSensor,
    useSensor, 
    useSensors, 
    DragStartEvent,
    DragOverEvent, 
    DragEndEvent 
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
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
 * Uses PointerSensor for reliability in Electron/Mac environments.
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
    
    // Safety: track current localSlides in a ref to bypass stale closure issues and React 18 async setState pitfalls during handles
    const localSlidesRef = useRef(localSlides);
    useEffect(() => {
        localSlidesRef.current = localSlides;
    }, [localSlides]);

    
    // Auto-scroll state
    const autoScrollRafRef = useRef<number | null>(null);
    const pointerXRef = useRef<number | null>(null);

    /** Tracks the last over-id to skip redundant setLocalSlides when collision hasn't changed */
    const lastOverIdRef = useRef<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Track real physical pointer position regardless of scroll or dnd-kit delta
    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            pointerXRef.current = e.clientX;
        };
        window.addEventListener('pointermove', handlePointerMove);
        return () => window.removeEventListener('pointermove', handlePointerMove);
    }, []);

    const stopAutoScroll = useCallback(() => {
        if (autoScrollRafRef.current !== null) {
            cancelAnimationFrame(autoScrollRafRef.current);
            autoScrollRafRef.current = null;
        }
    }, []);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        dragActiveRef.current = true;
        lastOverIdRef.current = null;
        setActiveId(event.active.id as string);

        // Start continuous auto-scroll loop
        if (autoScrollRafRef.current === null) {
            const tick = () => {
                if (!dragActiveRef.current) {
                    autoScrollRafRef.current = null;
                    return;
                }

                const scrollEl = trackRef.current?.getScrollElement();
                const pointerX = pointerXRef.current;
                
                if (scrollEl && pointerX !== null) {
                    const rect = scrollEl.getBoundingClientRect();
                    const EDGE_ZONE = 80;
                    const MAX_SPEED = 14;

                    const leftEdge = rect.left + EDGE_ZONE;
                    const rightEdge = rect.right - EDGE_ZONE;

                    let scrollSpeed = 0;

                    if (pointerX < leftEdge && scrollEl.scrollLeft > 0) {
                        const depth = Math.min((leftEdge - pointerX) / EDGE_ZONE, 1);
                        scrollSpeed = -Math.round(MAX_SPEED * depth);
                    } else if (pointerX > rightEdge && scrollEl.scrollLeft < scrollEl.scrollWidth - scrollEl.clientWidth) {
                        const depth = Math.min((pointerX - rightEdge) / EDGE_ZONE, 1);
                        scrollSpeed = Math.round(MAX_SPEED * depth);
                    }

                    if (scrollSpeed !== 0) {
                        const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
                        scrollEl.scrollLeft = Math.max(0, Math.min(maxScroll, scrollEl.scrollLeft + scrollSpeed));
                    }
                }
                
                // Keep ticking until drag ends
                autoScrollRafRef.current = requestAnimationFrame(tick);
            };
            autoScrollRafRef.current = requestAnimationFrame(tick);
        }
    }, [dragActiveRef, trackRef]);

    /**
     * Reorder slides when dragging over a different item.
     * Uses lastOverIdRef to skip redundant state updates when the collision target
     * hasn't changed, preventing unnecessary React re-render cascades.
     */
    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeIdStr = active.id as string;
        const overIdStr = over.id as string;

        if (overIdStr === 'presentation-item-drag' || overIdStr === 'timeline-droppable') return;

        // Skip if we already processed this collision pair
        if (lastOverIdRef.current === overIdStr) return;
        lastOverIdRef.current = overIdStr;

        setLocalSlides((currentSlides) => {
            const oldIndex = currentSlides.findIndex(s => s.id === activeIdStr);
            const newIndex = currentSlides.findIndex(s => s.id === overIdStr);

            if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return currentSlides;

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
        lastOverIdRef.current = null;
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
            const finalSlidesOrdered = localSlidesRef.current.map((s, i) => ({
                ...s,
                order: i,
            }));

            // Sync visual state immediately
            setLocalSlides(finalSlidesOrdered);

            // Persist to store / DB
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
        dragActiveRef.current = false;
        lastOverIdRef.current = null;
        setActiveId(null);
        setLocalSlides([...slides]);
    }, [dragActiveRef, setLocalSlides, slides, stopAutoScroll]);

    return {
        activeId,
        sensors,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel
    };
};
