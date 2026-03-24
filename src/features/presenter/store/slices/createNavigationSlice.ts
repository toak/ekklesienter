import { db } from '@/core/db';
import { PresentationSliceCreator } from '../types';
import { IPresentationSummary } from '@/core/types';

export const createNavigationSlice: PresentationSliceCreator = (set, get) => ({
    activeServiceId: null,
    activePresentationId: null,
    selectedPresentationId: null,
    previewSlideId: null,
    liveSlideId: null,
    activeBlockId: null,
    selectedAudioScopeId: null,
    graceLibSection: null,
    graceLibMediaBins: [],
    templateNavPath: [{ id: 'root', type: 'root', name: 'Templates' }],
    presentationBinNavPath: [],
    selectedSlideIds: [],
    clipboard: null,
    presentationStack: [],

    activeService: null,
    activePresentation: null,
    selectedPresentation: null,
    cachedPresentation: null,
    recents: [],
    navigationParentSlideId: null,
    navigationDirection: 'forward',

    setActiveService: async (id) => {
        if (!id) {
            set({ activeServiceId: null, activeService: null, activePresentationId: null, activePresentation: null });
            return;
        }

        const service = await db.serviceFiles.get(id);
        if (service) {
            const now = new Date();
            await db.serviceFiles.update(id, { lastOpened: now });
            set({ activeServiceId: id, activeService: { ...service, lastOpened: now } });

            await get().setActivePresentation(service.masterPresentationId);
            await get().loadRecents();
        }
    },

    setActivePresentation: async (id) => {
        const { activePresentationId, activePresentation } = get();
        if (id === activePresentationId) return;

        if (activePresentation) {
            set({ cachedPresentation: activePresentation });
        }

        if (!id) {
            set({ activePresentationId: null, activePresentation: null, previewSlideId: null });
            return;
        }

        const pres = await db.presentationFiles.get(id);
        if (pres) {
            const now = new Date();
            await db.presentationFiles.update(id, { lastOpened: now });

            set({
                activePresentationId: id,
                selectedPresentationId: id,
                activePresentation: { ...pres, lastOpened: now },
                selectedPresentation: { ...pres, lastOpened: now },
                previewSlideId: pres.slides.length > 0 ? pres.slides[0].id : null,
                liveSlideId: null,
                presentationStack: []
            });

            await get().loadRecents();
        }
    },

    setPreviewSlide: async (id, presentationId) => {
        const { activePresentationId, activePresentation, selectedPresentationId, presentationStack } = get();
        let targetPresId = presentationId || activePresentationId;

        const currentPres = (targetPresId === activePresentationId && activePresentation)
            ? activePresentation
            : await db.presentationFiles.get(targetPresId || '');

        // SPECIAL: Auto-enter nested presentation if we selected a nested Slide from the timeline
        if (currentPres && id) {
            const slide = currentPres.slides.find(s => s.id === id);
            if (slide?.type === 'nested' || (slide as any)?.masterPresentationId) {
                const childId = (slide as any).presentationId || (slide as any).masterPresentationId;
                if (childId) {
                    const nestedPres = await db.presentationFiles.get(childId);
                    if (nestedPres && nestedPres.slides.length > 0) {
                        const { navigationDirection } = get();
                        
                        set({
                            presentationStack: [...presentationStack, { 
                                presentationId: currentPres.id,
                                parentNestedSlideId: id
                            }]
                        });

                        // If moving backward, enter at the end. Otherwise enter at start.
                        const entryIdx = navigationDirection === 'backward' ? nestedPres.slides.length - 1 : 0;
                        
                        set({
                            previewSlideId: nestedPres.slides[entryIdx].id,
                            selectedPresentationId: nestedPres.id,
                            selectedPresentation: nestedPres,
                            navigationParentSlideId: id
                        });
                        return;
                    }
                }
            }
        }

        if (targetPresId === activePresentationId) {
            set({ navigationParentSlideId: null });
        }

        if (targetPresId && targetPresId !== selectedPresentationId) {
            const pres = await db.presentationFiles.get(targetPresId);
            if (pres) {
                set({
                    previewSlideId: id,
                    selectedPresentationId: targetPresId,
                    selectedPresentation: pres,
                    navigationDirection: 'forward'
                });
                return;
            }
        }

        set({
            previewSlideId: id,
            selectedPresentationId: targetPresId,
            navigationDirection: 'forward'
        });
    },

    setLiveSlide: (id) => set({ liveSlideId: id }),

    syncPreviewToLive: () => {
        const { liveSlideId, activePresentationId, activePresentation } = get();
        if (liveSlideId) {
            set({
                previewSlideId: liveSlideId,
                selectedPresentationId: activePresentationId,
                selectedPresentation: activePresentation
            });
        }
    },

    loadRecents: async () => {
        const presentations = await db.presentationFiles.orderBy('lastOpened').reverse().limit(10).toArray();
        const services = await db.serviceFiles.orderBy('lastOpened').reverse().limit(10).toArray();

        const summaries: IPresentationSummary[] = [
            ...presentations.map(p => ({
                id: p.id,
                name: p.name,
                lastOpened: p.lastOpened || p.updatedAt,
                type: 'presentation' as const
            })),
            ...services.map(s => ({
                id: s.id,
                name: s.name,
                lastOpened: s.lastOpened || s.updatedAt,
                type: 'service' as const
            }))
        ].sort((a, b) => new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime()).slice(0, 10);

        set({ recents: summaries });
    },

    navigateNext: async (detached = false) => {
        const { activePresentationId, selectedPresentationId, previewSlideId, setPreviewSlide, setLiveSlide, liveSlideId, activePresentation, presentationStack } = get();
        if (!activePresentationId) return;

        const currentPresId = selectedPresentationId || activePresentationId;
        
        const presentation = (activePresentation && activePresentation.id === currentPresId)
            ? activePresentation
            : await db.presentationFiles.get(currentPresId);

        if (!presentation || !presentation.slides.length) return;

        const slides = presentation.slides;
        const currentId = previewSlideId || slides[0].id;
        const idx = slides.findIndex(s => s.id === currentId);

        if (idx === slides.length - 1) {
            if (presentationStack.length > 0) {
                const stack = [...presentationStack];
                const lastState = stack.pop()!;
                
                set({ presentationStack: stack, navigationDirection: 'forward' });
                
                const parentPres = await db.presentationFiles.get(lastState.presentationId);
                if (parentPres) {
                    const parentIdx = parentPres.slides.findIndex(s => s.id === lastState.parentNestedSlideId);
                    if (parentIdx !== -1) {
                        const nextIdx = Math.min(parentPres.slides.length - 1, parentIdx + 1);
                        set({ 
                            previewSlideId: parentPres.slides[nextIdx].id,
                            selectedPresentationId: parentPres.id,
                            selectedPresentation: parentPres,
                            navigationDirection: 'forward',
                            navigationParentSlideId: null
                        });
                        if (!detached && liveSlideId) setLiveSlide(get().previewSlideId); 
                        return;
                    }
                }
            }
        }

        const nextIdx = Math.min(slides.length - 1, idx + 1);
        const nextId = slides[nextIdx].id;

        set({ navigationDirection: 'forward' });
        await setPreviewSlide(nextId, currentPresId);
        if (!detached && liveSlideId) setLiveSlide(get().previewSlideId);
    },

    navigatePrev: async (detached = false) => {
        const { activePresentationId, selectedPresentationId, previewSlideId, setPreviewSlide, setLiveSlide, liveSlideId, activePresentation, presentationStack } = get();
        if (!activePresentationId) return;

        const currentPresId = selectedPresentationId || activePresentationId;
        
        const presentation = (activePresentation && activePresentation.id === currentPresId)
            ? activePresentation
            : await db.presentationFiles.get(currentPresId);

        if (!presentation || !presentation.slides.length) return;

        const slides = presentation.slides;
        const currentId = previewSlideId || slides[0].id;
        const idx = slides.findIndex(s => s.id === currentId);

        if (idx === 0) {
            if (presentationStack.length > 0) {
                const stack = [...presentationStack];
                const lastState = stack.pop()!;
                
                set({ presentationStack: stack, navigationDirection: 'backward' });
                
                const parentPres = await db.presentationFiles.get(lastState.presentationId);
                if (parentPres) {
                    const parentIdx = parentPres.slides.findIndex(s => s.id === lastState.parentNestedSlideId);
                    if (parentIdx !== -1) {
                        const prevIdx = Math.max(0, parentIdx - 1);
                        set({ 
                            previewSlideId: parentPres.slides[prevIdx].id,
                            selectedPresentationId: parentPres.id,
                            selectedPresentation: parentPres,
                            navigationDirection: 'backward',
                            navigationParentSlideId: null
                        });
                        if (!detached && liveSlideId) setLiveSlide(get().previewSlideId);
                        return;
                    }
                }
            }
        }

        const prevIdx = Math.max(0, idx - 1);
        const prevId = slides[prevIdx].id;

        set({ navigationDirection: 'backward' });
        await setPreviewSlide(prevId, currentPresId);
        if (!detached && liveSlideId) setLiveSlide(get().previewSlideId);
    },

    setActiveBlockId: (id) => set({ activeBlockId: id, graceLibSection: id ? 'templates' : get().graceLibSection }),
    setGraceLibSection: (section) => set({
        graceLibSection: section,
        activeBlockId: section === 'templates' ? get().activeBlockId : null,
        templateNavPath: section === 'templates' ? [{ id: 'root', type: 'root', name: 'Templates' }] : []
    }),
    
    setSelectedSlideIds: (ids) => set({ selectedSlideIds: ids }),
    toggleSlideSelection: (id, multi, range) => {
        const { selectedSlideIds, activePresentation } = get();
        if (!activePresentation) return;

        if (range) {
            const { previewSlideId } = get();
            const anchorId = selectedSlideIds.length > 0 
                ? selectedSlideIds[selectedSlideIds.length - 1] 
                : previewSlideId;

            if (!anchorId) {
                set({ selectedSlideIds: [id] });
                return;
            }

            const lastIdx = activePresentation.slides.findIndex(s => s.id === anchorId);
            const currentIdx = activePresentation.slides.findIndex(s => s.id === id);

            if (lastIdx !== -1 && currentIdx !== -1) {
                const start = Math.min(lastIdx, currentIdx);
                const end = Math.max(lastIdx, currentIdx);
                const rangeIds = activePresentation.slides.slice(start, end + 1).map(s => s.id);

                const newSelected = Array.from(new Set([...selectedSlideIds, ...rangeIds]));
                set({ selectedSlideIds: newSelected });
                return;
            }
        }

        if (multi) {
            const newSelected = selectedSlideIds.includes(id)
                ? selectedSlideIds.filter(sid => sid !== id)
                : [...selectedSlideIds, id];
            set({ selectedSlideIds: newSelected });
        } else {
            set({ selectedSlideIds: [id] });
        }
    },
    clearSelection: () => set({ selectedSlideIds: [] }),
});
