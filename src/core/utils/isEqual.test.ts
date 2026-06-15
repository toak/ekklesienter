import { describe, it, expect } from 'vitest';
import { isEqual } from './isEqual';

describe('isEqual deep equality', () => {
    it('should check deep equality correctly', () => {
        expect(isEqual(1, 1)).toBe(true);
        expect(isEqual('a', 'a')).toBe(true);
        expect(isEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
        expect(isEqual({ a: 1 }, { a: 2 })).toBe(false);
        expect(isEqual({ a: 1 }, null)).toBe(false);
    });
});
