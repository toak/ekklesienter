import { useCallback, useEffect } from 'react';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { IpcService } from '@/core/services/IpcService';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { db } from '@/core/db';
import { OverrideType } from '@/core/store/uiAtoms';

interface IGlobalShortcutsProps {
    appMode: 'scripture' | 'presentation';
    previewSlideId: string | null;
    activePresentation: any;
    activeVerse: any;
    selectedCanvasItemIds: string[];
    isTimelineHovered: boolean;
    handleNext: (detached?: boolean) => Promise<void>;
    handlePrev: (detached?: boolean) => Promise<void>;
    openProjector: () => Promise<void>;
    closeProjector: () => void;
    toggleOverride: (type: OverrideType) => void;
}

/**
 * Hook to manage global keyboard shortcuts for the application.
 */
export function useGlobalShortcuts({
    appMode,
    previewSlideId,
    activePresentation,
    activeVerse,
    selectedCanvasItemIds,
    isTimelineHovered,
    handleNext,
    handlePrev,
    openProjector,
    closeProjector,
    toggleOverride
}: IGlobalShortcutsProps) {
    const { t } = useTranslation();
    const { undo, redo, setPreviewSlide, setLiveSlide } = usePresentationStore();

    const executeHotkey = useCallback(async (e: {
        key: string;
        code?: string;
        ctrlKey?: boolean;
        metaKey?: boolean;
        shiftKey?: boolean;
        altKey?: boolean;
        preventDefault?: () => void;
    }) => {
        // Ignore if user is typing in an input
        const active = document.activeElement;
        if (active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.getAttribute('contenteditable') === 'true'
        )) {
            return;
        }

        const isMod = e.metaKey || e.ctrlKey;

        // Enter: Contextual Actions or Open Projector
        if (e.key === 'Enter') {
            if (appMode === 'presentation') {
                const uiState = await import('@/core/store/uiAtoms');
                const defaultStoreContext = await import('jotai/vanilla');
                const store = defaultStoreContext.getDefaultStore();

                const isPreviewHovered = store.get(uiState.slidePreviewHoveredAtom);

                // 1. Hovering over Slide Preview AND items selected -> Edit selected text
                if (isPreviewHovered) {
                    const selectedItemIds = store.get(uiState.selectedCanvasItemIdsAtom);
                    if (selectedItemIds.length > 0) {
                        const firstId = selectedItemIds[selectedItemIds.length - 1];
                        store.set(uiState.editingCanvasItemIdAtom as any, firstId);
                        store.set(uiState.canvasToolAtom, 'text');
                        e.preventDefault?.();
                        return;
                    }
                }

                // 2. Default Contextual Actions / Go Live
                if (isMod) {
                    const slides = activePresentation?.slides || [];
                    if (slides.length > 0) {
                        e.preventDefault?.();
                        const firstId = slides[0].id;
                        setPreviewSlide(firstId);
                        setLiveSlide(firstId);
                        openProjector();
                        return;
                    }
                }

                if (previewSlideId) {
                    e.preventDefault?.();
                    setLiveSlide(previewSlideId);
                    openProjector();
                    return;
                }
            } else {
                const bibleState = useBibleStore.getState();
                const canProject = bibleState.activeVerse || bibleState.selectedVerses.length >= 2;

                if (canProject) {
                    e.preventDefault?.();
                    bibleState.commitToProjector();
                    openProjector();
                }
            }
        }

        // Escape: Clear presentation & Close Projector
        if (e.key === 'Escape') {
            e.preventDefault?.();
            closeProjector();
        }

        // Arrow Right or Down: Next
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault?.();
            await handleNext(isMod);
        }

        // Arrow Left or Up: Previous
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault?.();
            await handlePrev(isMod);
        }

        // Ctrl+H: Toggle History
        if (isMod && (e.code === 'KeyH' || e.key.toLowerCase() === 'h')) {
            const uiState = await import('@/core/store/uiAtoms');
            const defaultStoreContext = await import('jotai/vanilla');
            const store = defaultStoreContext.getDefaultStore();
            e.preventDefault?.();
            store.set(uiState.historyOpenAtom as any, (prev: boolean) => !prev);
        }

        // H: Sync Preview to Live (Layout independent)
        if (!isMod && (e.code === 'KeyH' || e.key.toLowerCase() === 'h')) {
            if (appMode === 'presentation' && previewSlideId) {
                e.preventDefault?.();
                usePresentationStore.getState().syncPreviewToLive();
            }
        }

        // Ctrl+Shift+C: Copy current verse
        if (isMod && e.shiftKey && (e.code === 'KeyC' || e.key.toLowerCase() === 'c')) {
            if (activeVerse) {
                e.preventDefault?.();
                const text = `${activeVerse.bookId} ${activeVerse.chapter}:${activeVerse.verseNumber} (${activeVerse.translationId})\n${activeVerse.text}`;
                navigator.clipboard.writeText(text);
            }
        }

        // Ctrl+F: Open search
        if (isMod && (e.code === 'KeyF' || e.key.toLowerCase() === 'f')) {
            const uiState = await import('@/core/store/uiAtoms');
            const defaultStoreContext = await import('jotai/vanilla');
            const store = defaultStoreContext.getDefaultStore();
            e.preventDefault?.();
            store.set(uiState.searchOpenAtom as any, true);
        }

        // Live Controls shortcuts
        if (e.code === 'KeyB' || e.key.toLowerCase() === 'b') {
            e.preventDefault?.();
            toggleOverride('blackout');
        }
        if (e.code === 'KeyW' || e.key.toLowerCase() === 'w') {
            e.preventDefault?.();
            toggleOverride('whiteout');
        }
        if (e.code === 'KeyL' || e.key.toLowerCase() === 'l') {
            e.preventDefault?.();
            toggleOverride('logo');
        }

        // Undo/Redo Shortcuts
        if (isMod && (e.code === 'KeyZ' || e.key.toLowerCase() === 'z')) {
            e.preventDefault?.();
            if (e.shiftKey) {
                await redo();
            } else {
                await undo();
            }
        }
        if (isMod && (e.code === 'KeyY' || e.key.toLowerCase() === 'y')) {
            e.preventDefault?.();
            await redo();
        }

        // Slide Management Shortcuts
        if (appMode === 'presentation') {
            const { 
                previewSlideId, 
                selectedPresentationId, 
                duplicateSlide, 
                moveSlide, 
                removeSlide, 
                selectedAudioScopeId, 
                removeAudioScope 
            } = usePresentationStore.getState();

            if (isMod && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
                if (previewSlideId && selectedPresentationId) {
                    e.preventDefault?.();
                    await duplicateSlide(selectedPresentationId, previewSlideId);
                }
            }

            if (isMod && previewSlideId && selectedPresentationId) {
                if (e.key === '[' || e.code === 'BracketLeft') {
                    e.preventDefault?.();
                    await moveSlide(selectedPresentationId, previewSlideId, e.shiftKey ? 'start' : 'back');
                } else if (e.key === ']' || e.code === 'BracketRight') {
                    e.preventDefault?.();
                    await moveSlide(selectedPresentationId, previewSlideId, e.shiftKey ? 'end' : 'forth');
                }
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                const canDeleteSlide = isTimelineHovered && selectedCanvasItemIds.length === 0 && !selectedAudioScopeId;

                if (selectedAudioScopeId) {
                    e.preventDefault?.();
                    await removeAudioScope(selectedAudioScopeId);
                } else if (canDeleteSlide && previewSlideId && selectedPresentationId) {
                    e.preventDefault?.();
                    await removeSlide(selectedPresentationId, previewSlideId);
                }
            }
        }

        // Ctrl+S: Save
        if (isMod && (e.code === 'KeyS' || e.key.toLowerCase() === 's')) {
            e.preventDefault?.();
            const {
                activeServiceId,
                activeService,
                saveActiveService,
                activePresentationId
            } = usePresentationStore.getState();

            if (activeServiceId && activeService?.fileHandle) {
                try {
                    await saveActiveService();
                    toast.success(t('service_saved', 'Service saved successfully'));
                    return;
                } catch (err) {
                    console.error('Auto-save failed:', err);
                }
            }

            if (appMode === 'presentation') {
                useModalStore.getState().openModal(ModalType.SAVE_NESTED_CONFIRM);
            }
        }
    }, [
        appMode, 
        previewSlideId, 
        activePresentation, 
        activeVerse, 
        handleNext, 
        handlePrev, 
        closeProjector, 
        openProjector, 
        undo, 
        redo, 
        toggleOverride, 
        selectedCanvasItemIds, 
        isTimelineHovered,
        setPreviewSlide,
        setLiveSlide,
        t
    ]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => executeHotkey(e);
        window.addEventListener('keydown', handleKeyDown, true);

        let unsubscribeRelay: (() => void) | undefined;
        if (IpcService.isElectron()) {
            unsubscribeRelay = IpcService.on('relay-keydown', (payload: any) => {
                executeHotkey(payload);
            });
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            unsubscribeRelay?.();
        };
    }, [executeHotkey]);
}
