import { create } from 'zustand';

export type LoadingPhase = 'starting' | 'database' | 'templates' | 'fonts' | 'ready' | 'complete';

interface LoadingState {
  phase: LoadingPhase;
  progress: number;
  isLoaded: boolean;
  setPhase: (phase: LoadingPhase) => void;
  setProgress: (progress: number) => void;
  setLoaded: (loaded: boolean) => void;
}

/**
 * Global store to track application initialization progress.
 * Orchestrated by useAppInitialization.
 */
export const useLoadingStore = create<LoadingState>((set) => ({
  phase: 'starting',
  progress: 0,
  isLoaded: false,
  setPhase: (phase) => set({ phase }),
  setProgress: (progress) => set({ progress }),
  setLoaded: (isLoaded) => set({ isLoaded }),
}));
