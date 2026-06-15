import { describe, it, expect } from 'vitest';
import { stripInlineStyles } from './stripInlineStyles';

describe('stripInlineStyles utility', () => {
    it('should strip targeted inline properties from elements', () => {
        const input = '<span style="font-family: Arial; color: red;">Text</span>';
        const clean = stripInlineStyles(input, ['fontFamily']);
        expect(clean).toContain('color: red');
        expect(clean).not.toContain('font-family');
    });
});

