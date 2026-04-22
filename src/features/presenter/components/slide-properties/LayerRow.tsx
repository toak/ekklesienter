import React from 'react';
import { useTranslation } from 'react-i18next';
import { ICanvasItem } from '@/core/types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    ImageIcon, Square, Minus, Palette, Video, Type,
    Eye, EyeOff, Lock, Unlock, Trash2, GripVertical
} from 'lucide-react';
import { cn } from '@/core/utils/cn';

// ─── Layer type icon mapping ───────────────────────────────────────────────
const ITEM_TYPE_ICONS: Record<string, React.ElementType> = {
    text: Type,
    image: ImageIcon,
    video: Video,
    shape: Square,
    stroke: Minus,
    effect: Palette,
};

export interface ILayerRowProps {
    item: ICanvasItem;
    isSelected: boolean;
    onSelect: (id: string, e: React.MouseEvent) => void;
    onUpdate: (id: string, updates: Partial<ICanvasItem>) => void;
    onRemove: (id: string) => void;
}

export const LayerRow: React.FC<ILayerRowProps> = ({ item, isSelected, onSelect, onUpdate, onRemove }) => {
    const { t } = useTranslation();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    const Icon = ITEM_TYPE_ICONS[item.type] || Square;

    const getLabel = () => {
        if (item.type === 'text' && item.text?.content) {
            const stripped = item.text.content.replace(/<[^>]*>/g, '').trim();
            return stripped.length > 22 ? stripped.slice(0, 22) + '…' : stripped || t('type_text');
        }
        return t(`layer_type_${item.type}`, { defaultValue: item.type.charAt(0).toUpperCase() + item.type.slice(1) });
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group flex items-center gap-2 px-2 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer select-none",
                isDragging && "opacity-60 z-50 shadow-xl scale-[1.01]",
                isSelected
                    ? "bg-accent/10 border-accent/25 shadow-[inset_0_0_0_1px_rgba(234,179,8,0.15)]"
                    : "bg-transparent border-transparent hover:bg-white/4 hover:border-white/8"
            )}
            onClick={(e) => onSelect(item.id, e)}
        >
            {/* Drag handle */}
            <div
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
                className="p-0.5 text-stone-700 hover:text-stone-400 cursor-grab active:cursor-grabbing shrink-0 transition-colors pointer-events-auto"
            >
                <GripVertical className="w-3 h-3 pointer-events-none" />
            </div>

            {/* Type icon */}
            <div className={cn(
                "w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors",
                isSelected
                    ? "bg-accent/20 border-accent/30 text-accent"
                    : "bg-white/5 border-white/5 text-stone-500"
            )}>
                <Icon className="w-3 h-3" />
            </div>

            {/* Label */}
            <span className={cn(
                "flex-1 text-[11px] font-medium truncate transition-colors",
                isSelected ? "text-white" : "text-stone-400 group-hover:text-stone-200"
            )}>
                {getLabel()}
            </span>

            {/* Action buttons — visible on hover/selected */}
            <div className={cn(
                "flex items-center gap-0.5 transition-opacity",
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )} onClick={(e) => e.stopPropagation()}>
                <button
                    onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { visible: item.visible === false ? true : false }); }}
                    className={cn(
                        "p-1 rounded-md transition-all cursor-pointer",
                        item.visible === false
                            ? "text-stone-600 hover:text-stone-400"
                            : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
                    )}
                    title={item.visible === false ? t('show') : t('hide')}
                >
                    {item.visible === false
                        ? <EyeOff className="w-3 h-3" />
                        : <Eye className="w-3 h-3" />
                    }
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { locked: !item.locked }); }}
                    className={cn(
                        "p-1 rounded-md transition-all cursor-pointer",
                        item.locked
                            ? "text-accent"
                            : "text-stone-500 hover:text-stone-300 hover:bg-white/5"
                    )}
                    title={item.locked ? t('unlock') : t('lock')}
                >
                    {item.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                    className="p-1 rounded-md text-stone-600 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                    title={t('delete')}
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
};
