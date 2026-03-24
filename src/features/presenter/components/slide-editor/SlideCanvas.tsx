import React, { useCallback, useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
    selectedCanvasItemIdsAtom,
    editingCanvasItemIdAtom,
    canvasToolAtom,
    slideEditorDragActiveAtom,
    slideEditorPendingUpdateAtom,
    slidePreviewHoveredAtom,
    presenterPanelHoveredAtom,
} from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ICanvasItem, ICanvasSlide } from '@/core/types';
import CanvasItemView from './CanvasItemView';
import { cn } from '@/core/utils/cn';

interface SlideCanvasProps {
    slideId: string;
    canvasItems: ICanvasItem[];
}

/**
 * Canvas overlay on the slide display for drag/resize of positioned items.
 * Uses percentage-based coordinates to maintain consistency across scales.
 */
const SlideCanvas: React.FC<SlideCanvasProps> = ({ slideId, canvasItems }) => {
    const { updateCanvasItem, removeCanvasItem, takeSnapshot } = usePresentationStore();
    const [selectedIds, setSelectedIds] = useAtom(selectedCanvasItemIdsAtom);
    const [editingId, setEditingId] = useAtom(editingCanvasItemIdAtom) as unknown as [string | null, (v: string | null) => void];
    const [tool, setTool] = useAtom(canvasToolAtom) as unknown as [string, (v: string) => void];
    const [, setSlidePreviewHovered] = useAtom(slidePreviewHoveredAtom) as [boolean, (v: boolean) => void];

    // State for the custom rotation follow-cursor
    const [rotateCursorAngle, setRotateCursorAngle] = useState<number | null>(null);

    // Read canvas items directly from the store for instant reactivity
    const storePresentation = usePresentationStore(s => s.selectedPresentation || s.activePresentation);
    const storeCanvasItems = React.useMemo(() => {
        const slide = storePresentation?.slides?.find(s => s.id === slideId);
        if (slide?.type === 'normal') {
            return (slide as ICanvasSlide).content?.canvasItems || [];
        }
        return [];
    }, [storePresentation, slideId]);

    // Use store items as the primary source; fall back to prop for initial render
    const resolvedItems = storeCanvasItems.length > 0 || storePresentation ? storeCanvasItems : canvasItems;

    // Sync props to local state when not dragging
    const [localItems, setLocalItems] = useState<ICanvasItem[]>(resolvedItems);
    const [dragActive, setDragActive] = useAtom(slideEditorDragActiveAtom);
    const [pendingUpdate, setPendingUpdate] = useAtom(slideEditorPendingUpdateAtom);

    useEffect(() => {
        if (!dragActive && !pendingUpdate) {
            setLocalItems(resolvedItems);
        } else if (pendingUpdate) {
            const timer = setTimeout(() => setPendingUpdate(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [resolvedItems, dragActive, pendingUpdate, setPendingUpdate]);


    const containerRef = useRef<HTMLDivElement>(null);
    const dragState = useRef<{
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
    } | null>(null);

    // Keyboard handler for deleting selected items or exiting edit mode
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            const active = document.activeElement;
            const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true');

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (isTyping) return;
                if (selectedIds.length > 0 && !editingId) {
                    e.preventDefault();
                    selectedIds.forEach((id: string) => removeCanvasItem(slideId, id));
                    setSelectedIds([]);
                }
            }
            if (e.key === 'Escape') {
                if (editingId) {
                    setEditingId(null);
                    setTool('select');
                } else {
                    setSelectedIds([]);
                }
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [selectedIds, editingId, slideId, removeCanvasItem, setEditingId, setSelectedIds, setTool]);

    const getContainerRect = useCallback(() => {
        return containerRef.current?.getBoundingClientRect() || { left: 0, top: 0, width: 1, height: 1 };
    }, []);

    const handleMouseDown = useCallback(async (e: React.MouseEvent, item: ICanvasItem, type: 'move' | 'resize' | 'rotate' | 'pivot', corner?: string) => {
        if (item.locked) return;

        // If we are editing THIS item, don't start dragging
        if (editingId === item.id) return;

        // If in text tool mode and clicking another text item, switch edit focus
        if (tool === 'text' && item.type === 'text' && type !== 'resize' && type !== 'rotate') {
            setEditingId(item.id);
            setSelectedIds([item.id]);
            return;
        }

        // Multi-selection logic (Ctrl/Cmd)
        const isMulti = e.ctrlKey || e.metaKey;
        if (isMulti && type === 'move') {
            setSelectedIds(prev =>
                prev.includes(item.id)
                    ? prev.filter(id => id !== item.id)
                    : [...prev, item.id]
            );
        } else if (!selectedIds.includes(item.id)) {
            setSelectedIds([item.id]);
            // For text items: just select on first click, don't start drag.
            // This allows double-click to fire reliably for entering edit mode.
            if (item.type === 'text' && type === 'move') return;
        }

        // Resize/Move/Rotate/Pivot logic
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
            // Keep custom follow-cursor visible, hide system cursor
            cursor = 'none';
        } else if (type === 'pivot') {
            cursor = 'crosshair';
        } else if (type === 'resize' && corner) {
            cursor = getCursorForCorner(corner, item.rotation || 0);
        }
        document.body.style.cursor = cursor;
        document.body.style.userSelect = 'none';

        // Prevents focus issues
        if (type === 'resize' || type === 'rotate') e.preventDefault();
    }, [editingId, setSelectedIds, setEditingId, tool, selectedIds, slideId, takeSnapshot, setDragActive]);

    const handleDoubleClick = useCallback((e: React.MouseEvent, item: ICanvasItem) => {
        if (item.locked || item.type !== 'text') return;
        e.stopPropagation();
        setEditingId(item.id);
        setSelectedIds([item.id]);
        setTool('text');
    }, [setEditingId, setSelectedIds, setTool]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
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
                const newX = state.startItemX + deltaXPct;
                const newY = state.startItemY + deltaYPct;
                updateLocalItem(state.itemId, { x: newX, y: newY });
            } else if (state.type === 'resize' && state.corner) {
                const containerRect = getContainerRect();
                if (!containerRect.width || !containerRect.height) return;

                const angleRad = (state.startRotation * Math.PI) / 180;
                const cos = Math.cos(angleRad);
                const sin = Math.sin(angleRad);

                // Rotate screen deltas back to item's local coordinate space for resizing
                const localDeltaXPx = deltaXPx * cos + deltaYPx * sin;
                const localDeltaYPx = -deltaXPx * sin + deltaYPx * cos;

                const localDeltaXPct = (localDeltaXPx / containerRect.width) * 100;
                const localDeltaYPct = (localDeltaYPx / containerRect.height) * 100;

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

                updateLocalItem(state.itemId, updates);
            }
            else if (state.type === 'rotate') {
                const itemRect = document.getElementById(`item-${state.itemId}`)?.getBoundingClientRect();
                if (!itemRect) return;

                const centerX = itemRect.left + itemRect.width / 2;
                const centerY = itemRect.top + itemRect.height / 2;

                const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
                const startAngle = Math.atan2(state.startY - centerY, state.startX - centerX) * (180 / Math.PI);

                const deltaRotation = currentAngle - startAngle;
                updateLocalItem(state.itemId, { rotation: state.startRotation + deltaRotation });
            } else if (state.type === 'pivot') {
                const itemElem = document.getElementById(`item-${state.itemId}`);
                if (!itemElem) return;

                const containerRect = getContainerRect();
                if (!containerRect.width || !containerRect.height) return;

                // Angle in radians for rotation calculations
                const angleRad = (state.startRotation * Math.PI) / 180;
                const cos = Math.cos(angleRad);
                const sin = Math.sin(angleRad);

                // Rotate screen deltas back to item's local coordinate space
                const localDeltaXPx = deltaXPx * cos + deltaYPx * sin;
                const localDeltaYPx = -deltaXPx * sin + deltaYPx * cos;

                // Items unrotated design width/height in pixels
                const itemPxW = (state.startItemW / 100) * containerRect.width;
                const itemPxH = (state.startItemH / 100) * containerRect.height;

                if (itemPxW > 0 && itemPxH > 0) {
                    const deltaPX = (localDeltaXPx / itemPxW) * 100;
                    const deltaPY = (localDeltaYPx / itemPxH) * 100;

                    const newPivotX = state.startPivotX + deltaPX;
                    const newPivotY = state.startPivotY + deltaPY;

                    // New world position of pivot is simply the mouse position
                    const deltaXWorldPct = (deltaXPx / containerRect.width) * 100;
                    const deltaYWorldPct = (deltaYPx / containerRect.height) * 100;

                    updateLocalItem(state.itemId, {
                        pivotX: Math.round(newPivotX * 10) / 10,
                        pivotY: Math.round(newPivotY * 10) / 10,
                        x: state.startItemX + deltaXWorldPct,
                        y: state.startItemY + deltaYWorldPct
                    });
                }
            }
        };

        const handleMouseUp = () => {
            const state = dragState.current;
            if (state) {
                setLocalItems(currentItems => {
                    const finalItem = currentItems.find(i => i.id === state.itemId);
                    if (finalItem && state.hasMoved !== false) {
                        // IMPORTANT: Send ONLY the properties that were actually modified during drag/resize/rotate.
                        // Sending the entire object causes race conditions where concurrent updates
                        // (like font-family changes from the property panel) are overwritten by the stale drag-start state.
                        const updates: Partial<ICanvasItem> = {
                            x: finalItem.x,
                            y: finalItem.y,
                            width: finalItem.width,
                            height: finalItem.height,
                            rotation: finalItem.rotation,
                            pivotX: finalItem.pivotX,
                            pivotY: finalItem.pivotY,
                        };

                        // For text items, we might have forced a resizingMode change during the drag
                        if (finalItem.type === 'text' && finalItem.text) {
                            updates.text = { ...finalItem.text, resizingMode: finalItem.text.resizingMode };
                        }

                        updateCanvasItem(slideId, state.itemId, updates);
                    }
                    return currentItems;
                });
            }

            dragState.current = null;
            setPendingUpdate(true);
            setDragActive(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            setRotateCursorAngle(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [slideId, updateCanvasItem, getContainerRect, localItems, setDragActive, takeSnapshot]);

    const handleTextUpdate = useCallback((itemId: string, newContent: string) => {
        updateCanvasItem(slideId, itemId, {
            text: {
                ...canvasItems.find(i => i.id === itemId)?.text!,
                content: newContent
            }
        });
    }, [slideId, canvasItems, updateCanvasItem]);

    const handleTextSave = useCallback((itemId: string, newContent: string) => {
        setEditingId(null);
    }, [setEditingId]);

    const handleCancel = useCallback(() => {
        setEditingId(null);
        setTool('select');
    }, [setEditingId, setTool]);

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (e.target === containerRef.current) {
            setSelectedIds([]);
            setEditingId(null);
            setTool('select');
        }
    };
    // During drag, use localItems (optimistic). Otherwise, use store items directly (no useEffect delay).
    const renderItems = dragActive ? localItems : resolvedItems;
    const sortedItems = [...renderItems].sort((a, b) => a.zIndex - b.zIndex);

    return (
        <div
            ref={containerRef}
            className={cn(
                "absolute inset-0 z-20",
                tool === 'text' ? "cursor-text" : "cursor-default"
            )}
            onClick={handleCanvasClick}
            onMouseEnter={() => setSlidePreviewHovered(true)}
            onMouseLeave={() => setSlidePreviewHovered(false)}
            onDragOver={(e) => {
                if (e.dataTransfer.types.includes('application/json')) {
                    e.preventDefault();
                }
            }}
            onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();

                try {
                    const data = JSON.parse(e.dataTransfer.getData('application/json'));
                    if (data.source === 'media-pool' && (data.media.type === 'image' || data.media.type === 'video')) {
                        const rect = getContainerRect();
                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                        const y = ((e.clientY - rect.top) / rect.height) * 100;

                        await usePresentationStore.getState().addMediaLayer(slideId, data.media, { x, y });
                    }
                } catch (err) {
                    console.error('Failed to parse drop data', err);
                }
            }}
        >
            {sortedItems.map((item: ICanvasItem) => {
                const isSelected = selectedIds.includes(item.id);
                const isEditing = editingId === item.id;

                const isAutoWidth = item.type === 'text' && item.text?.resizingMode === 'auto-width';
                const isAutoHeight = item.type === 'text' && item.text?.resizingMode === 'auto-height';

                return (
                    <div
                        key={item.id}
                        id={`item-${item.id}`}
                        className={cn(
                            "absolute",
                            item.locked && "pointer-events-none opacity-60",
                            isEditing && "z-50"
                        )}
                        style={{
                            left: `${item.x}%`,
                            top: `${item.y}%`,
                            width: isAutoWidth ? 'max-content' : `${item.width}%`,
                            height: (isAutoWidth || isAutoHeight) ? 'max-content' : `${item.height}%`,
                            zIndex: isEditing ? 1000 : item.zIndex,
                            transform: `translate(-${item.pivotX ?? 50}%, -${item.pivotY ?? 50}%) rotate(${item.rotation || 0}deg) scale(${item.scale || 1})`,
                            transformOrigin: `${item.pivotX ?? 50}% ${item.pivotY ?? 50}%`,
                            cursor: item.locked ? 'default' : (isEditing ? 'text' : (tool === 'text' && item.type === 'text' ? 'text' : 'default')),
                        }}
                        onMouseDown={(e) => handleMouseDown(e, item, 'move')}
                        onDoubleClick={(e) => handleDoubleClick(e, item)}
                    >
                        {/* Selection Frame */}
                        {isSelected && !isEditing && (
                            <div className="absolute inset-0 ring-[1.5px] ring-accent ring-offset-0 pointer-events-none z-40" />
                        )}

                        <CanvasItemView
                            item={item}
                            isEditing={isEditing}
                            onSave={handleTextSave}
                            onInput={handleTextUpdate}
                            onCancel={handleCancel}
                        />

                        {/* Resize & Rotate handles */}
                        {isSelected && !item.locked && !isEditing && (
                            <>
                                <ResizeHandle pos="top-left" itemRotation={item.rotation || 0} itemScale={item.scale || 1} onMouseDown={(e) => handleMouseDown(e, item, 'resize', 'top-left')} onRotateMouseDown={(e) => handleMouseDown(e, item, 'rotate', 'top-left')} onRotateHover={setRotateCursorAngle} />
                                <ResizeHandle pos="top-center" itemRotation={item.rotation || 0} itemScale={item.scale || 1} onMouseDown={(e) => handleMouseDown(e, item, 'resize', 'top-center')} />
                                <ResizeHandle pos="top-right" itemRotation={item.rotation || 0} itemScale={item.scale || 1} onMouseDown={(e) => handleMouseDown(e, item, 'resize', 'top-right')} onRotateMouseDown={(e) => handleMouseDown(e, item, 'rotate', 'top-right')} onRotateHover={setRotateCursorAngle} />
                                <ResizeHandle pos="middle-left" itemRotation={item.rotation || 0} itemScale={item.scale || 1} onMouseDown={(e) => handleMouseDown(e, item, 'resize', 'middle-left')} />
                                <ResizeHandle pos="middle-right" itemRotation={item.rotation || 0} itemScale={item.scale || 1} onMouseDown={(e) => handleMouseDown(e, item, 'resize', 'middle-right')} />
                                <ResizeHandle pos="bottom-left" itemRotation={item.rotation || 0} itemScale={item.scale || 1} onMouseDown={(e) => handleMouseDown(e, item, 'resize', 'bottom-left')} onRotateMouseDown={(e) => handleMouseDown(e, item, 'rotate', 'bottom-left')} onRotateHover={setRotateCursorAngle} />
                                <ResizeHandle pos="bottom-center" itemRotation={item.rotation || 0} itemScale={item.scale || 1} onMouseDown={(e) => handleMouseDown(e, item, 'resize', 'bottom-center')} />
                                <ResizeHandle pos="bottom-right" itemRotation={item.rotation || 0} itemScale={item.scale || 1} onMouseDown={(e) => handleMouseDown(e, item, 'resize', 'bottom-right')} onRotateMouseDown={(e) => handleMouseDown(e, item, 'rotate', 'bottom-right')} onRotateHover={setRotateCursorAngle} />

                                {/* Pivot Point Indicator/Handle */}
                                <PivotHandle
                                    x={item.pivotX ?? 50}
                                    y={item.pivotY ?? 50}
                                    itemScale={item.scale || 1}
                                    onMouseDown={(e) => handleMouseDown(e, item, 'pivot')}
                                />
                            </>
                        )}
                    </div>
                );
            })}

            {/* Custom follow-cursor for rotation */}
            {rotateCursorAngle !== null && (
                <RotateCursor angle={rotateCursorAngle} />
            )}
        </div>
    );
};

