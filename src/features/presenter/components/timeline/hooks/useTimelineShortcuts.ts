import { useEffect, useRef } from 'react';
import { ISlide } from '@/core/types';

interface UseTimelineShortcutsProps {
    activePresentationId: string | null;
    slides: ISlide[];
    selectedSlideIds: string[];
    previewSlideId: string | null;
    isTimelineHoveredRef: React.RefObject<boolean>;
    copySlides: (id: string, ids: string[], isCut?: boolean) => void;
    pasteSlides: (id: string) => void;
    duplicateSlides: (id: string, ids: string[]) => void;
    duplicateSlide: (id: string, sid: string) => void;
    removeSlides: (id: string, ids: string[]) => void;
    removeSlide: (id: string, sid: string) => void;
    setSelectedSlideIds: (ids: string[]) => void;
    clearSelection: () => void;
}

/**
 * Hook to handle keyboard shortcuts for the timeline.
 */
export const useTimelineShortcuts = ({
    activePresentationId,
    slides,
    selectedSlideIds,
    previewSlideId,
    isTimelineHoveredRef,
    copySlides,
    pasteSlides,
    duplicateSlides,
    duplicateSlide,
    removeSlides,
    removeSlide,
    setSelectedSlideIds,
    clearSelection
}: UseTimelineShortcutsProps) => {
    // Keep a ref to the latest state to avoid re-binding the event listener too frequently
    const stateRef = useRef({ selectedSlideIds, activePresentationId, slides, previewSlideId });
    
    useEffect(() => {
        stateRef.current = { selectedSlideIds, activePresentationId, slides, previewSlideId };
    }, [selectedSlideIds, activePresentationId, slides, previewSlideId]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const active = document.activeElement;
            const isTyping = active && (
                active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.getAttribute('contenteditable') === 'true'
            );
            if (isTyping) return;

            const isMod = e.metaKey || e.ctrlKey;
            const state = stateRef.current;

            if (isMod && e.key === 'c') {
                if (state.selectedSlideIds.length > 0) copySlides(state.activePresentationId!, state.selectedSlideIds);
            } else if (isMod && e.key === 'v') {
                if (state.activePresentationId) pasteSlides(state.activePresentationId);
            } else if (isMod && e.key === 'x') {
                if (state.selectedSlideIds.length > 0) copySlides(state.activePresentationId!, state.selectedSlideIds, true);
            } else if (isMod && e.key === 'd') {
                e.preventDefault();
                if (state.selectedSlideIds.length > 0) duplicateSlides(state.activePresentationId!, state.selectedSlideIds);
                else if (state.previewSlideId) duplicateSlide(state.activePresentationId!, state.previewSlideId);
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (state.selectedSlideIds.length > 0) {
                    removeSlides(state.activePresentationId!, state.selectedSlideIds);
                } else if (state.previewSlideId) {
                    removeSlide(state.activePresentationId!, state.previewSlideId);
                }
            } else if (isMod && e.key === 'a') {
                e.preventDefault();
                setSelectedSlideIds(state.slides.map(s => s.id));
            } else if (e.altKey && e.key === 'd') {
                // Only deselect when timeline is hovered
                if (isTimelineHoveredRef.current) {
                    e.preventDefault();
                    clearSelection();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [copySlides, pasteSlides, duplicateSlides, removeSlides, clearSelection, duplicateSlide, removeSlide, setSelectedSlideIds, isTimelineHoveredRef]);
};
