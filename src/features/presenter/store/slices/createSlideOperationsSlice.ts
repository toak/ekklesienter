import { db } from '@/core/db';
import { PresentationSliceCreator } from '../types';
import { ISlide, ICanvasSlide } from '@/core/types';
import { toast } from '@/core/utils/toast';
import i18n from '@/core/i18n';

export const createSlideOperationsSlice: PresentationSliceCreator = (set, get) => ({
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

    duplicateSlide: async (presentationId, slideId) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (!pres) return;

        const slideIdx = pres.slides.findIndex(s => s.id === slideId);
        if (slideIdx === -1) return;

        await Promise.all(pres.slides.map(s => get().takeSnapshot(s.id)));

        const original = pres.slides[slideIdx];
        const newId = crypto.randomUUID();
        const newSlide: ISlide = {
            ...original,
            id: newId,
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

        // Duplicate associated audio scopes
        const scopes = await db.audioScopes.where({ startSlideId: slideId }).toArray();
        for (const scope of scopes) {
            const length = pres.slides.findIndex(s => s.id === scope.endSlideId) - pres.slides.findIndex(s => s.id === scope.startSlideId);
            const targetEndIdx = (slideIdx + 1) + (length > 0 ? length : 0);
            const finalEndIdx = Math.min(newSlides.length - 1, targetEndIdx);
            
            await db.audioScopes.add({
                ...structuredClone(scope),
                id: crypto.randomUUID(),
                startSlideId: newId,
                endSlideId: newSlides[finalEndIdx].id
            });
        }

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
        const slideIdMap = new Map<string, string>();

        const sortedIndices = slideIds.map(id => pres.slides.findIndex(s => s.id === id)).sort((a, b) => a - b);
        const lastIdx = sortedIndices[sortedIndices.length - 1];
        let insertionIdx = lastIdx + 1;

        // Collect scopes to potentially duplicate
        const allScopes = await db.audioScopes.where('presentationId').equals(presentationId).toArray();

        for (const slideId of slideIds.sort((a, b) => pres.slides.findIndex(s => s.id === a) - pres.slides.findIndex(s => s.id === b))) {
            const original = pres.slides.find(s => s.id === slideId);
            if (!original) continue;

            const newId = crypto.randomUUID();
            slideIdMap.set(slideId, newId);
            const newSlide: ISlide = structuredClone(original);
            newSlide.id = newId;
            newSlide.isExpanded = false;

            if (newSlide.type === 'normal' && newSlide.content && newSlide.content.canvasItems) {
                newSlide.content.canvasItems = newSlide.content.canvasItems.map((item: any) => ({
                    ...item,
                    id: crypto.randomUUID()
                }));
            }

            newSlides.splice(insertionIdx, 0, newSlide);
            createdSlideIds.push(newSlide.id);
            insertionIdx++;
        }

        // Duplicate audio scopes that start on duplicated slides
        for (const slideId of slideIdMap.keys()) {
            const scopes = allScopes.filter(s => s.startSlideId === slideId);
            for (const scope of scopes) {
                const startIdx = pres.slides.findIndex(s => s.id === scope.startSlideId);
                const endIdx = pres.slides.findIndex(s => s.id === scope.endSlideId);
                const length = endIdx - startIdx;
                
                const newStartId = slideIdMap.get(slideId)!;
                // If the end slide is also being duplicated, link it to the new end slide
                // Otherwise, link it by distance in the NEW total list
                let newEndId: string;
                if (slideIdMap.has(scope.endSlideId)) {
                    newEndId = slideIdMap.get(scope.endSlideId)!;
                } else {
                    const newStartInTotal = newSlides.findIndex(s => s.id === newStartId);
                    const targetEndInTotal = Math.min(newSlides.length - 1, newStartInTotal + length);
                    newEndId = newSlides[targetEndInTotal].id;
                }

                await db.audioScopes.add({
                    ...structuredClone(scope),
                    id: crypto.randomUUID(),
                    startSlideId: newStartId,
                    endSlideId: newEndId
                });
            }
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

        // Fetch related audio scopes from source
        const sourceScopes = await db.audioScopes.where('presentationId').equals(clipboard.presentationId).toArray();
        const relatedScopes = sourceScopes.filter(s => clipboard.slideIds.includes(s.startSlideId));

        const slideIdMap = new Map<string, string>();
        const newSlidesToInsert: ISlide[] = slidesToPaste.map(s => {
            const cloned: ISlide = structuredClone(s);
            const newId = crypto.randomUUID();
            slideIdMap.set(s.id, newId);
            cloned.id = newId;
            if (cloned.type === 'normal' && cloned.content && cloned.content.canvasItems) {
                cloned.content.canvasItems = cloned.content.canvasItems.map((item: any) => ({
                    ...item,
                    id: crypto.randomUUID()
                }));
            }
            return cloned;
        });

        const updatedTargetSlides = [...targetPres.slides];
        const pasteIdx = targetIndex !== undefined ? targetIndex : updatedTargetSlides.length;
        updatedTargetSlides.splice(pasteIdx, 0, ...newSlidesToInsert);

        // Paste audio scopes
        for (const scope of relatedScopes) {
            const startIdx = sourcePres.slides.findIndex(s => s.id === scope.startSlideId);
            const endIdx = sourcePres.slides.findIndex(s => s.id === scope.endSlideId);
            const length = endIdx - startIdx;

            const newStartId = slideIdMap.get(scope.startSlideId)!;
            let newEndId: string;

            if (slideIdMap.has(scope.endSlideId)) {
                newEndId = slideIdMap.get(scope.endSlideId)!;
            } else {
                const newStartIdxInTarget = updatedTargetSlides.findIndex(s => s.id === newStartId);
                const targetEndIdxInTarget = Math.min(updatedTargetSlides.length - 1, newStartIdxInTarget + length);
                newEndId = updatedTargetSlides[targetEndIdxInTarget].id;
            }

            await db.audioScopes.add({
                ...structuredClone(scope),
                id: crypto.randomUUID(),
                presentationId,
                startSlideId: newStartId,
                endSlideId: newEndId
            });
        }

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
});
