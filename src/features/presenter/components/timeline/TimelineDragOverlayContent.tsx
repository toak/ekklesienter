import React from 'react';
import { ISlide } from '@/core/types';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import { cn } from '@/core/utils/cn';

interface TimelineDragOverlayContentProps {
    activeId: string | null;
    localSlides: ISlide[];
    selectedSlideIds: string[];
    templatesMap: Map<string, any>;
    blocksMap: Map<string, any>;
    lang: string;
}

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

    return (
        <div className="relative pointer-events-none">
            {draggedSlides.map((s, idx) => (
                <div
                    key={s.id}
                    className={cn(
                        "w-32 aspect-video bg-stone-800 rounded-lg overflow-hidden border-2 border-accent shadow-2xl transition-transform duration-200",
                        idx > 0 && "absolute top-2 left-2 -z-10 opacity-40 scale-95"
                    )}
                    style={{ transform: idx > 0 ? `translate(${idx * 4}px, ${idx * 4}px)` : 'none' }}
                >
                    <SlideContentRenderer
                        slide={s}
                        template={s.templateId ? templatesMap.get(s.templateId) : undefined}
                        block={blocksMap.get(s.blockId)}
                        lang={lang}
                        scale={0.25}
                    />
                </div>
            ))}
            {draggedSlides.length > 1 && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg border border-white/20">
                    {draggedSlides.length}
                </div>
            )}
        </div>
    );
};
