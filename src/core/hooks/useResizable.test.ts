import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResizable } from './useResizable';

describe('useResizable custom hook', () => {
    it('should render drag handles state cleanly', () => {
        const { result } = renderHook(() => useResizable('test-panel', 200, 100, 500, 'horizontal'));
        expect(result.current).toBeDefined();
    });
});
