import { useEffect, useRef } from 'react';
import { ISlide } from '@/core/types';

interface UseTimelineShortcutsProps {
    activePresentationId: string | null;
    slides: ISlide[];
    selectedSlideIds: string[];
    selectedAudioScopeId: string | null;
    previewSlideId: string | null;
    isTimelineHoveredRef: React.RefObject<boolean>;
    copySlides: (id: string, ids: string[], isCut?: boolean) => void;
    pasteSlides: (id: string, targetIdx?: number) => void;
    duplicateSlides: (id: string, ids: string[]) => void;
    duplicateSlide: (id: string, sid: string) => void;
    removeSlides: (id: string, ids: string[]) => void;
    removeSlide: (id: string, sid: string) => void;
    copyAudioScope: (id: string) => Promise<void>;
    pasteAudioScope: (targetSlideId: string) => Promise<void>;
    duplicateAudioScope: (id: string) => Promise<string | undefined>;
    setSelectedSlideIds: (ids: string[]) => void;
    setLiveSlide: (id: string | null, presentationId?: string, rootPresentationId?: string, navigationParentSlideId?: string | null) => void;
    clearSelection: () => void;
}

/**
 * Hook to handle keyboard shortcuts for the timeline.
 */
export const useTimelineShortcuts = ({
    activePresentationId,
    slides,
    selectedSlideIds,
    selectedAudioScopeId,
    previewSlideId,
    isTimelineHoveredRef,
    copySlides,
    pasteSlides,
    duplicateSlides,
    duplicateSlide,
    removeSlides,
    removeSlide,
    copyAudioScope,
    pasteAudioScope,
    duplicateAudioScope,
    setSelectedSlideIds,
    setLiveSlide,
    clearSelection
}: UseTimelineShortcutsProps) => {
    // Keep a ref to the latest state to avoid re-binding the event listener too frequently
    const stateRef = useRef({ selectedSlideIds, selectedAudioScopeId, activePresentationId, slides, previewSlideId });
    
    useEffect(() => {
        stateRef.current = { selectedSlideIds, selectedAudioScopeId, activePresentationId, slides, previewSlideId };
    }, [selectedSlideIds, selectedAudioScopeId, activePresentationId, slides, previewSlideId]);

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
                if (state.selectedAudioScopeId) {
                    copyAudioScope(state.selectedAudioScopeId);
                } else if (state.selectedSlideIds.length > 0) {
                    copySlides(state.activePresentationId!, state.selectedSlideIds);
                }
            } else if (isMod && e.key === 'v') {
                if (state.selectedAudioScopeId) {
                    // Paste for audio usually happens at a specific slide, but if one is selected, we can try pasting there
                    // Or if we have a preview slide
                    if (state.previewSlideId) pasteAudioScope(state.previewSlideId);
                } else if (state.activePresentationId) {
                    pasteSlides(state.activePresentationId);
                }
            } else if (isMod && e.key === 'd') {
                // Command+D for duplication
                e.preventDefault();
                if (state.selectedAudioScopeId) {
                    duplicateAudioScope(state.selectedAudioScopeId);
                } else if (state.selectedSlideIds.length > 0) {
                    duplicateSlides(state.activePresentationId!, state.selectedSlideIds);
                } else if (state.previewSlideId) {
                    duplicateSlide(state.activePresentationId!, state.previewSlideId);
                }
            } else if (isMod && e.key === 'x') {
                if (state.selectedSlideIds.length > 0) copySlides(state.activePresentationId!, state.selectedSlideIds, true);
            } else if (isMod && e.key === 'a') {
                e.preventDefault();
                setSelectedSlideIds(state.slides.map(s => s.id));
            } else if (e.key === 'Enter' && isMod && isTimelineHoveredRef.current) {
                if (state.previewSlideId) {
                    e.preventDefault();
                    e.stopPropagation();
                    setLiveSlide(state.previewSlideId);
                }
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
    }, [copySlides, pasteSlides, duplicateSlides, removeSlides, clearSelection, duplicateSlide, removeSlide, setSelectedSlideIds, isTimelineHoveredRef, copyAudioScope, pasteAudioScope, duplicateAudioScope]);
};
