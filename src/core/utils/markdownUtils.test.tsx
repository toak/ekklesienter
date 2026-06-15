import { describe, it, expect } from 'vitest';
import { truncateMiddle } from './markdownUtils';

describe('markdownUtils', () => {
    it('should truncate text in the middle correctly', () => {
        expect(truncateMiddle('This is a very long string that needs truncation', 20)).toBe('This is a...uncation');
        expect(truncateMiddle('Short', 20)).toBe('Short');
    });
});

