import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml utility', () => {
    it('should sanitize dangerous HTML tags', () => {
        const input = '<p>Hello <script>alert("hack")</script><span>World</span></p>';
        const clean = sanitizeHtml(input);
        expect(clean).toContain('Hello <span>World</span>');
        expect(clean).not.toContain('script');
    });
});
