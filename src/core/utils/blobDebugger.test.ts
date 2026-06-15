import { describe, it, expect } from 'vitest';
import './blobDebugger';

describe('blobDebugger side-effects', () => {
    it('should maintain functional URL.createObjectURL', () => {
        const blob = new Blob(['test'], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        expect(url).toBeDefined();
        expect(typeof url).toBe('string');
    });
});

