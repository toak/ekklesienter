import { describe, it, expect } from 'vitest';
import { applyBlockStyle } from './applyBlockStyle';

describe('applyBlockStyle', () => {
    it('should inject correct styles to block layout properties', () => {
        const item = {
            id: 'item1',
            type: 'text',
            text: {
                content: '<span style="color: red;">Hello</span>',
                color: 'red',
            }
        };
        const updated = applyBlockStyle(item as any, { color: 'blue' });
        expect(updated.text?.color).toBe('blue');
    });
});
