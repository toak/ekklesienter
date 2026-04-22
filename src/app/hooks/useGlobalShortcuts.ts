import { useCallback, useEffect } from 'react';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { IpcService } from '@/core/services/IpcService';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { db } from '@/core/db';
import { OverrideType } from '@/core/store/uiAtoms';
import { Verse } from '@/core/types';
import { createCanvasItem } from '@/features/presenter/components/slide-properties/helpers';
import { LiveSyncService } from '@/core/services/liveSyncService';

interface IGlobalShortcutsProps {
    appMode: 'scripture' | 'presentation';
    previewSlideId: string | null;
    activePresentation: any;
    activeVerse: any;
    selectedCanvasItemIds: string[];
    isTimelineHovered: boolean;
    handleNext: (detached?: boolean, preferLiveAnchor?: boolean) => Promise<void>;
    handlePrev: (detached?: boolean, preferLiveAnchor?: boolean) => Promise<void>;
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
    const undo = usePresentationStore(s => s.undo);
    const redo = usePresentationStore(s => s.redo);
    const setPreviewSlide = usePresentationStore(s => s.setPreviewSlide);
    const setLiveSlide = usePresentationStore(s => s.setLiveSlide);

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
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
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

        // Undo/Redo Shortcuts (Global)
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
            const uiState = await import('@/core/store/uiAtoms');
            const defaultStoreContext = await import('jotai/vanilla');
            const store = defaultStoreContext.getDefaultStore();
            const area = store.get(uiState.latestInteractionAreaAtom);

            const { 
                previewSlideId, 
                selectedPresentationId, 
                duplicateSlide, 
                duplicateSlides,
                duplicateCanvasItems,
                duplicateAudioScope,
                moveSlide, 
                removeSlide, 
                removeSlides,
                removeCanvasItem,
                selectedSlideIds,
                selectedAudioScopeId, 
                removeAudioScope,
                addCanvasItem 
            } = usePresentationStore.getState();

            // ── DUPLICATE (⌘D) ───────────────────────────────────────────
            if (isMod && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
                e.preventDefault?.();
                
                if (area === 'canvas' && previewSlideId && selectedCanvasItemIds.length > 0) {
                    const newIds = await duplicateCanvasItems(previewSlideId, selectedCanvasItemIds);
                    store.set(uiState.selectedCanvasItemIdsAtom, newIds);
                } 
                else if (area === 'audio' && selectedAudioScopeId) {
                    const newId = await duplicateAudioScope(selectedAudioScopeId);
                    if (newId) usePresentationStore.getState().selectAudioScope(newId);
                }
                else if (area === 'timeline' && selectedPresentationId) {
                    if (selectedSlideIds.length > 0) {
                        await duplicateSlides(selectedPresentationId, selectedSlideIds);
                    } else if (previewSlideId) {
                        await duplicateSlide(selectedPresentationId, previewSlideId);
                    }
                }
            }

            // ── NAVIGATION ([, ]) ────────────────────────────────────────
            if (isMod && previewSlideId && selectedPresentationId) {
                if (e.key === '[' || e.code === 'BracketLeft') {
                    e.preventDefault?.();
                    await moveSlide(selectedPresentationId, previewSlideId, e.shiftKey ? 'start' : 'back');
                } else if (e.key === ']' || e.code === 'BracketRight') {
                    e.preventDefault?.();
                    await moveSlide(selectedPresentationId, previewSlideId, e.shiftKey ? 'end' : 'forth');
                }
            }

