import React, { useCallback, useRef, useEffect, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import {
    slideEditorDragActiveAtom,
    slideEditorPendingUpdateAtom,
    slidePreviewHoveredAtom,
} from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ICanvasItem, ICanvasSlide } from '@/core/types';
import { cn } from '@/core/utils/cn';
import CanvasItemView from './CanvasItemView';
import { useCanvasInteraction } from '@/features/presenter/hooks/useCanvasInteraction';
import { ResizeHandle, PivotHandle, RotateCursor } from './CanvasHandles';
import { CanvasSelectionFrame } from './CanvasSelectionFrame';

interface SlideCanvasProps {
    slideId: string;
    canvasItems: ICanvasItem[];
}

/**
 * Canvas overlay on the slide display for drag/resize of positioned items.
 * Uses percentage-based coordinates to maintain consistency across scales.
 */
const SlideCanvas: React.FC<SlideCanvasProps> = ({ slideId, canvasItems }) => {
    const { removeCanvasItem } = usePresentationStore();
    const [, setSlidePreviewHovered] = useAtom(slidePreviewHoveredAtom) as [boolean, (v: boolean) => void];

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
    const dragActive = useAtomValue(slideEditorDragActiveAtom);
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
    const getContainerRect = useCallback(() => {
        return containerRef.current?.getBoundingClientRect() || { left: 0, top: 0, width: 1, height: 1 };
    }, []);

    const {
        handleMouseDown,
        rotateCursorAngle,
        setRotateCursorAngle,
        selectedIds,
        setSelectedIds,
        editingId,
        setEditingId,
        tool,
        setTool,
    } = useCanvasInteraction(slideId, localItems, setLocalItems, getContainerRect);

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

    const handleDoubleClick = useCallback((e: React.MouseEvent, item: ICanvasItem) => {
        if (item.locked || item.type !== 'text') return;
        e.stopPropagation();
        setEditingId(item.id);
        setSelectedIds([item.id]);
        setTool('text');
    }, [setEditingId, setSelectedIds, setTool]);

    const handleTextUpdate = useCallback((itemId: string, newContent: string) => {
        usePresentationStore.getState().updateCanvasItem(slideId, itemId, {
            text: {
                ...resolvedItems.find(i => i.id === itemId)?.text!,
                content: newContent
            }
        });
    }, [slideId, resolvedItems]);

    const handleTextSave = useCallback(() => {
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
                        <CanvasSelectionFrame isSelected={isSelected} isEditing={isEditing} />

                        <CanvasItemView
                            item={item}
                            isEditing={isEditing}
                            onSave={handleTextSave}
                            onInput={handleTextUpdate}
                            onCancel={handleCancel}
                        />

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

            {rotateCursorAngle !== null && (
                <RotateCursor angle={rotateCursorAngle} />
            )}
        </div>
    );
};

export default SlideCanvas;
