import { describe, it, expect } from 'vitest';
import { CanvasService } from './CanvasService';
import { ICanvasItem } from '@/core/types';

describe('CanvasService', () => {
    describe('calculatePivotTransformation', () => {
        it('should adjust position correctly when shifting pivot without rotation', () => {
            const item: Partial<ICanvasItem> = {
                x: 100,
                y: 100,
                width: 200,
                height: 100,
                pivotX: 50,
                pivotY: 50,
                rotation: 0
            };

            // Shift pivot from Center (50,50) to Top-Left (0,0)
            const updates = CanvasService.calculatePivotTransformation(item as ICanvasItem, 0, 0);

            expect(updates.pivotX).toBe(0);
            expect(updates.pivotY).toBe(0);
            // X adjustment: 100 + (0-50)/100 * 200 * cos(0) - (0-50)/100 * 100 * sin(0)
            // X: 100 - 0.5 * 200 = 0
            expect(updates.x).toBe(0);
            expect(updates.y).toBe(50);
        });

        it('should handle rotation in pivot transformations', () => {
            const item: Partial<ICanvasItem> = {
                x: 100,
                y: 100,
                width: 100,
                height: 100,
                pivotX: 50,
                pivotY: 50,
                rotation: 90
            };

            // Shift pivot to (100, 50) - the right edge
            const updates = CanvasService.calculatePivotTransformation(item as ICanvasItem, 100, 50);
            
            // at 90 deg: cos=0, sin=1
            // dx = (50/100)*100 = 50
            // dy = 0
            // newX = 100 + 50*0 - 0*1 = 100
            // newY = 100 + 50*1 + 0*0 = 150
            expect(updates.x).toBeCloseTo(100);
            expect(updates.y).toBeCloseTo(150);
        });
    });

    describe('calculateDimensionScale', () => {
        it('should scale the other dimension when aspect ratio is locked', () => {
            const item: Partial<ICanvasItem> = {
                width: 100,
                height: 50,
                lockAspectRatio: true
            };

            const updates = CanvasService.calculateDimensionScale(item as ICanvasItem, 'width', 200);
            expect(updates.width).toBe(200);
            expect(updates.height).toBe(100);
        });

        it('should not scale the other dimension when aspect ratio is unlocked', () => {
            const item: Partial<ICanvasItem> = {
                width: 100,
                height: 50,
                lockAspectRatio: false
            };

            const updates = CanvasService.calculateDimensionScale(item as ICanvasItem, 'width', 200);
            expect(updates.width).toBe(200);
            expect(updates.height).toBeUndefined();
        });
    });

    describe('getSelectionState', () => {
        const items: ICanvasItem[] = [
            { id: '1', x: 10, y: 10 } as ICanvasItem,
            { id: '2', x: 10, y: 20 } as ICanvasItem,
            { id: '3', x: 10, y: 10 } as ICanvasItem,
        ];

        it('should return the common value if all items match', () => {
            const state = CanvasService.getSelectionState(['1', '3'], items, i => i.x);
            expect(state).toBe(10);
        });

        it('should return "mixed" if values differ', () => {
            const state = CanvasService.getSelectionState(['1', '2'], items, i => i.y);
            expect(state).toBe('mixed');
        });

        it('should return the single value if only one item is selected', () => {
            const state = CanvasService.getSelectionState(['2'], items, i => i.y);
            expect(state).toBe(20);
        });
    });
});
