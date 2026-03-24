import { db } from '@/core/db';
import { PresentationSliceCreator } from '../types';
import { ISlide, ICanvasSlide, IPresentationFile, IServiceFile } from '@/core/types';
import { toast } from '@/core/utils/toast';
import i18n from '@/core/i18n';

export const createSlideCrudSlice: PresentationSliceCreator = (set, get) => ({
    isSaving: false,
    lastTransitionTrigger: 0,

    createService: async (name) => {
        const serviceId = crypto.randomUUID();
        const now = new Date();
        const masterId = crypto.randomUUID();

        const newMaster: IPresentationFile = {
            id: masterId,
            name: `${name} (Master)`,
            serviceId: serviceId,
            isMaster: true,
            createdAt: now,
            updatedAt: now,
            lastOpened: now,
            slides: []
        };

        await db.presentationFiles.add(newMaster);

        const newService: IServiceFile = {
            id: serviceId,
            name,
            presentationIds: [masterId],
            masterPresentationId: masterId,
            createdAt: now,
            updatedAt: now,
            lastOpened: now
        };

        await db.serviceFiles.add(newService);
        await get().setActiveService(serviceId);
        await get().setActivePresentation(masterId);

        return serviceId;
    },

    createPresentation: async (name, options) => {
        const now = new Date();

        if (options?.isMaster && options.serviceId) {
            const existingMaster = await db.presentationFiles
                .where({ serviceId: options.serviceId, isMaster: true })
                .first();
            if (existingMaster) {
                toast.error(i18n.t('master_already_exists', 'A master presentation already exists for this service'));
                return existingMaster.id;
            }
        }

        const id = crypto.randomUUID();
        const newPresentation: IPresentationFile = {
            id,
            name,
            serviceId: options?.serviceId,
            isMaster: options?.isMaster,
            createdAt: now,
            updatedAt: now,
            lastOpened: now,
            slides: []
        };
        await db.presentationFiles.add(newPresentation);

        if (options?.serviceId) {
            const service = await db.serviceFiles.get(options.serviceId);
            if (service) {
                await db.serviceFiles.update(options.serviceId, {
                    presentationIds: [...service.presentationIds, id],
                    updatedAt: now
                });
                if (get().activeServiceId === options.serviceId) {
                    set({ activeService: { ...service, presentationIds: [...service.presentationIds, id], updatedAt: now } });
                }
            }
        }

        if (!options?.serviceId || options.isMaster) {
            await get().setActivePresentation(id);
        }
        return id;
    },

    renamePresentation: async (presentationId, newName) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (!pres || pres.isMaster) return;

        const now = new Date();
        await db.presentationFiles.update(presentationId, { name: newName, updatedAt: now });

        const { activePresentationId, activePresentation } = get();
        if (activePresentationId === presentationId && activePresentation) {
            set({ activePresentation: { ...activePresentation, name: newName, updatedAt: now } });
        }
        await get().loadRecents();
    },

    removePresentation: async (presentationId) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (!pres || pres.isMaster) return;

        const now = new Date();
        await db.presentationFiles.delete(presentationId);

        if (pres.serviceId) {
            const service = await db.serviceFiles.get(pres.serviceId);
            if (service) {
                const newIds = service.presentationIds.filter(id => id !== presentationId);
                await db.serviceFiles.update(pres.serviceId, { presentationIds: newIds, updatedAt: now });
                if (get().activeServiceId === pres.serviceId) {
                    set({ activeService: { ...service, presentationIds: newIds, updatedAt: now } });
                }
            }
        }

        if (get().activePresentationId === presentationId) {
            const service = pres.serviceId ? await db.serviceFiles.get(pres.serviceId) : null;
            if (service) {
                await get().setActivePresentation(service.masterPresentationId);
            } else {
                await get().setActivePresentation(null);
            }
        }
        await get().loadRecents();
    },

    updatePresentationSlides: async (presentationId, slides) => {
        const now = new Date();
        const { activePresentationId, activePresentation, selectedPresentationId, selectedPresentation } = get();
        const updates: any = {};

        if (activePresentationId === presentationId) {
            const basePres = activePresentation || { id: presentationId, name: '', slides: [], updatedAt: now } as any;
            updates.activePresentation = { ...basePres, slides, updatedAt: now };
        }

        if (selectedPresentationId === presentationId) {
            const basePres = selectedPresentation || { id: presentationId, name: '', slides: [], updatedAt: now } as any;
            updates.selectedPresentation = { ...basePres, slides, updatedAt: now };
        }

        if (Object.keys(updates).length > 0) {
            set(updates);
        }

        await db.presentationFiles.update(presentationId, {
            slides,
            updatedAt: now
        });
    },

    updateSlideBackground: async (slideId, background) => {
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
                return {
                    ...s,
                    backgroundOverride: background || undefined
                };
            }
            return s;
        });

        await get().updatePresentationSlides(selectedPresentationId, newSlides);
    },

    updateSlideTransition: async (slideId, transition) => {
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
            if (s.id === slideId) {
                return {
                    ...s,
                    transition
                };
            }
            return s;
        });

        await get().updatePresentationSlides(selectedPresentationId, newSlides);
    },

    updatePresentationEndTransition: async (transition) => {
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return;

        let pres = selectedPresentation;
        if (!pres || pres.id !== selectedPresentationId) {
            const active = get().activePresentation;
            if (active && active.id === selectedPresentationId) pres = active;
            else pres = await db.presentationFiles.get(selectedPresentationId) || null;
        }
        if (!pres) return;

        const updatedPres = {
            ...pres,
            endTransition: transition,
            updatedAt: new Date()
        };

        await db.presentationFiles.update(selectedPresentationId, {
            endTransition: transition,
            updatedAt: updatedPres.updatedAt
        });

        if (get().activePresentationId === selectedPresentationId) {
            set({ activePresentation: updatedPres });
        }
        if (get().selectedPresentationId === selectedPresentationId) {
            set({ selectedPresentation: updatedPres });
        }
    },

    triggerTransitionPreview: () => set({
        lastTransitionTrigger: Date.now(),
        navigationDirection: 'forward'
    }),

    applyBackgroundToAll: async (background) => {
        const { selectedPresentationId } = get();
        if (!selectedPresentationId) return;

        const pres = await db.presentationFiles.get(selectedPresentationId);
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.type === 'normal') {
                return {
                    ...s,
                    backgroundOverride: background
                };
            }
            return s;
        });

        await get().updatePresentationSlides(selectedPresentationId, newSlides);
    },

    saveActiveService: async () => {
        const { activeServiceId, activeService } = get();
        if (!activeServiceId || !activeService) return;

        set({ isSaving: true });
        try {
            const { EktService } = await import('../../services/ektService');
            if (activeService.fileHandle) {
                await EktService.save(activeServiceId);
            } else {
                const blob = await EktService.pack(activeServiceId);
                EktService.download(blob, activeService.name);
            }
        } catch (error) {
            console.error('Failed to save service:', error);
            throw error;
        } finally {
            set({ isSaving: false });
        }
    },

    duplicateSlide: async (presentationId, slideId) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (!pres) return;

        const slideIdx = pres.slides.findIndex(s => s.id === slideId);
        if (slideIdx === -1) return;

        await Promise.all(pres.slides.map(s => get().takeSnapshot(s.id)));

        const original = pres.slides[slideIdx];
        const newSlide: ISlide = {
            ...original,
            id: crypto.randomUUID(),
            order: slideIdx + 1,
            isExpanded: false,
        };

        if (newSlide.type === 'normal') {
            const canvasSlide = newSlide as ICanvasSlide;
            canvasSlide.content = {
                ...canvasSlide.content,
                canvasItems: (canvasSlide.content.canvasItems || []).map(item => ({
                    ...item,
                    id: crypto.randomUUID()
                }))
            };
        }

        const newSlides = [...pres.slides];
        newSlides.splice(slideIdx + 1, 0, newSlide);

        const ordered = newSlides.map((s, i) => ({ ...s, order: i }));
        await get().updatePresentationSlides(presentationId, ordered);

        if (presentationId === get().activePresentationId) {
            get().setPreviewSlide(newSlide.id, presentationId);
        }
    },

    duplicateSlides: async (presentationId, slideIds) => {
        if (slideIds.length === 0) return;
        const pres = await db.presentationFiles.get(presentationId);
        if (!pres) return;

        await Promise.all(pres.slides.map(s => get().takeSnapshot(s.id)));

        const newSlides = [...pres.slides];
        const createdSlideIds: string[] = [];

        const sortedSlideIds = [...slideIds].sort((a, b) => {
            return pres.slides.findIndex(s => s.id === a) - pres.slides.findIndex(s => s.id === b);
        });

        const sortedIndices = sortedSlideIds.map(id => pres.slides.findIndex(s => s.id === id)).sort((a, b) => a - b);
        const lastIdx = sortedIndices[sortedIndices.length - 1];
        let insertionIdx = lastIdx + 1;

        for (const slideId of sortedSlideIds) {
            const original = pres.slides.find(s => s.id === slideId);
            if (!original) continue;

            const newSlide: ISlide = JSON.parse(JSON.stringify(original));
            newSlide.id = crypto.randomUUID();
            newSlide.isExpanded = false;

            if (newSlide.type === 'normal' && newSlide.content && newSlide.content.canvasItems) {
                newSlide.content.canvasItems = newSlide.content.canvasItems.map(item => ({
                    ...item,
                    id: crypto.randomUUID()
                }));
            }

            newSlides.splice(insertionIdx, 0, newSlide);
            createdSlideIds.push(newSlide.id);
            insertionIdx++;
        }

        const ordered = newSlides.map((s, i) => ({ ...s, order: i }));
        await get().updatePresentationSlides(presentationId, ordered);
        set({ selectedSlideIds: createdSlideIds });

        if (presentationId === get().activePresentationId && createdSlideIds.length > 0) {
            get().setPreviewSlide(createdSlideIds[0], presentationId);
        }
    },

    moveSlide: async (presentationId, slideId, direction) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (!pres) return;

        const idx = pres.slides.findIndex(s => s.id === slideId);
        if (idx === -1) return;

        await Promise.all(pres.slides.map(s => get().takeSnapshot(s.id)));

        const newSlides = [...pres.slides];
        const [moved] = newSlides.splice(idx, 1);

        if (direction === 'back') {
            if (idx === 0) return;
            newSlides.splice(idx - 1, 0, moved);
        } else if (direction === 'forth') {
            if (idx === pres.slides.length - 1) return;
            newSlides.splice(idx + 1, 0, moved);
        } else if (direction === 'start') {
            newSlides.unshift(moved);
        } else if (direction === 'end') {
            newSlides.push(moved);
        }

        const ordered = newSlides.map((s, i) => ({ ...s, order: i }));
        await get().updatePresentationSlides(presentationId, ordered);
    },

    removeSlide: async (presentationId, slideId) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (!pres) return;

        await get().takeSnapshot(slideId);

        const newSlides = pres.slides.filter(s => s.id !== slideId).map((s, i) => ({ ...s, order: i }));
        await get().updatePresentationSlides(presentationId, newSlides);

        if (get().previewSlideId === slideId) {
            get().setPreviewSlide(null);
        }
        if (get().liveSlideId === slideId) {
            get().setLiveSlide(null);
        }
    },

    removeSlides: async (presentationId, slideIds) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (!pres) return;

        await Promise.all(slideIds.map(id => get().takeSnapshot(id)));

        const removeSet = new Set(slideIds);
        const newSlides = pres.slides
            .filter(s => !removeSet.has(s.id))
            .map((s, i) => ({ ...s, order: i }));

        await get().updatePresentationSlides(presentationId, newSlides);

        const { previewSlideId, liveSlideId } = get();
        if (previewSlideId && removeSet.has(previewSlideId)) {
            get().setPreviewSlide(null);
        }
        if (liveSlideId && removeSet.has(liveSlideId)) {
            get().setLiveSlide(null);
        }
        set({ selectedSlideIds: [] });
    },

    copySlides: (presentationId, slideIds, isCut) => {
        if (slideIds.length === 0) return;
        set({ clipboard: { presentationId, slideIds, isCut: !!isCut } });
        toast.success(isCut ? i18n.t('slides_cut', 'Slides cut to clipboard') : i18n.t('slides_copied', 'Slides copied to clipboard'));
    },

    pasteSlides: async (presentationId, targetIndex) => {
        const { clipboard } = get();
        if (!clipboard || clipboard.slideIds.length === 0) return;

        const sourcePres = await db.presentationFiles.get(clipboard.presentationId);
        const targetPres = await db.presentationFiles.get(presentationId);
        if (!sourcePres || !targetPres) return;

        const slidesToPaste = sourcePres.slides.filter(s => clipboard.slideIds.includes(s.id));
        if (slidesToPaste.length === 0) return;

        const newSlidesToInsert: ISlide[] = slidesToPaste.map(s => {
            const cloned: ISlide = JSON.parse(JSON.stringify(s));
            cloned.id = crypto.randomUUID();
            if (cloned.type === 'normal' && cloned.content && cloned.content.canvasItems) {
                cloned.content.canvasItems = cloned.content.canvasItems.map(item => ({
                    ...item,
                    id: crypto.randomUUID()
                }));
            }
            return cloned;
        });

        const updatedTargetSlides = [...targetPres.slides];
        const pasteIdx = targetIndex !== undefined ? targetIndex : updatedTargetSlides.length;
        updatedTargetSlides.splice(pasteIdx, 0, ...newSlidesToInsert);

        const ordered = updatedTargetSlides.map((s, i) => ({ ...s, order: i }));
        await get().updatePresentationSlides(presentationId, ordered);

        if (clipboard.isCut) {
            await get().removeSlides(clipboard.presentationId, clipboard.slideIds);
            set({ clipboard: null });
        }

        set({ selectedSlideIds: newSlidesToInsert.map(s => s.id) });
        if (presentationId === get().activePresentationId) {
            get().setPreviewSlide(newSlidesToInsert[0].id, presentationId);
        }

        toast.success(i18n.t('slides_pasted', 'Slides pasted'));
    },

    toggleSlideExpansion: async (slideId) => {
        const { activePresentationId, activePresentation } = get();
        if (!activePresentationId || !activePresentation) return;

        const newSlides = activePresentation.slides.map(s => {
            if (s.id === slideId) {
                return { ...s, isExpanded: !s.isExpanded };
            }
            return s;
        });

        await get().updatePresentationSlides(activePresentationId, newSlides);
    },

    detachNestedInstance: async (slideId) => {
        const { activePresentationId, activePresentation } = get();
        if (!activePresentationId || !activePresentation) return;

        const slideIndex = activePresentation.slides.findIndex(s => s.id === slideId);
        if (slideIndex === -1) return;

        const slide = activePresentation.slides[slideIndex];
        if (slide.type !== 'normal') return;
        if (!slide.linkedPresentationId && !slide.masterPresentationId) return;

        const newSlides = [...activePresentation.slides];
        newSlides[slideIndex] = {
            ...slide,
            localNestedPresentationId: slide.linkedPresentationId || slide.masterPresentationId,
            linkedPresentationId: undefined,
            masterPresentationId: undefined
        } as any;

        await get().updatePresentationSlides(activePresentationId, newSlides);
    },

    saveActivePresentation: async () => {
        const { activePresentationId, activePresentation } = get();
        if (!activePresentationId || !activePresentation) return;
        set({ isSaving: true });
        try {
            await db.presentationFiles.update(activePresentationId, {
                slides: activePresentation.slides,
                updatedAt: new Date()
            });
        } finally {
            set({ isSaving: false });
        }
    },

    importSlidesToService: async (presentationName, slides) => {
        const { activeServiceId } = get();
        if (!activeServiceId) {
            toast.error(i18n.t('no_active_service', 'No active service available'));
            return;
        }

        const newPresId = await get().createPresentation(presentationName, { serviceId: activeServiceId });
        const processedSlides = slides.map((s, i) => ({
            ...s,
            id: crypto.randomUUID(),
            order: i
        }));

        await get().updatePresentationSlides(newPresId, processedSlides);
        toast.success(i18n.t('slides_imported_to_service', 'Slides imported successfully'));
    },

    addPresentationToTimeline: async (presentationId, index) => {
        const { activePresentationId, activePresentation, activeServiceId } = get();
        if (!activePresentationId || !activePresentation || !activeServiceId) return;

        const libraryPres = await db.presentationFiles.get(presentationId);
        if (!libraryPres) return;

        try {
            const snapshotPresId = await get().createPresentation(`${libraryPres.name} (Snapshot)`, { serviceId: activeServiceId });
            
            const processedSlides = libraryPres.slides.map((s, i) => ({
                ...s,
                id: crypto.randomUUID(),
                order: i
            }));
            await get().updatePresentationSlides(snapshotPresId, processedSlides);

            const newSlide: ISlide = {
                id: crypto.randomUUID(),
                type: 'normal',
                order: 0, 
                blockId: 'master-presentation',
                templateId: 'default',
                content: { variables: {} },
                masterPresentationId: snapshotPresId,
                linkedPresentationId: presentationId,
                lastSyncedAt: libraryPres.updatedAt ? new Date(libraryPres.updatedAt).toISOString() : new Date().toISOString(),
                isExpanded: true
            } as any;

            const updatedSlides = [...activePresentation.slides];
            const insertIdx = index !== undefined ? index : updatedSlides.length;
            updatedSlides.splice(insertIdx, 0, newSlide);

            const ordered = updatedSlides.map((s, i) => ({ ...s, order: i }));
            await get().updatePresentationSlides(activePresentationId, ordered);

            get().setSelectedSlideIds([newSlide.id]);
            get().setPreviewSlide(newSlide.id, activePresentationId);

            toast.success(i18n.t('presentation_added_to_timeline', 'Presentation added to timeline'));
        } catch (err) {
            console.error('[addPresentationToTimeline] ERROR', err);
        }
    },

    syncNestedPresentation: async (parentSlideId) => {
        const { activePresentationId, activePresentation } = get();
        if (!activePresentationId || !activePresentation) return;

        const parentSlide = activePresentation.slides.find(s => s.id === parentSlideId);
        if (!parentSlide || parentSlide.type !== 'normal' || !parentSlide.linkedPresentationId || !parentSlide.masterPresentationId) return;

        const libraryPres = await db.presentationFiles.get(parentSlide.linkedPresentationId);
        if (!libraryPres) {
            toast.error(i18n.t('library_presentation_not_found', 'Library presentation not found'));
            return;
        }

        const processedSlides = libraryPres.slides.map((s, i) => ({
            ...s,
            id: crypto.randomUUID(),
            order: i
        }));
        await get().updatePresentationSlides(parentSlide.masterPresentationId, processedSlides);

        const updatedSlides = activePresentation.slides.map(s => {
            if (s.id === parentSlideId) {
                return {
                    ...s,
                    lastSyncedAt: libraryPres.updatedAt.toISOString()
                };
            }
            return s;
        });

        await get().updatePresentationSlides(activePresentationId, updatedSlides);
        toast.success(i18n.t('nested_presentation_synced', 'Nested presentation synced'));
    },

    saveNestedChanges: async (options) => {
        const { syncBack } = options;
    },
});
