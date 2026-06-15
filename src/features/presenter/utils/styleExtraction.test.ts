import { describe, it, expect } from 'vitest';
import { normalizeColor, extractColorsFromHtml } from './styleExtraction';

describe('styleExtraction helper', () => {
    it('should normalize color strings correctly', () => {
        expect(normalizeColor('#ffffff')).toBe('#FFFFFF');
        expect(normalizeColor('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)');
    });

    it('should extract unique colors from HTML content', () => {
        const colors = extractColorsFromHtml('<span style="color: #ff0000;">hello</span>');
        expect(colors).toEqual(['#FF0000']);
    });
});