            // ── DELETE (Del/Backspace) ───────────────────────────────────
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (area === 'canvas' && previewSlideId && selectedCanvasItemIds.length > 0) {
                    e.preventDefault?.();
                    for (const id of selectedCanvasItemIds) {
                        await removeCanvasItem(previewSlideId, id);
                    }
                    store.set(uiState.selectedCanvasItemIdsAtom, []);
                }
                else if (area === 'audio' && selectedAudioScopeId) {
                    e.preventDefault?.();
                    await removeAudioScope(selectedAudioScopeId);
                } 
                else if (area === 'timeline' && selectedPresentationId) {
                    e.preventDefault?.();
                    if (selectedSlideIds.length > 0) {
                        await removeSlides(selectedPresentationId, selectedSlideIds);
                    } else if (previewSlideId) {
                        await removeSlide(selectedPresentationId, previewSlideId);
                    }
                }
            }

            // ── TOOL SWITCHING (V, H, Esc) ──────────────────────────────
            if (!isMod) {
                if (e.key.toLowerCase() === 'v') {
                    e.preventDefault?.();
                    store.set(uiState.canvasToolAtom, 'select');
                } else if (e.key.toLowerCase() === 'h') {
                    e.preventDefault?.();
                    store.set(uiState.canvasToolAtom, 'pan');
                }
            }

            // ── ELEMENT CREATION (T, R, O, L) ─────────────────────────────
            if (!isMod && area === 'canvas' && previewSlideId) {
                const addElement = (type: string, shapeType?: string) => {
                    const item = createCanvasItem(type as any);
                    if (shapeType && item.shape) item.shape.shapeType = shapeType as any;
                    item.x = 50; item.y = 50; // Center
                    addCanvasItem(previewSlideId, item);
                    store.set(uiState.selectedCanvasItemIdsAtom, [item.id]);
                };

                if (e.key.toLowerCase() === 't') { e.preventDefault?.(); addElement('text'); }
                else if (e.key.toLowerCase() === 'r') { e.preventDefault?.(); addElement('shape', 'rect'); }
                else if (e.key.toLowerCase() === 'o') { e.preventDefault?.(); addElement('shape', 'circle'); }
                else if (e.key.toLowerCase() === 'l') { e.preventDefault?.(); addElement('stroke'); }
            }

            // ── ZOOM CONTROLS (⌘+, ⌘-, ⌘0) ────────────────────────────────
            if (isMod && area === 'canvas') {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault?.();
                    store.set(uiState.canvasZoomAtom as any, (prev: number) => Math.min(prev + 0.1, 4));
                } else if (e.key === '-') {
                    e.preventDefault?.();
                    store.set(uiState.canvasZoomAtom as any, (prev: number) => Math.max(prev - 0.1, 0.1));
                } else if (e.key === '0') {
                    e.preventDefault?.();
                    store.set(uiState.canvasZoomAtom as any, 1.0);
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

        let unsubscribeRemote: (() => void) | undefined;
        if (IpcService.isElectron()) {
            unsubscribeRemote = IpcService.on('remote:command-received', async (command: string, payload: unknown) => {
                if (command === 'NEXT') handleNext(false, true);
                else if (command === 'PREV') handlePrev(false, true);
                else if (command === 'OVERRIDE_BLACK') toggleOverride('blackout');
                else if (command === 'OVERRIDE_WHITE') toggleOverride('whiteout');
                else if (command === 'OVERRIDE_LOGO') toggleOverride('logo');
                else if (command === 'MEDIA_PLAY') {
                    const liveSlideId = usePresentationStore.getState().liveSlideId;
                    if (liveSlideId) {
                        LiveSyncService.sendVideoCommand(liveSlideId, 'play');
                    }
                }
                else if (command === 'MEDIA_PAUSE') {
                    const liveSlideId = usePresentationStore.getState().liveSlideId;
                    if (liveSlideId) {
                        LiveSyncService.sendVideoCommand(liveSlideId, 'pause');
                    }
                }
                else if (command === 'MEDIA_TOGGLE') {
                    const liveSlideId = usePresentationStore.getState().liveSlideId;
                    if (liveSlideId) {
                        LiveSyncService.sendVideoCommand(liveSlideId, 'toggle');
                    }
                }
                else if (command === 'MEDIA_STOP') {
                    const liveSlideId = usePresentationStore.getState().liveSlideId;
                    if (liveSlideId) {
                        LiveSyncService.sendVideoCommand(liveSlideId, 'pause');
                        LiveSyncService.sendVideoCommand(liveSlideId, 'seek', 0);
                    }
                }
                else if (command === 'BIBLE_QUERY') {
                    const queryPayload = payload as Record<string, unknown>;
                    const { type, ...query } = queryPayload;
                    let results: unknown[] = [];
                    
                    try {
                        if (type === 'GET_TRANSLATIONS') {
                            results = await db.translations.toArray();
                        } else if (type === 'GET_BOOKS') {
                            results = await db.books.where('translationId').equals(query.translationId as string).toArray();
                        } else if (type === 'GET_VERSES') {
                            results = await db.verses
                                .where('[translationId+bookId+chapter]')
                                .equals([query.translationId as string, query.bookId as string, query.chapter as number])
                                .toArray();
                        } else if (type === 'SEARCH') {
                            results = await db.verses
                                .where('text')
                                .startsWithIgnoreCase(query.text as string)
                                .limit(50)
                                .toArray();
                        }
                        
                        IpcService.send('remote:bible-results', { requestId: queryPayload.requestId, results });
                    } catch (err) {
                        console.error('Remote Bible Query failed:', err);
                    }
                }
                else if (command === 'BIBLE_SELECT') {
                    const selectPayload = payload as Record<string, unknown>;
                    const bibleState = useBibleStore.getState();
                    
                    if (Array.isArray(selectPayload.verses)) {
                        // Multi-verse project
                        bibleState.setSelectedVerses(selectPayload.verses as Verse[]);
                        bibleState.commitToProjector();
                        openProjector();
                    } else if (selectPayload.verse) {
                        // Single-verse project
                        bibleState.setActiveVerse(selectPayload.verse as Verse);
                        bibleState.commitToProjector();
                        openProjector();
                    }
                }
                else if (command === 'PROJECTOR_START') {
                    if (previewSlideId) {
                        setLiveSlide(previewSlideId);
                        openProjector();
                    }
                }
                else if (command === 'PROJECTOR_STOP') {
                    closeProjector();
                }
                else if (command === 'GET_STATE') {
                    // Trigger a re-sync of state to remote clients
                    IpcService.send('remote:request-state');
                }
            });
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            unsubscribeRelay?.();
            unsubscribeRemote?.();
        };
    }, [executeHotkey]);

}
