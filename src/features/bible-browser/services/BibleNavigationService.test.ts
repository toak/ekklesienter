import { describe, it, expect, vi } from 'vitest';
import { BibleNavigationService } from './BibleNavigationService';

vi.mock('@/core/db', () => ({
    db: {
        verses: {
            where: vi.fn().mockReturnThis(),
            equals: vi.fn().mockReturnThis(),
            and: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ id: 'v2', bookId: 'GEN', chapter: 1, verseNumber: 2 })
        }
    }
}));

describe('BibleNavigationService navigation logic', () => {
    it('should resolve next verse correctly', async () => {
        const next = await BibleNavigationService.getNextVerse(
            { id: 'v1', bookId: 'GEN', chapter: 1, verseNumber: 1, text: 'text' } as any,
            'en'
        );
        expect(next).toEqual({ id: 'v2', bookId: 'GEN', chapter: 1, verseNumber: 2 });
    });
});
