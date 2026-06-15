import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTextFit } from './useTextFit';

class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

describe('useTextFit resizing font sizes', () => {
    it('should return safe scaling ratios', () => {
        const mockContainer = document.createElement('div');
        Object.defineProperty(mockContainer, 'clientWidth', { value: 200, configurable: true });
        Object.defineProperty(mockContainer, 'clientHeight', { value: 100, configurable: true });
        
        const containerRef = { current: mockContainer };
        const { result } = renderHook(() => useTextFit({
            text: 'Sample text',
            containerRef
        }));
        expect(result.current).toBeDefined();
        expect(result.current.fontSize).toBeDefined();
    });
});


