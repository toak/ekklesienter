import { describe, it, expect } from 'vitest';
import { getEffectsStyle } from './effectUtils';

describe('effectUtils interpolation and boundaries', () => {
    it('should map drop-shadow to css filter string correctly', () => {
        const style = getEffectsStyle([
            { id: 'fx1', type: 'drop-shadow', visible: true, x: 2, y: 3, blur: 5, color: '#ff0000' }
        ]);
        expect(style.filter).toBe('drop-shadow(2px 3px 5px #ff0000)');
    });
});