interface ResizeHandleProps {
    pos: string;
    itemRotation: number;
    itemScale: number;
    onMouseDown: (e: React.MouseEvent) => void;
    onRotateMouseDown?: (e: React.MouseEvent) => void;
    onRotateHover?: (angle: number | null) => void;
}

const PivotHandle: React.FC<{
    x: number;
    y: number;
    itemScale: number;
    onMouseDown: (e: React.MouseEvent) => void;
}> = ({ x, y, itemScale, onMouseDown }) => {
    return (
        <div
            className="absolute z-60 cursor-crosshair group/pivot w-4 h-4"
            style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `scale(${1 / itemScale}) translate(-50%, -50%)`
            }}
            onMouseDown={(e) => {
                e.stopPropagation();
                onMouseDown(e);
            }}
        >
            {/* The visual crosshair center */}
            <div className="w-full h-full rounded-full border border-accent bg-accent/20 flex items-center justify-center shadow-lg">
                <div className="w-1 h-1 bg-accent rounded-full" />
                {/* Visual lines */}
                <div className="absolute w-6 h-px bg-accent/40" />
                <div className="absolute w-px h-6 bg-accent/40" />
            </div>
            {/* Label on hover */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-accent px-1.5 py-0.5 rounded text-[8px] font-bold text-accent-foreground opacity-0 group-hover/pivot:opacity-100 transition-opacity whitespace-nowrap">
                PIVOT
            </div>
        </div>
    );
};

