import { describe, it, expect } from 'vitest';
import { normalizeHtml } from './normalizeContentEditableHtml';

describe('normalizeContentEditableHtml utility', () => {
    it('should normalize content editable line endings and spaces', () => {
        expect(normalizeHtml('hello&nbsp;world')).toBe('hello&nbsp;world');
        expect(normalizeHtml('<div><br></div>')).toBe('<br>');
    });
});

