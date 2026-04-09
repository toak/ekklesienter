import { db } from '@/core/db';
import { PresentationSliceCreator } from '../types';
import { ICanvasItem, ICanvasSlide, IStyleLayer, ITimerSettings } from '@/core/types';

export const createCanvasSlice: PresentationSliceCreator = (set, get) => ({
    addCanvasItem: async (slideId, item) => {
        await get().takeSnapshot(slideId);
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return;

        let pres = selectedPresentation;
        if (!pres || pres.id !== selectedPresentationId) {
            const active = get().activePresentation;
            if (active && active.id === selectedPresentationId) pres = active;
            else pres = await db.presentationFiles.get(selectedPresentationId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                const existing = normalSlide.content.canvasItems || [];
                const newItem = { ...item, zIndex: existing.length };
                return {
                    ...normalSlide,
                    content: { ...normalSlide.content, canvasItems: [...existing, newItem] }
                };
            }
            return s;
        });
        await get().updatePresentationSlides(selectedPresentationId, newSlides);
    },

    updateCanvasItem: async (slideId, itemId, updates) => {
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return;

        let pres = selectedPresentation;
        if (!pres || pres.id !== selectedPresentationId) {
            const active = get().activePresentation;
            if (active && active.id === selectedPresentationId) pres = active;
            else pres = await db.presentationFiles.get(selectedPresentationId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                const items = (normalSlide.content.canvasItems || []).map(ci => {
                    if (ci.id !== itemId) return ci;
                    const mergedItem = { ...ci, ...updates };
                    if (updates.text && ci.text) mergedItem.text = { ...ci.text, ...updates.text };
                    if (updates.shape && ci.shape) mergedItem.shape = { ...ci.shape, ...updates.shape };
                    return mergedItem;
                });
                return { ...normalSlide, content: { ...normalSlide.content, canvasItems: items } };
            }
            return s;
        });
        await get().updatePresentationSlides(selectedPresentationId, newSlides);
    },

    updateCanvasItems: async (slideId, updates) => {
        await get().takeSnapshot(slideId);
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return;

        let pres = selectedPresentation;
        if (!pres || pres.id !== selectedPresentationId) {
            const active = get().activePresentation;
            if (active && active.id === selectedPresentationId) pres = active;
            else pres = await db.presentationFiles.get(selectedPresentationId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                const items = (normalSlide.content.canvasItems || []).map(ci => {
                    const update = updates.find(u => u.id === ci.id);
                    if (!update) return ci;
                    const mergedItem = { ...ci, ...update.updates };
                    if (update.updates.text && ci.text) mergedItem.text = { ...ci.text, ...update.updates.text };
                    if (update.updates.shape && ci.shape) mergedItem.shape = { ...ci.shape, ...update.updates.shape };
                    return mergedItem;
                });
                return { ...normalSlide, content: { ...normalSlide.content, canvasItems: items } };
            }
            return s;
        });
        await get().updatePresentationSlides(selectedPresentationId, newSlides);
    },

    updateCanvasItemsOrder: async (slideId, items) => {
        await get().takeSnapshot(slideId);
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return;

        let pres = selectedPresentation;
        if (!pres || pres.id !== selectedPresentationId) {
            const active = get().activePresentation;
            if (active && active.id === selectedPresentationId) pres = active;
            else pres = await db.presentationFiles.get(selectedPresentationId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                return { ...normalSlide, content: { ...normalSlide.content, canvasItems: items } };
            }
            return s;
        });
        await get().updatePresentationSlides(selectedPresentationId, newSlides);
    },

    removeCanvasItem: async (slideId, itemId) => {
        await get().takeSnapshot(slideId);
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return;

        let pres = selectedPresentation;
        if (!pres || pres.id !== selectedPresentationId) {
            const active = get().activePresentation;
            if (active && active.id === selectedPresentationId) pres = active;
            else pres = await db.presentationFiles.get(selectedPresentationId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                const items = (normalSlide.content.canvasItems || [])
                    .filter(ci => ci.id !== itemId)
                    .map((ci, idx) => ({ ...ci, zIndex: idx }));
                return { ...normalSlide, content: { ...normalSlide.content, canvasItems: items } };
            }
            return s;
        });
        await get().updatePresentationSlides(selectedPresentationId, newSlides);
    },

    reorderCanvasItem: async (slideId, itemId, direction) => {
        await get().takeSnapshot(slideId);
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return;

        let pres = selectedPresentation;
        if (!pres || pres.id !== selectedPresentationId) {
            const active = get().activePresentation;
            if (active && active.id === selectedPresentationId) pres = active;
            else pres = await db.presentationFiles.get(selectedPresentationId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                const items = [...(normalSlide.content.canvasItems || [])];
                const index = items.findIndex(item => item.id === itemId);
                if (index === -1) return s;

                const newIndex = direction === 'up' ? index + 1 : index - 1;
                if (newIndex < 0 || newIndex >= items.length) return s;

                [items[index], items[newIndex]] = [items[newIndex], items[index]];
                const updatedItems = items.map((item, idx) => ({ ...item, zIndex: idx }));
                return { ...normalSlide, content: { ...normalSlide.content, canvasItems: updatedItems } };
            }
            return s;
        });
        await get().updatePresentationSlides(selectedPresentationId, newSlides);
    },

    duplicateCanvasItems: async (slideId: string, itemIds: string[]) => {
        if (itemIds.length === 0) return [];
        await get().takeSnapshot(slideId);
        
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return [];

        let pres = selectedPresentation;
        if (!pres || pres.id !== selectedPresentationId) {
            const active = get().activePresentation;
            if (active && active.id === selectedPresentationId) pres = active;
            else pres = await db.presentationFiles.get(selectedPresentationId) || null;
        }
        if (!pres) return [];

        const newItems: ICanvasItem[] = [];
        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                const items = [...(normalSlide.content.canvasItems || [])];
                
                const clonedItems = items.filter(i => itemIds.includes(i.id)).map(item => {
                    const clone = structuredClone(item);
                    clone.id = crypto.randomUUID();
                    clone.x += 2; // Slight offset (2%)
                    clone.y += 2;
                    clone.zIndex = items.length + newItems.length;
                    newItems.push(clone);
                    return clone;
                });

                return { 
                    ...normalSlide, 
                    content: { 
                        ...normalSlide.content, 
                        canvasItems: [...items, ...clonedItems] 
                    } 
                };
            }
            return s;
        });

        await get().updatePresentationSlides(selectedPresentationId, newSlides);
        return newItems.map(i => i.id);
    },

    setMediaBackground: async (slideId, mediaItem) => {
        const { MediaPersistenceService } = await import('../../services/MediaPersistenceService');
        const stableId = await MediaPersistenceService.ensureMediaInDb(mediaItem);

        const isVideo = mediaItem.type === 'video';
        const layer: IStyleLayer = {
            id: crypto.randomUUID(),
            type: isVideo ? 'video' : 'image',
            visible: true,
            opacity: 1,
            blendMode: 'normal',
            ...(isVideo ? {
                video: {
                    url: stableId,
                    id: stableId,
                    isFromDb: true,
                    source: 'local',
                    isMuted: true, // Legacy mute for background
                    isLooping: true,
                }
            } : {
                image: {
                    url: stableId,
                    id: stableId,
                    isFromDb: true,
                    source: 'local',
                }
            })
        } as any;
        await get().updateSlideBackground(slideId, [layer]);
    },

    addMediaLayer: async (slideId, mediaItem, position) => {
        const { MediaPersistenceService } = await import('../../services/MediaPersistenceService');
        const stableId = await MediaPersistenceService.ensureMediaInDb(mediaItem);

        const isVideo = mediaItem.type === 'video';
        const newItem: ICanvasItem = {
            id: crypto.randomUUID(),
            type: isVideo ? 'video' : 'image',
            x: position?.x ?? 50,
            y: position?.y ?? 50,
            width: 40,
            height: 40,
            rotation: 0,
            zIndex: 0,
            locked: false,
            visible: true,
            opacity: 1,
            fills: [{
                id: crypto.randomUUID(),
                type: isVideo ? 'video' : 'image',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                ...(isVideo ? {
                    video: {
                        url: stableId,
                        id: stableId,
                        isFromDb: true,
                        loop: true,
                        muted: false,
                        volume: 1,
                        playbackRate: 1,
                        startTime: 0
                    }
                } : {
                    image: {
                        url: stableId,
                        id: stableId,
                        isFromDb: true,
                        fit: 'contain',
                        flipX: false,
                        flipY: false
                    }
                })
            } as any],
            strokes: [],
        };
        await get().addCanvasItem(slideId, newItem);
    },

    updateSlideVariable: async (slideId, name, value) => {
        await get().takeSnapshot(slideId);
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return;

        let pres = selectedPresentation;
        if (!pres || pres.id !== selectedPresentationId) {
            const active = get().activePresentation;
            if (active && active.id === selectedPresentationId) pres = active;
            else pres = await db.presentationFiles.get(selectedPresentationId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                return {
                    ...normalSlide,
                    content: {
                        ...normalSlide.content,
                        variables: {
                            ...normalSlide.content.variables,
                            [name]: value
                        }
                    }
                };
            }
            return s;
        });

        await get().updatePresentationSlides(selectedPresentationId, newSlides);
    },

    updateTimerSettings: async (slideId, updates) => {
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return;

        let pres = selectedPresentation;
        if (!pres || pres.id !== selectedPresentationId) {
            const active = get().activePresentation;
            if (active && active.id === selectedPresentationId) pres = active;
            else pres = await db.presentationFiles.get(selectedPresentationId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                return {
                    ...normalSlide,
                    timerSettings: {
                        ...(normalSlide.timerSettings || {
                            duration: 300,
                            style: 'minimal_ring',
                            endAction: 'none'
                        }),
                        ...updates
                    }
                };
            }
            return s;
        });
        await get().updatePresentationSlides(selectedPresentationId, newSlides);
    },

    updateVideoSettings: async (slideId, updates, presentationId) => {
        const { selectedPresentationId, selectedPresentation } = get();
        const targetPresId = presentationId || selectedPresentationId;
        if (!targetPresId) return;

        let pres = (targetPresId === selectedPresentationId) ? selectedPresentation : null;
        
        if (!pres || pres.id !== targetPresId) {
            const active = get().activePresentation;
            if (active && active.id === targetPresId) pres = active;
            else pres = await db.presentationFiles.get(targetPresId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'video') {
                const videoSlide = s as any;
                return {
                    ...videoSlide,
                    videoSettings: {
                        ...videoSlide.videoSettings,
                        ...updates
                    }
                };
            }
            return s;
        });
        await get().updatePresentationSlides(targetPresId, newSlides);
    },

    undo: async () => {
        const { useHistoryStore } = await import('@/core/store/historyStore');
        const snapshot = useHistoryStore.getState().undo();
        if (!snapshot) return;

        const { selectedPresentationId } = get();
        if (!selectedPresentationId) return;

        await db.presentationFiles.where('id').equals(selectedPresentationId).modify(pres => {
            const slide = pres.slides.find(s => s.id === snapshot.slideId);
            if (slide && slide.type === 'normal') {
                slide.content = { ...slide.content, canvasItems: snapshot.canvasItems };
                slide.backgroundOverride = snapshot.background;
            }
        });

        const updatedPres = await db.presentationFiles.get(selectedPresentationId);
        if (updatedPres) {
            const updates: any = {};
            if (get().activePresentationId === selectedPresentationId) updates.activePresentation = updatedPres;
            if (get().selectedPresentationId === selectedPresentationId) updates.selectedPresentation = updatedPres;
            set(updates);
        }
    },

    redo: async () => {
        const { useHistoryStore } = await import('@/core/store/historyStore');
        const snapshot = useHistoryStore.getState().redo();
        if (!snapshot) return;

        const { selectedPresentationId } = get();
        if (!selectedPresentationId) return;

        await db.presentationFiles.where('id').equals(selectedPresentationId).modify(pres => {
            const slide = pres.slides.find(s => s.id === snapshot.slideId);
            if (slide && slide.type === 'normal') {
                slide.content = { ...slide.content, canvasItems: snapshot.canvasItems };
                slide.backgroundOverride = snapshot.background;
            }
        });

        const updatedPres = await db.presentationFiles.get(selectedPresentationId);
        if (updatedPres) {
            const updates: any = {};
            if (get().activePresentationId === selectedPresentationId) updates.activePresentation = updatedPres;
            if (get().selectedPresentationId === selectedPresentationId) updates.selectedPresentation = updatedPres;
            set(updates);
        }
    },

    takeSnapshot: async (slideId) => {
        const { useHistoryStore } = await import('@/core/store/historyStore');
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return;

        let pres = selectedPresentation;
        if (!pres || pres.id !== selectedPresentationId) {
            const active = get().activePresentation;
            if (active && active.id === selectedPresentationId) pres = active;
            else pres = await db.presentationFiles.get(selectedPresentationId) || null;
        }

        const slide = pres?.slides?.find(s => s.id === slideId);
        if (!slide || slide.type !== 'normal') return;

        useHistoryStore.getState().pushSnapshot({
            slideId,
            canvasItems: structuredClone(slide.content?.canvasItems || []),
            background: structuredClone(slide.backgroundOverride || [])
        });
    },
});
