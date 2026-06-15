import { describe, it, expect, vi } from 'vitest';
import { createSlideDesignSlice } from './createSlideDesignSlice';

describe('createSlideDesignSlice', () => {
    it('should default slide design configurations', () => {
        const mockSet = vi.fn();
        const mockGet = vi.fn();
        const slice = createSlideDesignSlice(mockSet, mockGet as any, {} as any);
        expect(slice.lastTransitionTrigger).toBe(0);
        expect(slice.updateSlideBackground).toBeDefined();
    });
});
