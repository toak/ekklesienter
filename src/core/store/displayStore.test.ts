import { describe, it, expect } from 'vitest';
import { useDisplayStore } from './displayStore';

describe('displayStore configuration settings', () => {
    it('should manage screen resolutions and scale state', () => {
        expect(useDisplayStore.getState().aspectRatio).toBe(16 / 9);
        useDisplayStore.getState().setAspectRatio(4 / 3);
        expect(useDisplayStore.getState().aspectRatio).toBe(4 / 3);
    });
});

