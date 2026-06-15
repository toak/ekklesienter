import { describe, it, expect } from 'vitest';
import { normalizeFontStyle } from './fontService';

describe('fontService system mappings', () => {
    it('should normalize font style names correctly', () => {
        expect(normalizeFontStyle('Bold Italic')).toEqual({ weight: '700', isItalic: true });
        expect(normalizeFontStyle('Regular')).toEqual({ weight: '400', isItalic: false });
    });
});