const ResizeHandle: React.FC<ResizeHandleProps> = ({ pos, itemRotation, itemScale, onMouseDown, onRotateMouseDown, onRotateHover }) => {
    const classes: Record<string, string> = {
        'top-left': '-top-1.25 -left-1.25',
        'top-center': '-top-1.25 left-1/2 -translate-x-1/2',
        'top-right': '-top-1.25 -right-1.25',
        'middle-left': 'top-1/2 -left-1.25 -translate-y-1/2',
        'middle-right': 'top-1/2 -right-1.25 -translate-y-1/2',
        'bottom-left': '-bottom-1.25 -left-1.25',
        'bottom-center': '-bottom-1.25 left-1/2 -translate-x-1/2',
        'bottom-right': '-bottom-1.25 -right-1.25',
    };

    const isCorner = (pos.includes('-left') || pos.includes('-right')) && !pos.includes('middle');
    const resizeCursor = getCursorForCorner(pos, itemRotation);
    const rotateAngle = getRotateAngle(pos, itemRotation);

    // Rotation zone: 16px outward from the corner, positioned OUTSIDE the element.
    const rotateZoneOffsets: Record<string, React.CSSProperties> = {
        'top-left': { top: -16, left: -16, width: 26, height: 26 },
        'top-right': { top: -16, right: -16, width: 26, height: 26 },
        'bottom-left': { bottom: -16, left: -16, width: 26, height: 26 },
        'bottom-right': { bottom: -16, right: -16, width: 26, height: 26 },
    };

    return (
        <div className={cn("absolute z-50", classes[pos])} style={{ transform: `scale(${1 / itemScale})` }}>
            {/* Rotation Hit Zone — 16px outward from corner, hides system cursor */}
            {isCorner && onRotateMouseDown && (
                <div
                    className="absolute"
                    style={{ cursor: 'none', ...rotateZoneOffsets[pos] }}
                    onMouseEnter={() => onRotateHover?.(rotateAngle)}
                    onMouseLeave={() => onRotateHover?.(null)}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        onRotateMouseDown(e);
                    }}
                />
            )}
            {/* The visible square handle — resize (on top of rotation zone) */}
            <div
                className="relative z-10 w-2.5 h-2.5 bg-accent border border-accent shadow-sm"
                style={{ cursor: resizeCursor }}
                onMouseEnter={() => onRotateHover?.(null)}
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onMouseDown(e);
                }}
            />
        </div>
    );
};

