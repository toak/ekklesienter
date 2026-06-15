import { describe, it, expect, vi } from 'vitest';
import { logoService } from './logoService';

vi.mock('@/core/db', () => ({
    db: {
        logos: {
            toArray: vi.fn().mockResolvedValue([])
        }
    }
}));

describe('logoService logo manager', () => {
    it('should query registered system logos from db', async () => {
        const logos = await logoService.getAllLogos();
        expect(logos).toEqual([]);
    });
});
