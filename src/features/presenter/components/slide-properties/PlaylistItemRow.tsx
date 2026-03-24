import React from 'react';
import { cn } from '@/core/utils/cn';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { Music, Trash2, GripVertical, RefreshCw } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';

interface IPlaylistItemRowProps {
    id: string;
    index: number;
    onRemove: (index: number) => void;
    onReplace: (index: number) => void;
    t: (key: string, fallback?: string) => string;
}

export const PlaylistItemRow: React.FC<IPlaylistItemRowProps> = ({ id, index, onRemove, onReplace, t }) => {
    const mediaItem = useLiveQuery(() => db.mediaPool.get(id), [id]);
    const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number } | null>(null);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `${id}-${index}` });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onContextMenu={handleContextMenu}
            className={cn(
                "flex items-center gap-3 p-3 hover:bg-white/5 transition-colors group relative",
                isDragging && "bg-white/10 opacity-50 ring-1 ring-accent/30"
            )}
        >
            <div
                {...attributes}
                {...listeners}
                className="cursor-pointer opacity-0 group-hover:opacity-40 hover:opacity-100 transition-opacity p-1 -ml-1"
            >
                <GripVertical className="w-3.5 h-3.5 text-stone-400" />
            </div>

            <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/5 shadow-inner">
                <Music className="w-3.5 h-3.5 text-stone-500" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white truncate">{mediaItem?.name || t('unknown_file', 'Unknown File')}</p>
                <p className="text-[9px] text-stone-600 font-bold uppercase tracking-wider">{t('audio_item', 'Audio Item')}</p>
            </div>
            <button
                onClick={() => onRemove(index)}
                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-stone-500 hover:text-red-400 rounded-lg transition-all cursor-pointer"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                >
                    <ContextMenuItem
                        icon={<RefreshCw className="w-3.5 h-3.5" />}
                        label={t('replace_audio', 'Replace audio')}
                        onClick={() => {
                            onReplace(index);
                            setContextMenu(null);
                        }}
                    />
                    <ContextMenuItem
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                        label={t('delete', 'Delete')}
                        danger
                        onClick={() => {
                            onRemove(index);
                            setContextMenu(null);
                        }}
                    />
                </ContextMenu>
            )}
        </div>
    );
};