const getCursorForCorner = (pos: string, rotation: number): string => {
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

const getRotateAngle = (pos: string, rotation: number): number => {
    const cornerAngles: Record<string, number> = {
        'top-left': 0,
        'top-right': 90,
        'bottom-right': 180,
        'bottom-left': 270,
    };
    return (cornerAngles[pos] ?? 0) + rotation;
};

const RotateCursor: React.FC<{ angle: number }> = ({ angle }) => {
    const [pos, setPos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
        window.addEventListener('mousemove', onMove);
        return () => window.removeEventListener('mousemove', onMove);
    }, []);

    return createPortal(
        <div
            style={{
                position: 'fixed',
                left: 0,
                top: 0,
                pointerEvents: 'none',
                transform: `translate3d(${pos.x - 14}px, ${pos.y - 14}px, 0)`,
                zIndex: 99999,
            }}
        >
            <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ transform: `rotate(${angle}deg)`, display: 'block' }}
            >
                <path
                    d="M 8 7 A 7.5 7.5 0 0 1 20 7"
                    stroke="white"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    fill="none"
                />
                <polygon points="5,5 9,7 6,10" fill="white" />
                <polygon points="23,5 19,7 22,10" fill="white" />

                <path
                    d="M 8 7 A 7.5 7.5 0 0 1 20 7"
                    stroke="black"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                />
                <polygon points="5,5 9,7 6,10" fill="black" />
                <polygon points="23,5 19,7 22,10" fill="black" />
            </svg>
        </div>,
        document.body
    );
};

export default SlideCanvas;
