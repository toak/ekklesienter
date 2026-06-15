import { describe, it, expect } from 'vitest';
import { formatVerseRange, formatMultiVerseReference } from './bibleUtils';

describe('bibleUtils formatting', () => {
    it('should format verse range correctly', () => {
        expect(formatVerseRange([1, 2, 4, 5, 6, 8])).toBe('1-2, 4-6, 8');
    });

    it('should format multi-verse references correctly', () => {
        const verses = [
            { id: 1, translationId: 'KJV', bookId: 'JHN', chapter: 3, verseNumber: 16, text: 'text' }
        ];
        expect(formatMultiVerseReference(verses, 'John')).toBe('John 3:16');
    });
});
