import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ISlide, IStyleLayer, Verse } from '../types';

export interface IHistorySnapshot {
    id: string;
    timestamp: number;
    /** ID of the presentation whose slides array is captured */
    presentationId: string;
    /** Full deep-cloned slides array — the "before" state for this action */
    slides: ISlide[];
    /** Human-readable label for devtools (optional) */
    actionLabel?: string;
}

interface HistoryState {
    past: IHistorySnapshot[];
    future: IHistorySnapshot[];
    limit: number;

    // Verse navigation history
    history: Verse[];

    setLimit: (limit: number) => void;
    /**
     * Push a "before" snapshot onto the past stack.
     * Call this BEFORE performing any mutating action.
     * Clears the redo (future) stack.
     */
    pushSnapshot: (snapshot: Omit<IHistorySnapshot, 'id' | 'timestamp'>) => void;
    /**
     * Pop the most recent snapshot from past and return it so the caller
     * can restore that state. The popped snapshot is moved to future.
     */
    undo: () => IHistorySnapshot | null;
    /**
     * Pop from future and return it for restore. Moves it back to past.
     */
    redo: () => IHistorySnapshot | null;
    clear: () => void;
    // Background history
    recentBackgrounds: Partial<IStyleLayer>[];
    addRecentBackground: (bg: Partial<IStyleLayer>) => void;

    // Verse history actions
    addToHistory: (verse: Verse) => void;
    clearHistory: () => void;
}

/**
 * Generates a canonical identity key for a background layer.
 * Used for deduplication and selection matching.
 */
export const getBackgroundIdentity = (bg: Partial<IStyleLayer> | undefined) => {
    if (!bg || !bg.type) return null;
    if (bg.type === 'color') return bg.color ? `color:${bg.color}` : null;
    if (bg.type === 'gradient') return bg.gradient ? `gradient:${bg.gradient.from}-${bg.gradient.to}-${bg.gradient.angle}` : null;
    if (bg.type === 'image') return bg.image?.id ? `image:id:${bg.image.id}` : (bg.image?.url ? `image:url:${bg.image.url}` : null);
    if (bg.type === 'video') return bg.video?.id ? `video:id:${bg.video.id}` : (bg.video?.url ? `video:url:${bg.video.url}` : null);
    return null;
};

export const useHistoryStore = create<HistoryState>()(
    persist(
        (set, get) => ({
            past: [],
            future: [],
            limit: 256,
            history: [],
            recentBackgrounds: [],

            setLimit: (limit) => set({ limit }),

            pushSnapshot: (snapshot) => {
                const { past, limit } = get();
                const newSnapshot: IHistorySnapshot = {
                    ...snapshot,
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                };

                const newPast = [...past, newSnapshot];
                if (newPast.length > limit) {
                    newPast.shift();
                }

                set({
                    past: newPast,
                    future: [], // Clear redo stack on new action
                });
            },

            undo: () => {
                const { past, future } = get();
                if (past.length === 0) return null;

                // Pop the most recent "before" snapshot — this IS the state to restore
                const newPast = [...past];
                const snapshotToRestore = newPast.pop()!;

                set({
                    past: newPast,
                    future: [snapshotToRestore, ...future],
                });

                // Return the snapshot so the caller can restore it
                return snapshotToRestore;
            },

            redo: () => {
                const { past, future } = get();
                if (future.length === 0) return null;

                const newFuture = [...future];
                const snapshotToRestore = newFuture.shift()!;

                set({
                    past: [...past, snapshotToRestore],
                    future: newFuture,
                });

                // Return the snapshot so the caller can restore it
                return snapshotToRestore;
            },

            clear: () => set({ past: [], future: [] }),

            // Verse navigation history
            addToHistory: (verse) => {
                const { history } = get();
                // Avoid consecutive duplicates
                if (history.length > 0 && history[0].id === verse.id) return;
                const newHistory = [verse, ...history].slice(0, 50);
                set({ history: newHistory });
            },

            clearHistory: () => set({ history: [] }),

            addRecentBackground: (bg) => {
                const { recentBackgrounds } = get();
                const newIdentity = getBackgroundIdentity(bg);
                if (!newIdentity) return;

                // Ensure metadata for DB resolution is preserved
                const isLocal = bg.type === 'image' ? (bg.image?.source === 'local' || !!bg.image?.id) : (bg.video?.source === 'local' || !!bg.video?.id);

                const fullBg = { 
                    ...bg, 
                    visible: true, 
                    opacity: bg.opacity ?? 1,
                    id: bg.id || crypto.randomUUID(),
                    // Inject metadata flags that might be missing from partial objects
                    image: bg.type === 'image' ? { ...bg.image!, isFromDb: bg.image?.isFromDb ?? isLocal } : undefined,
                    video: bg.type === 'video' ? { ...bg.video!, isFromDb: bg.video?.isFromDb ?? isLocal } : undefined,
                    adjustments: bg.adjustments || {
                        brightness: 100, contrast: 100, exposure: 0,
                        saturation: 100, vibrance: 0, hue: 0, blur: 0
                    },
                    media: bg.media || { framing: 'fill', isLooping: true, isMuted: true }
                };

                // Filter out ANY similar background (matches identity)
                const filtered = recentBackgrounds.filter(b => getBackgroundIdentity(b) !== newIdentity);
                const updatedList = [fullBg, ...filtered].slice(0, 5);
                
                set({ recentBackgrounds: updatedList });

                // Asynchronously generate video sequence if it's a new video
                if (fullBg.type === 'video' && fullBg.video?.id && !fullBg.video?.thumbnailSequence) {
                    import('@/features/presenter/services/ThumbnailService').then(({ ThumbnailService }) => {
                        ThumbnailService.generateVideoSequence(fullBg.video!.id!).then(sequence => {
                            if (sequence && sequence.length > 0) {
                                const finalRecent = get().recentBackgrounds.map(b => 
                                    (getBackgroundIdentity(b) === newIdentity)
                                        ? { ...b, video: { ...b.video!, thumbnailSequence: sequence } }
                                        : b
                                );
                                set({ recentBackgrounds: finalRecent });
                            }
                        });
                    });
                }
            },
        }),
        {
            name: 'ekklesienter-history-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                recentBackgrounds: state.recentBackgrounds,
                history: state.history,
            }),
        }
    )
);
