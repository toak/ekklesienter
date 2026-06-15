import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIntersection } from './useIntersection';

describe('useIntersection visibility tracking', () => {
    it('should instantiate intersection tracker', () => {
        const mockRef = { current: document.createElement('div') };
        const { result } = renderHook(() => useIntersection(mockRef, {}));
        expect(result.current).toBeUndefined();
    });
});

