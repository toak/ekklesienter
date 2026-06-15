import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useContainFit } from './useContainFit';

describe('useContainFit layout constraints', () => {
    it('should return fitting width and scale ratios', () => {
        const { result } = renderHook(() => useContainFit(16 / 9, 24));
        expect(result.current).toHaveProperty('width');
        expect(result.current).toHaveProperty('height');
    });
});

