import { describe, it, expect } from 'vitest';
import { mimeToExt, extToMime } from './mediaPackingUtils';

describe('mediaPackingUtils helpers', () => {
    it('should map mime types and extensions correctly', () => {
        expect(mimeToExt('image/png')).toBe('png');
        expect(mimeToExt('video/mp4')).toBe('mp4');
        expect(extToMime('png')).toBe('image/png');
        expect(extToMime('mp4')).toBe('video/mp4');
    });
});

