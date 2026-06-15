import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSlideDisplayData } from './useSlideDisplayData';

describe('useSlideDisplayData formatting custom hook', () => {
    it('should load slide details', () => {
        const { result } = renderHook(() => useSlideDisplayData({}));
        expect(result.current).toBeDefined();
    });
});
