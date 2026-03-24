import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSetAtom, useAtomValue } from 'jotai';
import { ArrowRightLeft } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ISlide, ICanvasSlide, IPresentationFile } from '@/core/types';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { 
    slideDesignPanelOpenAtom, 
    slideDesignTabAtom, 
    selectedTransitionSlideIdAtom, 
    selectedCanvasItemIdsAtom 
} from '@/core/store/uiAtoms';

export interface TransitionSeparatorProps {
    slide?: ISlide;
    activePresentationId: string;
    isEnd?: boolean;
    presentation?: IPresentationFile;
}

/**
 * TransitionSeparator component for the presentation timeline.
 * Renders a clickable indicator between slides to configure transitions.
 */
export const TransitionSeparator: React.FC<TransitionSeparatorProps> = ({ 
    slide, 
    activePresentationId, 
    isEnd, 
    presentation 
}) => {
    const { t } = useTranslation();
    const setPreviewSlide = usePresentationStore(s => s.setPreviewSlide);
    const setPanelOpen = useSetAtom(slideDesignPanelOpenAtom);
    const setDesignTab = useSetAtom(slideDesignTabAtom);
    const selectedTransId = useAtomValue(selectedTransitionSlideIdAtom);
    const setSelectedTransId = useSetAtom(selectedTransitionSlideIdAtom);
    const setSelectedCanvasItemIds = useSetAtom(selectedCanvasItemIdsAtom);

    const transition = isEnd ? presentation?.endTransition : (slide as ICanvasSlide)?.transition;
    const hasTransition = transition && transition.type !== 'none';
    const targetId = isEnd ? 'presentation-end' : slide?.id;
    const isSelected = selectedTransId === targetId;

    if (!isEnd && !slide) return null;

    return (
        <div className={cn(
            "absolute top-0 bottom-0 w-8 flex items-center justify-center group/sep z-50",
            isEnd ? "-right-[20px]" : "-left-[20px]"
        )}>
            {/* Wider hit area */}
            <div className="absolute inset-y-0 -inset-x-2 cursor-pointer" />

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (!targetId) return;
                    setSelectedTransId(targetId);
                    if (!isEnd && slide) {
                        setPreviewSlide(slide.id, activePresentationId);
                    }
                    setSelectedCanvasItemIds([]); // Clear selection to focus on transition
                    setDesignTab('transition');
                    setPanelOpen(true);
                }}
                className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-all shadow-xl backdrop-blur-md cursor-pointer z-20 border",
                    isSelected
                        ? "bg-accent border-accent text-stone-900 scale-110"
                        : hasTransition
                            ? "bg-stone-800 border-accent/40 text-accent opacity-100 scale-100"
                            : "bg-stone-900 border-white/10 text-stone-400 opacity-0 group-hover/sep:opacity-100 scale-90 hover:scale-105 hover:border-accent/40 hover:text-accent"
                )}
                title={isEnd ? t('configure_end_transition', 'Configure End Transition') : t('configure_transition', 'Configure Transition')}
            >
                <ArrowRightLeft className={cn("w-3.5 h-3.5", isSelected && "animate-pulse")} />
            </button>

            {/* Vertical indicator line on hover */}
            <div className={cn(
                "absolute inset-y-4 left-1/2 -translate-x-1/2 w-0.5 rounded-full transition-opacity pointer-events-none",
                isSelected ? "bg-accent opacity-40" : "bg-accent/30 opacity-0 group-hover/sep:opacity-100"
            )} />
        </div>
    );
};
