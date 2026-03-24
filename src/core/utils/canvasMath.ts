import { ICanvasItem } from '@/core/types';

export interface DragState {
    type: 'move' | 'resize' | 'rotate' | 'pivot';
    itemId: string;
    startX: number;
    startY: number;
    startItemX: number;
    startItemY: number;
    startItemW: number;
    startItemH: number;
    startRotation: number;
    startPivotX: number;
    startPivotY: number;
    corner?: string;
    hasMoved?: boolean;
}

export function calculateMove(
    state: DragState,
    deltaXPct: number,
    deltaYPct: number
): Partial<ICanvasItem> {
    return {
        x: state.startItemX + deltaXPct,
        y: state.startItemY + deltaYPct
    };
}

export function calculateResize(
    state: DragState,
    deltaXPx: number,
    deltaYPx: number,
    containerW: number,
    containerH: number,
    item: ICanvasItem
): Partial<ICanvasItem> | null {
    if (!state.corner || !containerW || !containerH) return null;

    const angleRad = (state.startRotation * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    // Rotate screen deltas back to item's local coordinate space for resizing
    const localDeltaXPx = deltaXPx * cos + deltaYPx * sin;
    const localDeltaYPx = -deltaXPx * sin + deltaYPx * cos;

    const localDeltaXPct = (localDeltaXPx / containerW) * 100;
    const localDeltaYPct = (localDeltaYPx / containerH) * 100;

    const corner = state.corner;
    const lockRatio = item.lockAspectRatio;
    const startRatio = state.startItemW / state.startItemH;

    let width = state.startItemW;
    let height = state.startItemH;

    // Handle changes based on local deltas
    if (corner.includes('right')) width = Math.max(1, state.startItemW + localDeltaXPct);
    if (corner.includes('left')) {
        width = Math.max(1, state.startItemW - localDeltaXPct);
    }
    if (corner.includes('bottom')) height = Math.max(1, state.startItemH + localDeltaYPct);
    if (corner.includes('top')) {
        height = Math.max(1, state.startItemH - localDeltaYPct);
    }

    // Apply Aspect Ratio Lock
    if (lockRatio) {
        if (corner === 'middle-left' || corner === 'middle-right') {
            height = width / startRatio;
        } else if (corner === 'top-center' || corner === 'bottom-center') {
            width = height * startRatio;
        } else {
            const dw = Math.abs(width - state.startItemW);
            const dh = Math.abs(height - state.startItemH);
            if (dw > dh) {
                height = width / startRatio;
            } else {
                width = height * startRatio;
            }
        }
    }

    // Auto-switch text resizing mode based on which dimension is being constrained
    const updates: Partial<ICanvasItem> = { width, height };
    if (item.type === 'text' && item.text) {
        const mode = item.text.resizingMode;
        const changesWidth = corner.includes('left') || corner.includes('right');
        const changesHeight = corner.includes('top') || corner.includes('bottom');

        if (changesHeight && (mode === 'auto-width' || mode === 'auto-height')) {
            // Constraining height → both dimensions fixed
            updates.text = { ...item.text, resizingMode: 'fixed' };
        } else if (changesWidth && mode === 'auto-width') {
            // Constraining width → keep height adaptive
            updates.text = { ...item.text, resizingMode: 'auto-height' };
        }
    }

    return updates;
}

export function calculateRotation(
    state: DragState,
    clientX: number,
    clientY: number,
    centerX: number,
    centerY: number
): Partial<ICanvasItem> {
    const currentAngle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
    const startAngle = Math.atan2(state.startY - centerY, state.startX - centerX) * (180 / Math.PI);

    const deltaRotation = currentAngle - startAngle;
    return { rotation: state.startRotation + deltaRotation };
}

export function calculatePivot(
    state: DragState,
    deltaXPx: number,
    deltaYPx: number,
    containerW: number,
    containerH: number
): Partial<ICanvasItem> | null {
    if (!containerW || !containerH) return null;

    // Angle in radians for rotation calculations
    const angleRad = (state.startRotation * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    // Rotate screen deltas back to item's local coordinate space
    const localDeltaXPx = deltaXPx * cos + deltaYPx * sin;
    const localDeltaYPx = -deltaXPx * sin + deltaYPx * cos;

    // Items unrotated design width/height in pixels
    const itemPxW = (state.startItemW / 100) * containerW;
    const itemPxH = (state.startItemH / 100) * containerH;

    if (itemPxW > 0 && itemPxH > 0) {
        const deltaPX = (localDeltaXPx / itemPxW) * 100;
        const deltaPY = (localDeltaYPx / itemPxH) * 100;

        const newPivotX = state.startPivotX + deltaPX;
        const newPivotY = state.startPivotY + deltaPY;

        // New world position of pivot is simply the mouse position
        const deltaXWorldPct = (deltaXPx / containerW) * 100;
        const deltaYWorldPct = (deltaYPx / containerH) * 100;

        return {
            pivotX: Math.round(newPivotX * 10) / 10,
            pivotY: Math.round(newPivotY * 10) / 10,
            x: state.startItemX + deltaXWorldPct,
            y: state.startItemY + deltaYWorldPct
        };
    }
    return null;
}

export const getCursorForCorner = (pos: string, rotation: number): string => {
    const angles: Record<string, number> = {
        'top-center': 0,
        'top-right': 45,
        'middle-right': 90,
        'bottom-right': 135,
        'bottom-center': 180,
        'bottom-left': 225,
        'middle-left': 270,
        'top-left': 315,
    };

    const baseAngle = angles[pos] || 0;
    const totalAngle = ((baseAngle + rotation) % 360 + 360) % 360;
    const normalized = Math.round(totalAngle / 45) * 45 % 180;

    switch (normalized) {
        case 0: return 'ns-resize';
        case 45: return 'nesw-resize';
        case 90: return 'ew-resize';
        case 135: return 'nwse-resize';
        default: return 'ns-resize';
    }
};

export const getRotateAngle = (pos: string, rotation: number): number => {
    const cornerAngles: Record<string, number> = {
        'top-left': 0,
        'top-right': 90,
        'bottom-right': 180,
        'bottom-left': 270,
    };
    return (cornerAngles[pos] ?? 0) + rotation;
};
