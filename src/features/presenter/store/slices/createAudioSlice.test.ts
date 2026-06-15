import { describe, it, expect, vi } from 'vitest';
import { createAudioSlice } from './createAudioSlice';

describe('createAudioSlice', () => {
    it('should initialize default properties', () => {
        const mockSet = vi.fn();
        const mockGet = vi.fn().mockReturnValue({ audioDevices: [] });
        const slice = createAudioSlice(mockSet, mockGet as any, {} as any);
        expect(slice.addAudioScope).toBeDefined();
        expect(slice.removeAudioScope).toBeDefined();
    });
});
