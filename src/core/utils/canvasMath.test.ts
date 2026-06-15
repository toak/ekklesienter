import { describe, it, expect } from 'vitest';
import { calculateMove, getCursorForCorner, getRotateAngle } from './canvasMath';

describe('canvasMath utilities', () => {
    it('should calculateMove correctly', () => {
        const state = {
            type: 'move' as const,
            itemId: '1',
            startX: 10,
            startY: 10,
            startItemX: 100,
            startItemY: 200,
            startItemW: 50,
            startItemH: 50,
            startRotation: 0,
            startPivotX: 50,
            startPivotY: 50,
        };
        const delta = calculateMove(state, 10, 20);
        expect(delta).toEqual({ x: 110, y: 220 });
    });

    it('should resolve correct resize cursors', () => {
        expect(getCursorForCorner('top-center', 0)).toBe('ns-resize');
        expect(getCursorForCorner('middle-right', 0)).toBe('ew-resize');
    });

    it('should resolve correct rotate angles', () => {
        expect(getRotateAngle('top-left', 10)).toBe(10);
        expect(getRotateAngle('bottom-right', 45)).toBe(225);
    });
});
