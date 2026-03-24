import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/core/utils/cn';
import { toast } from '@/core/utils/toast';

export interface TimelineDroppableZoneProps {
    onAddSlide: (blockId: string) => void;
    onAddPresentation: (presentationId: string, index?: number) => void;
    visualTimeline: any[];
    onNativeDragOver?: (index: number | null) => void;
}

/**
 * TimelineDroppableZone component for the presentation timeline.
 * Handles drag-and-drop interactions from the library to the timeline,
 * supporting both dnd-kit (for internal blocks) and native HTML5 Drag and Drop (for library items).
 */
export const TimelineDroppableZone: React.FC<TimelineDroppableZoneProps> = ({ 
    onAddSlide, 
    onAddPresentation, 
    visualTimeline, 
    onNativeDragOver 
}) => {
    const { isOver, setNodeRef } = useDroppable({
        id: 'timeline-droppable',
        data: {
            accepts: ['presentation', 'block']
        }
    });

    const [isNativeOver, setIsNativeOver] = useState(false);

    const handleNativeDragOver = (e: React.DragEvent) => {
        // Only accept drags from our library
        const types = e.dataTransfer.types;
        if (types.includes('application/json')) {
            e.preventDefault();
            setIsNativeOver(true);

            // Calculate drop index based on horizontal position continuously
            const rect = e.currentTarget.getBoundingClientRect();
            const dropX = e.clientX - rect.left;

            const topLevelSlides = visualTimeline.filter(item => item.type === 'slide');
            let insertionIndex = topLevelSlides.length;

            for (let i = 0; i < topLevelSlides.length; i++) {
                const slideItem = topLevelSlides[i];
                // If we drop before the middle of a slide, insert at its index
                const slideMidX = slideItem.x + slideItem.width / 2;
                if (dropX < slideMidX) {
                    insertionIndex = i;
                    break;
                }
            }
            if (onNativeDragOver) {
                onNativeDragOver(insertionIndex);
            }
        }
    };

    const handleNativeDragLeave = () => {
        setIsNativeOver(false);
        if (onNativeDragOver) {
            onNativeDragOver(null);
        }
    };

    const handleNativeDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsNativeOver(false);
        if (onNativeDragOver) {
            onNativeDragOver(null);
        }

        try {
            const dataStr = e.dataTransfer.getData('application/json');
            if (!dataStr) return;

            const data = JSON.parse(dataStr);
            if (data.source === 'presentation-library' && data.presentationId) {
                // Calculate drop index based on horizontal position
                const rect = e.currentTarget.getBoundingClientRect();
                const dropX = e.clientX - rect.left;

                // Find top-level slides from visualTimeline
                const topLevelSlides = visualTimeline.filter(item => item.type === 'slide');
                let insertionIndex = topLevelSlides.length;

                for (let i = 0; i < topLevelSlides.length; i++) {
                    const slideItem = topLevelSlides[i];
                    // If we drop before the middle of a slide, insert at its index
                    const slideMidX = slideItem.x + slideItem.width / 2;
                    if (dropX < slideMidX) {
                        insertionIndex = i;
                        break;
                    }
                }

                onAddPresentation(data.presentationId, insertionIndex);
                toast.success('Presentation added to timeline');
            }
        } catch (err) {
            console.error('[TimelineDroppableZone] Native drop parse failed:', err);
        }
    };

    return (
        <div
            ref={setNodeRef}
            onDragOver={handleNativeDragOver}
            onDragLeave={handleNativeDragLeave}
            onDrop={handleNativeDrop}
            className={cn(
                "absolute inset-0 z-40 pointer-events-none border-2 border-transparent transition-all",
                (isOver || isNativeOver) && "border-accent/40 bg-accent/5 pointer-events-auto"
            )}
        >
            {(isOver || isNativeOver) && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-accent/20 backdrop-blur-md px-4 py-2 rounded-full border border-accent/30 text-accent font-bold text-xs animate-in zoom-in-95 duration-200">
                        Drop to Add to Timeline
                    </div>
                </div>
            )}
        </div>
    );
};
