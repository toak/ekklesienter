import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PresentationState } from './types';
import { createNavigationSlice } from './slices/createNavigationSlice';
import { createSlideCrudSlice } from './slices/createSlideCrudSlice';
import { createCanvasSlice } from './slices/createCanvasSlice';
import { createTemplateSlice } from './slices/createTemplateSlice';
import { createAudioSlice } from './slices/createAudioSlice';

export const usePresentationStore = create<PresentationState>()(
    persist(
        (set, get, store) => ({
            ...createNavigationSlice(set, get, store),
            ...createSlideCrudSlice(set, get, store),
            ...createCanvasSlice(set, get, store),
            ...createTemplateSlice(set, get, store),
            ...createAudioSlice(set, get, store),
        } as PresentationState),
        {
            name: 'presentation-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                activePresentationId: state.activePresentationId,
                selectedPresentationId: state.selectedPresentationId,
                previewSlideId: state.previewSlideId,
                activeBlockId: state.activeBlockId,
                presentationBinNavPath: state.presentationBinNavPath,
            }),
        }
    )
);

export type { PresentationState };
