import { describe, it, expect } from 'vitest';
import { extractWords, levenshteinDistance } from './bibleSearchUtils';

describe('bibleSearchUtils search processing', () => {
    it('should tokenize text correctly', () => {
        const terms = extractWords('For God loved the world');
        expect(terms).toEqual(['for', 'god', 'loved', 'the', 'world']);
    });

    it('should calculate Levenshtein distance correctly', () => {
        expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });
});
