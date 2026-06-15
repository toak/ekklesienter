import { describe, it, expect } from 'vitest';
import { gainToDb, dbToGain } from './audioUtils';

describe('audioUtils', () => {
    it('should convert linear gain to decibels', () => {
        expect(gainToDb(0)).toBe('-∞');
        expect(gainToDb(-0.5)).toBe('-∞');
        expect(gainToDb(1.0)).toBe('0.0');
        expect(gainToDb(2.0)).toBe('+6.0');
    });

    it('should convert decibels to linear gain', () => {
        expect(dbToGain(0)).toBeCloseTo(1.0, 5);
        expect(dbToGain(6.0206)).toBeCloseTo(2.0, 4);
    });
});


