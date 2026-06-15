import React from 'react';
import { ISlide, ICanvasSlide, IBlock, ITemplate } from '@/core/types';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import { cn } from '@/core/utils/cn';

interface TimelineDragOverlayContentProps {
    activeId: string | null;
    localSlides: ISlide[];
    selectedSlideIds: string[];
    templatesMap: Map<string, ITemplate>;
    blocksMap: Map<string, IBlock>;
    lang: string;
}

/**
 * Renders the visual drag overlay for slide(s) being dragged.
 * Single slide: Shows the slide thumbnail with accent border.
 * Multiple slides: Renders a stacked "deck" effect with cards offset behind
 * the primary slide, plus a count badge.
 */
export const TimelineDragOverlayContent: React.FC<TimelineDragOverlayContentProps> = ({
    activeId,
    localSlides,
    selectedSlideIds,
    templatesMap,
    blocksMap,
    lang
}) => {
    if (!activeId) return null;

    const activeSlide = localSlides.find(s => s.id === activeId);
    if (!activeSlide) return null;

    const isSelected = selectedSlideIds.includes(activeId);
    const draggedSlides = isSelected 
        ? localSlides.filter(s => selectedSlideIds.includes(s.id))
        : [activeSlide];

    // Show max 3 stacked cards for performance
    const maxVisible = Math.min(draggedSlides.length, 3);
    const visibleSlides = draggedSlides.slice(0, maxVisible);

    return (
        <div className="relative pointer-events-none" style={{ width: 128, height: 72, transform: 'scale(0.85)', transformOrigin: 'center' }}>
            {/* Render back-to-front so the first card is on top */}
            {visibleSlides.map((s, idx) => {
                const reverseIdx = maxVisible - 1 - idx;
                const offsetX = reverseIdx * 6;
                const offsetY = reverseIdx * 6;
                const scale = 1 - reverseIdx * 0.04;
                const opacity = idx === 0 ? 1 : 0.7 - reverseIdx * 0.15;

                return (
                    <div
                        key={s.id}
                        className={cn(
                            "w-32 aspect-video rounded-xl overflow-hidden border-2 border-accent shadow-2xl absolute top-0 left-0 bg-stone-900",
                        )}
                        style={{
                            transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
                            transformOrigin: 'top left',
                            opacity,
                            zIndex: maxVisible - reverseIdx,
                        }}
                    >
                        <div
                            className="absolute top-0 left-0 w-[1920px] h-[1080px] pointer-events-none origin-top-left"
                            style={{ transform: `scale(${128 / 1920})` }}
                        >
                            <SlideContentRenderer
                                slide={s}
                                template={s.templateId ? templatesMap.get(s.templateId) : undefined}
                                block={blocksMap.get(s.blockId)}
                                variables={s.type === 'normal' ? (s as ICanvasSlide).content?.variables : undefined}
                                canvasItems={s.type === 'normal' ? (s as ICanvasSlide).content?.canvasItems : []}
                                backgroundOverride={s.type === 'normal' ? (s as ICanvasSlide).backgroundOverride : undefined}
                                lang={lang}
                                scale={1}
                                isPreview
                                slideId={s.id}
                            />
                        </div>
                    </div>
                );
            })}

            {/* Count badge */}
            {draggedSlides.length > 1 && (
                <div
                    className="absolute w-6 h-6 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg border-2 border-white/30"
                    style={{ top: -8, right: -8, zIndex: maxVisible + 1 }}
                >
                    {draggedSlides.length}
                </div>
            )}
        </div>
    );
};
