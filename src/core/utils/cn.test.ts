import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn utility', () => {
    it('should merge classes correctly', () => {
        expect(cn('class1', 'class2')).toBe('class1 class2');
        expect(cn('class1', { 'class2': true, 'class3': false })).toBe('class1 class2');
        expect(cn('px-2 py-1', 'p-4')).toBe('p-4'); // tailwind-merge resolves p-4 overriding px-2 py-1
    });
});
