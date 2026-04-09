import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useAtom } from 'jotai';
import { slideEditorDragActiveAtom, slideEditorPendingUpdateAtom } from '@/core/store/uiAtoms';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { Plus, X } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { IStyleLayer, BackgroundSettings } from '@/core/types';
import { ensureLayers } from '@/core/utils/styleMigration';
import { FloatingPopover } from '@/components/FloatingPopover';
import { CustomColorPicker } from '@/components/CustomColorPicker';
import { LayerItem } from '../slide-properties/LayerItem';

// ─── Inline Background Picker ───────────────────────────────────────────
interface IInlineBackgroundPickerProps {
    label?: string;
    value: IStyleLayer[] | BackgroundSettings | undefined;
    onChange: (v: IStyleLayer[] | undefined) => void;
    onRemove?: () => void;
}

export const InlineBackgroundPicker: React.FC<IInlineBackgroundPickerProps> = ({
    label,
    value,
    onChange,
    onRemove,
}) => {
    const [, setDragActive] = useAtom(slideEditorDragActiveAtom);
    const [, setPendingUpdate] = useAtom(slideEditorPendingUpdateAtom);
    const layers = useMemo(() => ensureLayers(value), [value]);

    const onDragStart = useCallback(() => setDragActive(true), [setDragActive]);
    const onDragEndProp = useCallback(() => {
        setDragActive(false);
        setPendingUpdate(true);
    }, [setDragActive, setPendingUpdate]);
    const onDragCancel = useCallback(() => setDragActive(false), [setDragActive]);

    const handleAddLayer = () => {
        const newLayer: IStyleLayer = {
            id: crypto.randomUUID(),
            type: 'color',
            visible: true,
            opacity: 1,
            blendMode: 'normal',
            color: '#1c1917',
            adjustments: { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, hue: 0, blur: 0 }
        };
        onChange([...layers, newLayer]);
    };

    const handleUpdateLayer = (id: string, updates: Partial<IStyleLayer>) => {
        onChange(layers.map(l => l.id === id ? { ...l, ...updates } : l));
    };

    const handleRemoveLayer = (id: string) => {
        const remaining = layers.filter(l => l.id !== id);
        if (remaining.length === 0 && onRemove) {
            onRemove();
        } else {
            onChange(remaining);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = layers.findIndex((l) => l.id === active.id);
            const newIndex = layers.findIndex((l) => l.id === over.id);
            onChange(arrayMove(layers, oldIndex, newIndex));
        }
    };

    const reversedLayers = [...layers].reverse();

    return (
        <div className="flex flex-col gap-1 w-full relative">
            {label && (
                <div className="flex items-center justify-between px-1 mb-1 group">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-3 bg-accent rounded-full" />
                        <span className="text-[9px] font-black text-stone-500 uppercase tracking-[0.2em]">{label}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={handleAddLayer} className="cursor-pointer p-1 hover:bg-white/10 rounded-lg active:bg-white/20 transition-all">
                            <Plus className="w-3.5 h-3.5 text-stone-400 hover:text-accent transition-colors" />
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[400px] no-scrollbar">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={onDragStart}
                    onDragEnd={(event) => {
                        handleDragEnd(event);
                        onDragEndProp?.();
                    }}
                    onDragCancel={onDragCancel}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                >
                    <SortableContext
                        items={reversedLayers.map(l => l.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {reversedLayers.map((layer, index) => (
                            <LayerItem
                                key={layer.id}
                                layer={layer}
                                index={index}
                                total={layers.length}
                                onUpdate={(updates) => handleUpdateLayer(layer.id, updates)}
                                onRemove={() => handleRemoveLayer(layer.id)}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
};


// ─── Color Picker Field ─────────────────────────────────────────────────
interface IColorPickerFieldProps {
    label: React.ReactNode;
    value: string | undefined;
    onChange: (v: string) => void;
}

export const ColorPickerField: React.FC<IColorPickerFieldProps> = ({ label, value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);

    return (
        <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1.5 rounded-lg border border-white/5 flex-1 min-w-0 group hover:border-white/20 transition-colors w-[60px] relative">
            <span className="text-[10px] font-bold text-stone-400 uppercase w-2 shrink-0 select-none pointer-events-none text-center" title="Color Picker">{label}</span>
            <div
                ref={triggerRef}
                className="flex-1 flex items-center gap-1 cursor-pointer min-w-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div
                    className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: value || 'transparent' }}
                />
                <span className="text-[10px] text-stone-400 font-mono uppercase truncate min-w-0">
                    {value ? value.substring(1, 7) : 'NONE'}
                </span>
            </div>
            {value && (
                <button
                    onClick={(e) => { e.stopPropagation(); onChange(''); }}
                    onMouseDown={(e) => e.preventDefault()}
                    className="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 text-stone-600 rounded cursor-pointer"
                    title="Clear color"
                >
                    <X className="w-2.5 h-2.5" />
                </button>
            )}

            <FloatingPopover
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                anchorRef={triggerRef}
                title={`${label} Color`}
                width={280}
            >
                <CustomColorPicker color={value || '#000000'} onChange={onChange} />
            </FloatingPopover>
        </div>
    );
};
