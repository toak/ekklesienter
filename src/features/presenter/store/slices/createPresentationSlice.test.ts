import { describe, it, expect, vi } from 'vitest';
import { createPresentationSlice } from './createPresentationSlice';

describe('createPresentationSlice', () => {
    it('should default presentation files state', () => {
        const mockSet = vi.fn();
        const mockGet = vi.fn();
        const slice = createPresentationSlice(mockSet, mockGet as any, {} as any);
        expect(slice.isSaving).toBe(false);
        expect(slice.createService).toBeDefined();
    });
});
