import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useThrottle } from './useThrottle';

describe('useThrottle custom hook', () => {
    it('should throttle callback function calls', () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useThrottle(callback, 300));
        
        result.current();
        result.current();
        
        expect(callback).toHaveBeenCalledTimes(1);
    });
});

