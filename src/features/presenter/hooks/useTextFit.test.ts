import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTextFit } from './useTextFit';

describe('useTextFit text bounding constraints', () => {
    it('should calculate fit configurations', () => {
        const mockProps = {
            containerRef: { current: null },
            textRef: { current: null },
            resizingMode: 'shrink-to-fit',
            originalFontSize: 16,
            content: 'Text',
        };
        const { result } = renderHook(() => useTextFit(mockProps));
        expect(result.current).toBeDefined();
    });
});
