import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMetadata } from './useMetadata';

describe('useMetadata presentation inspector', () => {
    it('should inspect meta attributes lists', () => {
        const { result } = renderHook(() => useMetadata());
        expect(result.current).toBeDefined();
    });
});
