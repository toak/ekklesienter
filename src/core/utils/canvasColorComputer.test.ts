import { describe, it, expect } from 'vitest';
import { getComputedColorAtPoint } from './canvasColorComputer';

describe('canvasColorComputer', () => {
    it('should compute solid colors using math engine', async () => {
        const color = await getComputedColorAtPoint([
            { id: '1', type: 'color', color: '#ff0000', opacity: 1, visible: true, blendMode: 'normal' }
        ]);
        expect(color).toBe('#ff0000');
    });
});

