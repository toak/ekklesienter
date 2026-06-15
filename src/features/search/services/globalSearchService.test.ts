import { describe, it, expect } from 'vitest';
import { searchVerses } from './globalSearchService';

describe('globalSearchService index queries', () => {
    it('should return empty list when query is too short', async () => {
        const results = await searchVerses('a', 'en');
        expect(results).toEqual([]);
    });
});
