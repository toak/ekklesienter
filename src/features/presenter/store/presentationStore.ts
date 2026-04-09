import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PresentationState } from './types';
import { createNavigationSlice } from './slices/createNavigationSlice';
import { createPresentationSlice } from './slices/createPresentationSlice';
import { createSlideOperationsSlice } from './slices/createSlideOperationsSlice';
import { createSlideDesignSlice } from './slices/createSlideDesignSlice';
import { createNestedPresentationSlice } from './slices/createNestedPresentationSlice';
import { createCanvasSlice } from './slices/createCanvasSlice';
import { createTemplateSlice } from './slices/createTemplateSlice';
import { createAudioSlice } from './slices/createAudioSlice';

export const usePresentationStore = create<PresentationState>()(
    persist(
        (set, get, store) => ({
            ...createNavigationSlice(set, get, store),
            ...createPresentationSlice(set, get, store),
            ...createSlideOperationsSlice(set, get, store),
            ...createSlideDesignSlice(set, get, store),
            ...createNestedPresentationSlice(set, get, store),
            ...createCanvasSlice(set, get, store),
            ...createTemplateSlice(set, get, store),
            ...createAudioSlice(set, get, store),
        } as PresentationState),
        {
            name: 'presentation-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                activeServiceId: state.activeServiceId,
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
