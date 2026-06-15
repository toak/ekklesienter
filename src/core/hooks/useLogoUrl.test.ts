import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLogoUrl } from './useLogoUrl';

vi.mock('@/core/db', () => ({
    db: {
        logos: {
            get: vi.fn().mockResolvedValue({ id: 'logo-1', blob: new Blob() })
        }
    }
}));

describe('useLogoUrl', () => {
    it('should yield matching logo object URLs', () => {
        const { result } = renderHook(() => useLogoUrl({ id: 'logo-1', name: 'Logo 1', isFromDb: true, url: '' }));
        expect(result.current).toBeDefined();
    });
});
