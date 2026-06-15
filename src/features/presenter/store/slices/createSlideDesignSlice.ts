import { db } from '@/core/db';
import { PresentationSliceCreator } from '../types';

export const createSlideDesignSlice: PresentationSliceCreator = (set, get) => ({
    lastTransitionTrigger: 0,

    updateSlideBackground: async (slideId, background) => {
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return;
        await get().takeSnapshot(selectedPresentationId);

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

        await get().takeSnapshot(selectedPresentationId);

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
});
