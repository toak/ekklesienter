import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import {
    selectedCanvasItemIdsAtom,
    editingCanvasItemIdAtom,
    canvasToolAtom,
    slideEditorDragActiveAtom,
    slideEditorPendingUpdateAtom,
} from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ICanvasItem } from '@/core/types';
import {
    calculateMove,
    calculateResize,
    calculateRotation,
    calculatePivot,
    getCursorForCorner,
    type DragState
} from '@/core/utils/canvasMath';

export function useCanvasInteraction(
    slideId: string,
    localItems: ICanvasItem[],
    setLocalItems: React.Dispatch<React.SetStateAction<ICanvasItem[]>>,
    getContainerRect: () => DOMRect | { left: number; top: number; width: number; height: number; }
) {
    const { updateCanvasItem, takeSnapshot } = usePresentationStore();
    const [selectedIds, setSelectedIds] = useAtom(selectedCanvasItemIdsAtom);
    const [editingId, setEditingId] = useAtom(editingCanvasItemIdAtom) as [string | null, (v: string | null) => void];
    const [tool, setTool] = useAtom(canvasToolAtom) as [string, (v: string) => void];
    const setDragActive = useSetAtom(slideEditorDragActiveAtom);
    const setPendingUpdate = useSetAtom(slideEditorPendingUpdateAtom);

    const [rotateCursorAngle, setRotateCursorAngle] = useState<number | null>(null);
    const dragState = useRef<DragState | null>(null);

    const handleMouseDown = useCallback(async (e: React.MouseEvent, item: ICanvasItem, type: 'move' | 'resize' | 'rotate' | 'pivot', corner?: string) => {
        if (item.locked) return;
        if (editingId === item.id) return;

        if (tool === 'text' && item.type === 'text' && type !== 'resize' && type !== 'rotate') {
            setEditingId(item.id);
            setSelectedIds([item.id]);
            return;
        }

        const isMulti = e.ctrlKey || e.metaKey;
        if (isMulti && type === 'move') {
            setSelectedIds(prev =>
                prev.includes(item.id)
                    ? prev.filter(id => id !== item.id)
                    : [...prev, item.id]
            );
        } else if (!selectedIds.includes(item.id)) {
            setSelectedIds([item.id]);
            if (item.type === 'text' && type === 'move') return;
        }

        takeSnapshot(slideId).catch(console.error);
        setDragActive(true);
        dragState.current = {
            type,
            itemId: item.id,
            startX: e.clientX,
            startY: e.clientY,
            startItemX: item.x,
            startItemY: item.y,
            startItemW: item.width,
            startItemH: item.height,
            startRotation: item.rotation || 0,
            startPivotX: item.pivotX ?? 50,
            startPivotY: item.pivotY ?? 50,
            corner,
        };

        let cursor = 'default';
        if (type === 'move') {
            cursor = 'default';
        } else if (type === 'rotate') {
            cursor = 'none';
        } else if (type === 'pivot') {
            cursor = 'crosshair';
        } else if (type === 'resize' && corner) {
            cursor = getCursorForCorner(corner, item.rotation || 0);
        }
        document.body.style.cursor = cursor;
        document.body.style.userSelect = 'none';

        if (type === 'resize' || type === 'rotate') e.preventDefault();
    }, [editingId, setSelectedIds, setEditingId, tool, selectedIds, slideId, takeSnapshot, setDragActive]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const state = dragState.current;
        if (!state) return;

        const rect = getContainerRect();
        const deltaXPx = e.clientX - state.startX;
        const deltaYPx = e.clientY - state.startY;
        const deltaXPct = (deltaXPx / rect.width) * 100;
        const deltaYPct = (deltaYPx / rect.height) * 100;

        const item = localItems.find(i => i.id === state.itemId);
        if (!item) return;

        const updateLocalItem = (id: string, updates: Partial<ICanvasItem>) => {
            setLocalItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
        };

        if (state.type === 'move') {
            if (!state.hasMoved) {
                const dist = Math.sqrt(deltaXPx * deltaXPx + deltaYPx * deltaYPx);
                if (dist < 3) return;
                state.hasMoved = true;
            }
            const updates = calculateMove(state, deltaXPct, deltaYPct);
            updateLocalItem(state.itemId, updates);
        } else if (state.type === 'resize' && state.corner) {
            const updates = calculateResize(state, deltaXPx, deltaYPx, rect.width, rect.height, item);
            if (updates) updateLocalItem(state.itemId, updates);
        } else if (state.type === 'rotate') {
            const itemRect = document.getElementById(`item-${state.itemId}`)?.getBoundingClientRect();
            if (!itemRect) return;

            const centerX = itemRect.left + itemRect.width / 2;
            const centerY = itemRect.top + itemRect.height / 2;

            const updates = calculateRotation(state, e.clientX, e.clientY, centerX, centerY);
            if (updates) updateLocalItem(state.itemId, updates);
        } else if (state.type === 'pivot') {
            const updates = calculatePivot(state, deltaXPx, deltaYPx, rect.width, rect.height);
            if (updates) updateLocalItem(state.itemId, updates);
        }
    }, [getContainerRect, localItems, setLocalItems]);

    const handleMouseUp = useCallback(() => {
        const state = dragState.current;
        if (state) {
            const finalItem = localItems.find(i => i.id === state.itemId);
            if (finalItem && state.hasMoved !== false) {
                const updates: Partial<ICanvasItem> = {
                    x: finalItem.x,
                    y: finalItem.y,
                    width: finalItem.width,
                    height: finalItem.height,
                    rotation: finalItem.rotation,
                    pivotX: finalItem.pivotX,
                    pivotY: finalItem.pivotY,
                };

                if (finalItem.type === 'text' && finalItem.text) {
                    updates.text = { ...finalItem.text, resizingMode: finalItem.text.resizingMode };
                }

                updateCanvasItem(slideId, state.itemId, updates);
            }
        }

        dragState.current = null;
        setPendingUpdate(true);
        setDragActive(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setRotateCursorAngle(null);
    }, [slideId, localItems, updateCanvasItem, setPendingUpdate, setDragActive]);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    return {
        handleMouseDown,
        rotateCursorAngle,
        setRotateCursorAngle,
        selectedIds,
        setSelectedIds,
        editingId,
        setEditingId,
        tool,
        setTool,
    };
}
