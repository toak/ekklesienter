import { describe, it, expect } from 'vitest';
import { useLoadingStore } from './loadingStore';

describe('loadingStore', () => {
    it('should trigger loading status states', () => {
        expect(useLoadingStore.getState().isLoaded).toBe(false);
        expect(useLoadingStore.getState().phase).toBe('starting');
        expect(useLoadingStore.getState().progress).toBe(0);

        useLoadingStore.getState().setPhase('database');
        useLoadingStore.getState().setProgress(50);
        useLoadingStore.getState().setLoaded(true);

        expect(useLoadingStore.getState().isLoaded).toBe(true);
        expect(useLoadingStore.getState().phase).toBe('database');
        expect(useLoadingStore.getState().progress).toBe(50);
    });
});

