import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMediaUrl } from './useMediaUrl';

vi.mock('@/core/db', () => ({
    db: {
        mediaPool: {
            get: vi.fn().mockResolvedValue({ id: 'm1', blob: new Blob() })
        }
    }
}));

describe('useMediaUrl', () => {
    it('should yield correct media blob URLs', () => {
        const { result } = renderHook(() => useMediaUrl({ id: 'm1', name: 'Media 1', path: 'media-1.jpg', type: 'image', createdAt: Date.now() }));
        expect(result.current).toBeDefined();
    });
});
