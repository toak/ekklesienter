import { describe, it, expect, vi } from 'vitest';
import { createTemplateSlice } from './createTemplateSlice';

describe('createTemplateSlice', () => {
    it('should define templates mapping state', () => {
        const mockSet = vi.fn();
        const mockGet = vi.fn();
        const slice = createTemplateSlice(mockSet, mockGet as any, {} as any);
        expect(slice.pushTemplateNav).toBeDefined();
        expect(slice.updateTemplate).toBeDefined();
    });
});
