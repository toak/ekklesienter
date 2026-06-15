import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCanvasInteraction } from './useCanvasInteraction';

vi.mock('@/features/presenter/store/presentationStore', () => ({
    usePresentationStore: Object.assign(
        (selector: any) => selector({
            updateCanvasItem: vi.fn(),
            updateCanvasItemsOrder: vi.fn(),
            takeSnapshot: vi.fn().mockResolvedValue(undefined),
        }),
        {
            getState: () => ({
                updateCanvasItem: vi.fn(),
                updateCanvasItemsOrder: vi.fn(),
                takeSnapshot: vi.fn().mockResolvedValue(undefined),
            }),
            setState: vi.fn(),
        }
    )
}));

describe('useCanvasInteraction hook', () => {
    it('should initialize successfully', () => {
        const localItems = [
            { id: 'item-1', x: 10, y: 10, width: 20, height: 20, zIndex: 0, locked: false, type: 'shape' }
        ];
        const setLocalItems = vi.fn();
        const getContainerRect = vi.fn(() => ({ left: 0, top: 0, width: 100, height: 100 }));

        const { result } = renderHook(() => useCanvasInteraction(
            'slide-1',
            localItems as any,
            setLocalItems,
            getContainerRect
        ));

        expect(result.current.handleMouseDown).toBeDefined();
        expect(result.current.selectedIds).toBeDefined();
    });
});
