import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, Lock, Trash2, Layers } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ICanvasItem } from '@/core/types';

interface ISortableCanvasItemProps {
    item: ICanvasItem;
    isSelected: boolean;
    onSelect: (id: string[]) => void;
    onUpdate: (id: string, updates: Partial<ICanvasItem>) => void;
    onRemove: (id: string) => void;
    onLock: (id: string, locked: boolean) => void;
    elementButtons: { type: string; icon: React.ElementType; label: string }[];
    t: (key: string, fallback?: string) => string;
}

export const SortableCanvasItem: React.FC<ISortableCanvasItemProps> = ({
    item,
    isSelected,
    onSelect,
    onUpdate,
    onRemove,
    onLock,
    elementButtons,
    t
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const ItemIcon = elementButtons.find(e => e.type === item.type)?.icon || Layers;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex flex-col gap-1.5",
                isDragging && "opacity-80 z-50 scale-[1.02] shadow-[0_0_30px_rgba(0,0,0,0.5)]"
            )}
        >
            <div
                onClick={() => onSelect([item.id])}
                className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-2xl group cursor-pointer border",
                    !isDragging && "transition-all",
                    isSelected
                        ? "bg-accent/10 border-accent/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]"
                        : "bg-black/30 border-white/5 hover:border-white/10 hover:bg-white/2"
                )}
            >
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-white/5 rounded-md transition-colors">
                    <div className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center transition-colors border",
                        isSelected ? "bg-accent/20 border-accent/30 text-accent" : "bg-white/5 border-white/5 text-stone-500 group-hover:text-stone-300"
                    )}>
                        <ItemIcon className="w-3.5 h-3.5" />
                    </div>
                </div>

                <span className={cn("text-[10px] font-bold uppercase tracking-wider flex-1 min-w-0 truncate transition-colors", isSelected ? "text-accent" : "text-stone-400 group-hover:text-stone-200")}>
                    {item.type}{item.text ? `: ${item.text.content} ` : ''}
                </span>

                <div className="flex items-center gap-0.5">
                    <button
                        onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { visible: item.visible === false }) }}
                        className={cn(
                            "p-1.5 rounded-lg transition-all cursor-pointer",
                            item.visible === false
                                ? "text-accent bg-accent/10 opacity-100"
                                : "text-stone-600 hover:text-stone-400 hover:bg-white/5 opacity-0 group-hover:opacity-100"
                        )}
                        title={item.visible === false ? t('show') : t('hide')}
                    >
                        {item.visible === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onLock(item.id, !item.locked) }}
                        className={cn(
                            "p-1.5 rounded-lg transition-all cursor-pointer",
                            item.locked
                                ? "text-accent bg-accent/10 opacity-100"
                                : "text-stone-600 hover:text-stone-400 hover:bg-white/5 opacity-0 group-hover:opacity-100"
                        )}
                        title={item.locked ? t('unlock') : t('lock')}
                    >
                        <Lock className={cn("w-3.5 h-3.5", item.locked && "fill-current")} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-stone-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        aria-label={t('delete')}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
