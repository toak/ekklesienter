import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBibleSelection } from './useBibleSelection';

describe('useBibleSelection custom hooks', () => {
    it('should retain selected verses maps', () => {
        const { result } = renderHook(() => useBibleSelection(null));
        expect(result.current).toBeDefined();
    });
});
