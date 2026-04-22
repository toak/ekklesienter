import { describe, it, expect } from 'vitest';
import { parseSearchQuery } from './searchParser';

describe('searchParser', () => {
    it('should parse simple references', () => {
        const result = parseSearchQuery('John 3:16');
        expect(result.type).toBe('reference');
        expect(result.items[0]).toMatchObject({
            bookId: 'JHN',
            chapter: 3,
            verse: 16
        });
    });

    it('should parse shorthand references like J316', () => {
        const result = parseSearchQuery('J316');
        expect(result.items[0]).toMatchObject({
            bookId: 'JHN',
            chapter: 3,
            verse: 16
        });
    });

    it('should parse shorthand with spaces like 1 J 3 1', () => {
        const result = parseSearchQuery('1 J 3 1');
        expect(result.items[0]).toMatchObject({
            bookId: '1JN',
            chapter: 3,
            verse: 1
        });
    });

    it('should handle ranges like Jn 3:16-18', () => {
        const result = parseSearchQuery('Jn 3:16-18');
        expect(result.items[0]).toMatchObject({
            bookId: 'JHN',
            chapter: 3,
            verse: 16,
            verseEnd: 18
        });
    });

    it('should handle batch queries with commas', () => {
        const result = parseSearchQuery('Jn 3:16, Rom 10:17');
        expect(result.items).toHaveLength(2);
        expect(result.items[0].bookId).toBe('JHN');
        expect(result.items[1].bookId).toBe('ROM');
    });

    it('should detect topics', () => {
        const result = parseSearchQuery('love', 'en');
        expect(result.type).toBe('topic');
        expect(result.items[0].type).toBe('topic');
    });

    it('should fallback to keywords for general text', () => {
        const result = parseSearchQuery('For God so loved');
        expect(result.items[0].type).toBe('keyword');
    });

    it('should auto-correct book typos', () => {
        const result = parseSearchQuery('Genisis 1:1');
        expect(result.items[0].bookId).toBe('GEN');
        expect(result.items[0].isCorrected).toBe(true);
    });

    it('should handle Russian shorthand', () => {
        const result = parseSearchQuery('1 Ин 3 1', 'ru');
        expect(result.items[0].bookId).toBe('1JN');
    });
});
