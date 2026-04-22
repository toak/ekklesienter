import { ICanvasItem } from '@/core/types';
import { isEqual } from '@/core/utils/isEqual';

/**
 * Service for handling canvas domain logic, transformations, and coordinate math.
 * Decoupled from React to ensure testability and reuse across components.
 */
export class CanvasService {
    /**
     * Calculates new position and pivot coordinates when shifting the pivot point of an item.
     * Keeps the item visually in the same place by adjusting X/Y relative to the new rotation origin.
     */
    static calculatePivotTransformation(
        item: ICanvasItem,
        newPX?: number,
        newPY?: number
    ): Partial<ICanvasItem> {
        const px = item.pivotX ?? 50;
        const py = item.pivotY ?? 50;
        const targetPX = newPX !== undefined ? newPX : px;
        const targetPY = newPY !== undefined ? newPY : py;

        const angleRad = ((item.rotation || 0) * Math.PI) / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        const dpxPct = targetPX - px;
        const dpyPct = targetPY - py;

        const dpxW = (dpxPct / 100) * item.width;
        const dpyW = (dpyPct / 100) * item.height;

        return {
            pivotX: targetPX,
            pivotY: targetPY,
            x: item.x + dpxW * cos - dpyW * sin,
            y: item.y + dpxW * sin + dpyW * cos
        };
    }

    /**
     * Calculates new dimensions for an item, respecting aspect ratio locks and minimum constraints.
     */
    static calculateDimensionScale(
        item: ICanvasItem,
        dim: 'width' | 'height',
        newVal: number
    ): Partial<ICanvasItem> {
        const updates: Partial<ICanvasItem> = { [dim]: newVal };

        if (item.lockAspectRatio && item[dim] > 0) {
            const other = dim === 'width' ? 'height' : 'width';
            updates[other] = (newVal * item[other]) / item[dim];
        }

        return updates;
    }

    /**
     * Resolves alignment shortcuts (left, center, right, top, middle, bottom) into coordinate updates.
     */
    static getAlignmentUpdates(type: string): Partial<ICanvasItem> {
        switch (type) {
            case 'left': return { x: 0 };
            case 'h-center': return { x: 50 };
            case 'right': return { x: 100 };
            case 'top': return { y: 0 };
            case 'v-middle': return { y: 50 };
            case 'bottom': return { y: 100 };
            default: return {};
        }
    }

    /**
     * Determines the common value across multiple items for a property.
     * Returns the value if all match, or 'mixed' if they differ.
     */
    static getSelectionState<T>(
        selectedIds: string[],
        canvasItems: ICanvasItem[],
        getter: (item: ICanvasItem) => T
    ): T | 'mixed' {
        if (selectedIds.length === 0) return 'mixed' as any;
        
        const firstId = selectedIds[0];
        const firstItem = canvasItems.find(i => i.id === firstId);
        if (!firstItem) return 'mixed';

        const firstValue = getter(firstItem);
        if (selectedIds.length === 1) return firstValue;

        const allSame = selectedIds.every(id => {
            const item = canvasItems.find(i => i.id === id);
            return item && isEqual(getter(item), firstValue);
        });

        return allSame ? firstValue : 'mixed';
    }

    /**
     * Calculates updates for border radius properties, handling global vs specific corner syncing.
     */
    static calculateRadiusUpdates(
        item: ICanvasItem,
        key: 'borderRadius' | 'borderRadiusTL' | 'borderRadiusTR' | 'borderRadiusBL' | 'borderRadiusBR',
        value: number
    ): Partial<ICanvasItem> {
        const u: Partial<ICanvasItem> = {};
        
        if (item.lockBorderRadius !== false) {
            u.borderRadius = value;
            u.borderRadiusTL = value;
            u.borderRadiusTR = value;
            u.borderRadiusBL = value;
            u.borderRadiusBR = value;
        } else {
            u[key] = value;
            if (key === 'borderRadius') {
                u.borderRadiusTL = value;
                u.borderRadiusTR = value;
                u.borderRadiusBL = value;
                u.borderRadiusBR = value;
            }
        }
        
        return u;
    }

    /**
     * Clamps a drag offset to ensure the viewport (vw/vh) remains within the scaled image (dw/dh).
     */
    static clampCropOffset(
        offset: { x: number; y: number },
        viewport: { width: number; height: number },
        image: { width: number; height: number },
        zoom: number
    ): { x: number; y: number } {
        const dw = image.width * zoom;
        const dh = image.height * zoom;

        const limitX = Math.max(0, (dw - viewport.width) / 2);
        const limitY = Math.max(0, (dh - viewport.height) / 2);

        return {
            x: Math.max(-limitX, Math.min(limitX, offset.x)),
            y: Math.max(-limitY, Math.min(limitY, offset.y))
        };
    }

    /**
     * Calculates the final crop percentages (0-100) based on current zoom, offset and sizes.
     */
    static calculateCropResult(
        offset: { x: number; y: number },
        viewport: { width: number; height: number },
        image: { width: number; height: number },
        zoom: number
    ) {
        const dw = image.width * zoom;
        const dh = image.height * zoom;

        // Viewport is at container center. Image is at (offset.x, offset.y) relative to center.
        return {
            x: ((dw / 2 - offset.x - viewport.width / 2) / dw) * 100,
            y: ((dh / 2 - offset.y - viewport.height / 2) / dh) * 100,
            width: (viewport.width / dw) * 100,
            height: (viewport.height / dh) * 100
        };
    }
}
