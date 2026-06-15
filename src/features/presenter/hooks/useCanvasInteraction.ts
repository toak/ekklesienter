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
import { useShallow } from 'zustand/react/shallow';
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
    const { updateCanvasItem, updateCanvasItemsOrder, takeSnapshot } = usePresentationStore(useShallow(s => ({
        updateCanvasItem: s.updateCanvasItem,
        updateCanvasItemsOrder: s.updateCanvasItemsOrder,
        takeSnapshot: s.takeSnapshot
    })));
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

        let targetIds = selectedIds;
        const isMulti = e.ctrlKey || e.metaKey;
        if (isMulti && type === 'move') {
            targetIds = selectedIds.includes(item.id)
                ? selectedIds.filter(id => id !== item.id)
                : [...selectedIds, item.id];
            setSelectedIds(targetIds);
        } else if (!selectedIds.includes(item.id)) {
            targetIds = [item.id];
            setSelectedIds(targetIds);
            if (item.type === 'text' && type === 'move') return;
        }

        let updatedLocalItems = [...localItems];
        let draggedItemIds = targetIds;
        let dragItem = item;

        if (e.altKey && type === 'move') {
            await takeSnapshot(slideId).catch(console.error);
            const clones = targetIds.map(id => {
                const orig = localItems.find(i => i.id === id);
                if (!orig) return null;
                const clone = structuredClone(orig);
                clone.id = crypto.randomUUID();
                clone.zIndex = updatedLocalItems.length;
                return clone;
            }).filter((c): c is ICanvasItem => c !== null);

            if (clones.length > 0) {
                updatedLocalItems = [...updatedLocalItems, ...clones];
                const clonedIds = clones.map(c => c.id);
                draggedItemIds = clonedIds;
                setSelectedIds(clonedIds);
                setLocalItems(updatedLocalItems);

                const clickedIdx = targetIds.indexOf(item.id);
                if (clickedIdx !== -1 && clones[clickedIdx]) {
                    dragItem = clones[clickedIdx];
                } else {
                    dragItem = clones[0];
                }
            }
        } else {
            await takeSnapshot(slideId).catch(console.error);
        }

        setDragActive(true);
        dragState.current = {
            type,
            itemId: dragItem.id,
            startX: e.clientX,
            startY: e.clientY,
            startItemX: dragItem.x,
            startItemY: dragItem.y,
            startItemW: dragItem.width,
            startItemH: dragItem.height,
            startRotation: dragItem.rotation || 0,
            startPivotX: dragItem.pivotX ?? 50,
            startPivotY: dragItem.pivotY ?? 50,
            corner,
            draggedItems: draggedItemIds.map(id => {
                const activeItem = updatedLocalItems.find(i => i.id === id) || dragItem;
                return {
                    id: activeItem.id,
                    startItemX: activeItem.x,
                    startItemY: activeItem.y,
                    startItemW: activeItem.width,
                    startItemH: activeItem.height,
                    startRotation: activeItem.rotation || 0,
                    startPivotX: activeItem.pivotX ?? 50,
                    startPivotY: activeItem.pivotY ?? 50,
                };
            }),
        } as any;

        let cursor = 'default';
        if (type === 'move') {
            cursor = 'default';
        } else if (type === 'rotate') {
            cursor = 'none';
        } else if (type === 'pivot') {
            cursor = 'crosshair';
        } else if (type === 'resize' && corner) {
            cursor = getCursorForCorner(corner, dragItem.rotation || 0);
        }
        document.body.style.cursor = cursor;
        document.body.style.userSelect = 'none';

        if (type === 'resize' || type === 'rotate') e.preventDefault();
    }, [editingId, setSelectedIds, setEditingId, tool, selectedIds, slideId, takeSnapshot, setDragActive, localItems, setLocalItems]);

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
            const dragged = (state as any).draggedItems || [];
            if (dragged.length > 0) {
                const updates = dragged.map((di: any) => {
                    const updatesForItem = calculateMove({
                        startItemX: di.startItemX,
                        startItemY: di.startItemY,
                    } as any, deltaXPct, deltaYPct);
                    return {
                        id: di.id,
                        updates: updatesForItem,
                    };
                });
                setLocalItems(prev => prev.map(item => {
                    const update = updates.find((u: any) => u.id === item.id);
                    return update ? { ...item, ...update.updates } : item;
                }));
            } else {
                const updates = calculateMove(state, deltaXPct, deltaYPct);
                updateLocalItem(state.itemId, updates);
            }
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
            if (state.hasMoved !== false) {
                updateCanvasItemsOrder(slideId, localItems).catch(console.error);
            }
        }

        dragState.current = null;
        setPendingUpdate(true);
        setDragActive(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setRotateCursorAngle(null);
    }, [slideId, localItems, updateCanvasItemsOrder, setPendingUpdate, setDragActive]);

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
