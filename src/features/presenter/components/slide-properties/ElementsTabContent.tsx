import React from 'react';
import { ICanvasItem } from '@/core/types';
import type { TFunction } from 'i18next';
import {
    DndContext, closestCenter, useSensors,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';

import { createCanvasItem, ELEMENT_BUTTONS, SHAPE_OPTIONS } from '../slide-properties/helpers';
import { SortableCanvasItem } from '../slide-properties/SortableCanvasItem';

interface IElementsTabContentProps {
    localItems: ICanvasItem[];
    setLocalItems: (items: ICanvasItem[]) => void;
    selectedItemId: string | null;
    sensors: ReturnType<typeof useSensors>;
    setDragActive: (v: boolean) => void;
    setPendingUpdate: (v: boolean) => void;
    previewSlideId: string | undefined;
    updateCanvasItemsOrder: (slideId: string, items: ICanvasItem[]) => void;
    setSelectedIds: (ids: string[]) => void;
    updateCanvasItemLocal: (id: string, updates: Partial<ICanvasItem>) => void;
    handleRemoveItem: (id: string) => void;
    handleAddElement: (type: string) => void;
    addCanvasItem: (slideId: string, item: ICanvasItem) => void;
    isRu: boolean;
    t: TFunction;
}

export const ElementsTabContent: React.FC<IElementsTabContentProps> = ({
    localItems, setLocalItems, selectedItemId, sensors, setDragActive, setPendingUpdate,
    previewSlideId, updateCanvasItemsOrder, setSelectedIds, updateCanvasItemLocal,
    handleRemoveItem, handleAddElement, addCanvasItem, isRu, t,
}) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
        {/* Add Element Grid */}
        <div className="bg-white/2 border border-white/5 rounded-3xl p-5 space-y-4">
            <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em] px-1">{t('add_element', 'Add Element')}</label>
            <div className="grid grid-cols-3 gap-2">
                {ELEMENT_BUTTONS.map(({ type, icon: Icon, label, labelRu }) => (
                    <button key={type} onClick={() => handleAddElement(type)} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-black/30 border border-white/5 hover:border-accent/30 hover:bg-accent/5 transition-all duration-200 cursor-pointer group active:scale-95">
                        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:bg-accent/10 group-hover:border-accent/20 transition-colors"><Icon className="w-4 h-4 text-stone-500 group-hover:text-accent transition-colors" /></div>
                        <span className="text-[9px] font-bold text-stone-600 group-hover:text-stone-300 uppercase tracking-wider transition-colors">{isRu ? labelRu : label}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* Shapes */}
        <div className="bg-white/2 border border-white/5 rounded-3xl p-5 space-y-4">
            <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em] px-1">{t('shapes', 'Shapes')}</label>
            <div className="flex gap-2">
                {SHAPE_OPTIONS.map(({ type, icon: Icon, label }) => (
                    <button key={type} onClick={() => { if (!previewSlideId) return; const item = createCanvasItem('shape'); if (item.shape) item.shape.shapeType = type; addCanvasItem(previewSlideId, item); }} className="flex-1 p-3 rounded-xl bg-black/30 border border-white/5 hover:border-accent/30 hover:bg-accent/5 transition-all cursor-pointer group active:scale-95" title={label}>
                        <Icon className="w-5 h-5 mx-auto text-stone-600 group-hover:text-accent transition-colors" />
                    </button>
                ))}
            </div>
        </div>

        {/* Layer List */}
        {localItems.length > 0 && (
            <div className="bg-white/2 border border-white/5 rounded-3xl p-5 space-y-3">
                <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em] px-1">{t('layers', 'Layers')} ({localItems.length})</label>
                <div className="space-y-1.5 flex flex-col">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => setDragActive(true)} onDragEnd={(event) => {
                        setDragActive(false);
                        const { active, over } = event;
                        if (over && active.id !== over.id) {
                            const oldIndex = localItems.findIndex(i => i.id === active.id);
                            const newIndex = localItems.findIndex(i => i.id === over.id);
                            const len = localItems.length;
                            const reordered = arrayMove(localItems, oldIndex, newIndex).map((item, idx) => ({ ...item, zIndex: (len - 1 - idx) * 10 }));
                            setPendingUpdate(true); setLocalItems(reordered);
                            if (previewSlideId) updateCanvasItemsOrder(previewSlideId, reordered);
                        }
                    }} onDragCancel={() => setDragActive(false)} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
                        <SortableContext items={localItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                            {localItems.map((item) => (
                                <SortableCanvasItem key={item.id} item={item} isSelected={selectedItemId === item.id} onSelect={setSelectedIds} onUpdate={updateCanvasItemLocal} onRemove={handleRemoveItem} onLock={(id, locked) => updateCanvasItemLocal(id, { locked })} elementButtons={ELEMENT_BUTTONS} t={t as never} />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>
            </div>
        )}
    </div>
);
