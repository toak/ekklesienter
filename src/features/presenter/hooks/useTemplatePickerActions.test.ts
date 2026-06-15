import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTemplatePickerActions } from './useTemplatePickerActions';

describe('useTemplatePickerActions template controllers', () => {
    it('should resolve template modifications handlers', () => {
        const mockParams = {
            isDev: false,
            allTemplates: [],
            allBlocks: [],
            blocksMap: new Map(),
            currentSlide: undefined,
            currentBlock: undefined,
            refreshNavTemplate: vi.fn(),
            pushNav: vi.fn(),
            popNav: vi.fn(),
            currentView: { type: 'template' }
        };
        const { result } = renderHook(() => useTemplatePickerActions(mockParams as any));
        expect(result.current).toBeDefined();
    });
});
