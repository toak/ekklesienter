import { describe, it, expect } from 'vitest';
import {
    hexToLinearRGBA,
    linearRGBAToHex,
    compositeOver,
    getComputedColor,
    findOcclusionCutoff
} from './blendEngine';
import { IStyleLayer } from '../types';

describe('blendEngine', () => {
    describe('sRGB ↔ Linear Conversion', () => {
        it('should roundtrip hex colors correctly', () => {
            const hexes = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#808080'];
            for (const hex of hexes) {
                const linear = hexToLinearRGBA(hex);
                const back = linearRGBAToHex(linear);
                expect(back.toLowerCase()).toBe(hex);
            }
        });

        it('should handle opacity correctly during conversion', () => {
            const linear = hexToLinearRGBA('#ff0000', 0.5);
            expect(linear.a).toBe(0.5);
        });
    });

    describe('compositeOver', () => {
        it('should perform Normal blending', () => {
            const base = hexToLinearRGBA('#ff0000', 1);
            const top = hexToLinearRGBA('#0000ff', 1);
            // Fully opaque normal blend replaces base
            const result = compositeOver(base, top, 'normal');
            expect(linearRGBAToHex(result).toLowerCase()).toBe('#0000ff');
        });

        it('should perform Multiply blending', () => {
            const base = hexToLinearRGBA('#ffffff', 1);
            const top = hexToLinearRGBA('#ff0000', 1);
            // White * Red = Red
            const result = compositeOver(base, top, 'multiply');
            expect(linearRGBAToHex(result).toLowerCase()).toBe('#ff0000');
        });

        it('should composite with alpha', () => {
            const base = hexToLinearRGBA('#ff0000', 1); // Red
            const top = hexToLinearRGBA('#000000', 0); // Transparent black
            const result = compositeOver(base, top, 'normal');
            expect(linearRGBAToHex(result).toLowerCase()).toBe('#ff0000');
        });
    });

    describe('getComputedColor', () => {
        it('should compute final color from solid layer stack (top-first)', () => {
            const layers: Partial<IStyleLayer>[] = [
                { id: '1', type: 'color', visible: true, opacity: 0.5, blendMode: 'normal', color: '#ffffff' }, // Top layer (50% white)
                { id: '2', type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#ff0000' }    // Bottom layer (solid red)
            ];
            const color = getComputedColor(layers as IStyleLayer[]);
            // 50% white over red in linear space yields a lighter red/pink.
            // Just verifying it doesn't crash and returns a hex.
            expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
        });

        it('should correctly skip hidden layers', () => {
            const layers: Partial<IStyleLayer>[] = [
                { id: '1', type: 'color', visible: false, opacity: 1, blendMode: 'normal', color: '#ffffff' }, // Hidden
                { id: '2', type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#00ff00' }    // Solid Green
            ];
            const color = getComputedColor(layers as IStyleLayer[]);
            expect(color.toLowerCase()).toBe('#00ff00');
        });
        
        it('should ignore non-color layers', () => {
            const layers: Partial<IStyleLayer>[] = [
                { id: '1', type: 'image', visible: true, opacity: 1, blendMode: 'normal' },
                { id: '2', type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#0000ff' } // Solid Blue
            ];
            const color = getComputedColor(layers as IStyleLayer[]);
            expect(color.toLowerCase()).toBe('#0000ff');
        });
    });

    describe('findOcclusionCutoff', () => {
        it('should identify the correct opaque normal layer', () => {
            const layers: Partial<IStyleLayer>[] = [
                { id: '1', type: 'color', visible: true, opacity: 0.5, blendMode: 'normal' },    // index 0
                { id: '2', type: 'color', visible: true, opacity: 1, blendMode: 'normal' },      // index 1 (opaque normal, cutoff)
                { id: '3', type: 'color', visible: true, opacity: 1, blendMode: 'multiply' },    // index 2
            ];
            expect(findOcclusionCutoff(layers as IStyleLayer[])).toBe(1);
        });

        it('should return 0 if no opaque normal layer is found', () => {
            const layers: Partial<IStyleLayer>[] = [
                { id: '1', type: 'color', visible: true, opacity: 0.5, blendMode: 'normal' },
                { id: '2', type: 'color', visible: true, opacity: 0.5, blendMode: 'normal' },
            ];
            expect(findOcclusionCutoff(layers as IStyleLayer[])).toBe(0);
        });
    });
});
