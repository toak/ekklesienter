import { describe, it, expect } from 'vitest';
import { myBibleParser } from './myBibleParser';

describe('myBibleParser interpreter', () => {
    it('should define parser functions for SQLite binaries', () => {
        expect(myBibleParser).toBeDefined();
        expect(myBibleParser.parse).toBeDefined();
    });
});

