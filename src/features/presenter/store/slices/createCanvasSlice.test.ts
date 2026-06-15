import { describe, it, expect, vi } from 'vitest';
import { createCanvasSlice } from './createCanvasSlice';

describe('createCanvasSlice', () => {
    it('should initialize selected canvas element lists', () => {
        const mockSet = vi.fn();
        const mockGet = vi.fn();
        const slice = createCanvasSlice(mockSet, mockGet as any, {} as any);
        expect(slice.addCanvasItem).toBeDefined();
    });
});
