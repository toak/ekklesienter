import { describe, it, expect } from 'vitest';
import { sanitizePasteHtml } from './sanitizePaste';

describe('sanitizePasteHtml utility', () => {
    it('should strip layout and preserve styled span elements', () => {
        const input = '<div style="margin: 10px;"><span style="color: red; padding: 5px;">Text</span></div>';
        const clean = sanitizePasteHtml(input);
        expect(clean).toContain('style="color: red"');
        expect(clean).not.toContain('margin: 10px');
    });
});
