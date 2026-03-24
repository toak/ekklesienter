import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
    Plus, Music, Film, Image as ImageIcon, Trash2, Edit2, 
    RefreshCw, Play, Pause, FolderOpen, FolderPlus, 
    ChevronLeft, ArrowRight, X 
} from 'lucide-react';
import { db } from '@/core/db';
import { IMediaItem, IMediaBin, MediaType } from '@/core/types';
import { cn } from '@/core/utils/cn';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useMediaUrl, getLocalResourceUrl } from '@/core/hooks/useMediaUrl';
import { toast } from '@/core/utils/toast';
import { IpcService } from '@/core/services/IpcService';

// ─── Context menu state types ───
interface IMediaContextMenu {
    x: number;
    y: number;
    kind: 'item';
    item: IMediaItem;
}

interface IBinContextMenu {
    x: number;
    y: number;
    kind: 'bin';
    bin: IMediaBin;
}

type ContextMenuState = IMediaContextMenu | IBinContextMenu | null;

// ─── Constants ───
const CARD_BG = "bg-stone-700/40 hover:bg-stone-700/60";
const THUMB_BG = "bg-stone-900";
const STRIP_BG = "bg-stone-950/20";

/**
 * Main Media Pool Panel component.
 */
export const MediaPoolPanel: React.FC = () => {
    const { t } = useTranslation();
    const { openModal } = useModalStore();
    const [filter, setFilter] = useState<MediaType | 'all'>('all');
    const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
    const [playingItemId, setPlayingItemId] = useState<string | null>(null);
    const [mediaTimes, setMediaTimes] = useState<Record<string, { current: number; duration: number }>>({});
    const [activeBinId, setActiveBinId] = useState<string | null>(null);
    const [draggingOverId, setDraggingOverId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
    const scrubAudioRef = useRef<HTMLAudioElement | null>(null);
    const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

    // ─── Queries ───
    const bins = useLiveQuery(() => db.mediaBins.orderBy('createdAt').toArray(), []) || [];
    const mediaItems = useLiveQuery(
        () => {
            if (filter === 'all') {
                return db.mediaPool.orderBy('createdAt').reverse().toArray();
            } else {
                return db.mediaPool.where('type').equals(filter).reverse().toArray();
            }
        },
        [filter]
    ) || [];

    const visibleItems = activeBinId
        ? mediaItems.filter(i => i.binId === activeBinId)
        : mediaItems.filter(i => !i.binId);

    const activeBin = activeBinId ? bins.find(b => b.id === activeBinId) : null;

    // Preload audio durations using AudioContext for audio items without stored duration
    useEffect(() => {
        const audioOnly = visibleItems.filter(i => i.type === 'audio' && !mediaTimes[i.id]);
        for (const item of audioOnly) {
            // Priority: if it has data blob, we'd need to fetch it.
            // For now, only handle items with path.
            if (!item.path) continue;
            
            const url = getLocalResourceUrl(item.path);
            fetch(url)
                .then(res => res.arrayBuffer())
                .then(buf => {
                    const ctx = new AudioContext();
                    return ctx.decodeAudioData(buf).then(decoded => {
                        setMediaTimes(prev => ({
                            ...prev,
                            [item.id]: prev[item.id] ?? { current: 0, duration: decoded.duration }
                        }));
                        ctx.close();
                    });
                })
                .catch(() => { /* mute errors */ });
        }
    }, [visibleItems.length]); // Dependencies roughly based on list change

    // ─── Handlers ───
    const handleImportMedia = async () => {
        if (!IpcService.isElectron()) return;
        try {
            const files = await IpcService.selectFile({
                properties: ['openFile', 'multiSelections'],
                filters: [
                    { name: 'Media Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] }
                ]
            });

            if (!files) return;
            const filePaths = Array.isArray(files) ? files : [files];
            const newItems: IMediaItem[] = [];

            // Pre-fetch all existing paths to deduplicate efficiently
            const existingItems = await db.mediaPool.toArray();
            const existingPaths = new Set(existingItems.map(item => item.path));

            let skippedCount = 0;

            for (const filePath of filePaths) {
                if (existingPaths.has(filePath)) {
                    skippedCount++;
                    continue;
                }

                const name = filePath.split(/[/\\]/).pop() || 'Untitled';
                const ext = filePath.split('.').pop()?.toLowerCase();

                let type: MediaType = 'image';
                if (['mp4', 'webm', 'mov'].includes(ext || '')) type = 'video';
                if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext || '')) type = 'audio';

                newItems.push({
                    id: crypto.randomUUID(),
                    name,
                    path: filePath,
                    type,
                    binId: activeBinId ?? undefined,
                    createdAt: Date.now() + newItems.length // Ensure slightly different timestamps
                });
            }


            if (newItems.length > 0) {
                await db.mediaPool.bulkAdd(newItems);
                toast.success(t('media_imported', 'Imported {{count}} files', { count: newItems.length }) + (skippedCount > 0 ? ` (${skippedCount} skipped)` : ''));
            } else if (skippedCount > 0) {
                toast.info(`Skipped ${skippedCount} already imported files`);
            }
        } catch (error) {
            console.error('Failed to import media:', error);
            toast.error(t('import_error', 'Failed to import media'));
        }
    };

    const handleItemClick = (itemId: string, e: React.MouseEvent) => {
        const newSelection = new Set(selectedIds);
        
        if (e.shiftKey && lastSelectedId) {
            // Find range in visibleItems
            const currentIndex = visibleItems.findIndex(i => i.id === itemId);
            const lastIndex = visibleItems.findIndex(i => i.id === lastSelectedId);
            
            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex);
                const end = Math.max(currentIndex, lastIndex);
                const rangeIds = visibleItems.slice(start, end + 1).map(i => i.id);
                
                // When holding shift, we typically add the range to current selection if Cmd is held,
                // but usually it just replaces the selection relative to the anchor.
                if (!e.metaKey && !e.ctrlKey) newSelection.clear();
                rangeIds.forEach(id => newSelection.add(id));
            }
        } else if (e.metaKey || e.ctrlKey) {
            if (newSelection.has(itemId)) {
                newSelection.delete(itemId);
            } else {
                newSelection.add(itemId);
            }
            setLastSelectedId(itemId);
        } else {
            newSelection.clear();
            newSelection.add(itemId);
            setLastSelectedId(itemId);
        }
        
        setSelectedIds(newSelection);
    };

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;
        
        const count = selectedIds.size;
        openModal(ModalType.CONFIRM, {
            title: t('media_pool.delete', 'Delete Assets'),
            message: count === 1 
                ? t('media_pool.confirm_delete', 'Delete this asset?')
                : t('media_pool.confirm_delete_multiple', 'Delete {{count}} assets?', { count }),
            onSelection: (confirmed: boolean) => {
                if (confirmed) {
                    db.mediaPool.bulkDelete(Array.from(selectedIds));
                    setSelectedIds(new Set());
                }
            }
        });
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only trigger if no input is focused
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
            
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedIds.size > 0) {
                    handleBulkDelete();
                }
            }
            
            if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
                e.preventDefault();
                setSelectedIds(new Set(visibleItems.map(i => i.id)));
            }
            
            if (e.key === 'Escape') {
                setSelectedIds(new Set());
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, visibleItems]);

    const handleCreateBin = () => {
        openModal(ModalType.PROMPT, {
            title: t('media_pool.new_bin', 'New Bin Name'),
            onSelection: async (name: string | null) => {
                if (!name?.trim()) return;
                await db.mediaBins.add({
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    createdAt: Date.now()
                });
            }
        });
    };

    const handleDragStart = (e: React.DragEvent, item: IMediaItem) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            source: 'media-pool',
            media: item
        }));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const togglePlayback = (e: React.MouseEvent, item: IMediaItem) => {
        e.stopPropagation();
        if (playingItemId === item.id) {
            setPlayingItemId(null);
            if (item.type === 'audio' && scrubAudioRef.current) {
                scrubAudioRef.current.pause();
            } else if (item.type === 'video') {
                videoRefs.current[item.id]?.pause();
            }
        } else {
            // Stop current
            if (playingItemId) {
                const currentItem = mediaItems.find(i => i.id === playingItemId);
                if (currentItem?.type === 'audio' && scrubAudioRef.current) {
                    scrubAudioRef.current.pause();
                } else if (currentItem?.type === 'video') {
                    videoRefs.current[playingItemId]?.pause();
                }
            }

            setPlayingItemId(item.id);
            if (item.type === 'audio' && scrubAudioRef.current) {
                // Audio is handled by global player for simplicity
                const url = getLocalResourceUrl(item.path);
                if (scrubAudioRef.current.src !== url) {
                    scrubAudioRef.current.src = url;
                    scrubAudioRef.current.load();
                }
                scrubAudioRef.current.play().catch(() => {});
            } else if (item.type === 'video') {
                videoRefs.current[item.id]?.play().catch(() => {});
            }
        }
    };

    const handleTimeUpdate = (itemId: string, current: number, duration: number) => {
        setMediaTimes(prev => ({
            ...prev,
            [itemId]: { current, duration }
        }));
    };

    const handleBinDrop = async (e: React.DragEvent, binId: string | undefined) => {
        e.preventDefault();
        setDraggingOverId(null);
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.source === 'media-pool' && data.media?.id) {
                await db.mediaPool.update(data.media.id, { binId: binId });
            }
        } catch (err) {
            console.warn('Drop failed:', err);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* ─── Toolbar ─── */}
            <div className="flex items-center gap-1.5 mb-1.5 shrink-0">
                <button
                    type="button"
                    onClick={handleImportMedia}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-[10px] font-semibold transition-colors cursor-pointer"
                >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('media_pool.import', 'Import')}</span>
                </button>

                <button
                    type="button"
                    onClick={handleCreateBin}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-[10px] font-semibold transition-colors cursor-pointer"
                >
                    <FolderPlus className="w-3.5 h-3.5" />
                </button>

                <div className="flex-1" />

                <div className="flex items-center gap-0.5">
                    {(['all', 'image', 'video', 'audio'] as const).map(f => (
                        <button
                            type="button"
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer",
                                filter === f
                                    ? "bg-accent/15 text-accent"
                                    : "text-stone-500 hover:text-stone-300 hover:bg-stone-800"
                            )}
                        >
                            {f === 'all' ? t('media_pool.all', 'All') : t(`media_pool.${f}`, f.charAt(0).toUpperCase() + f.slice(1))}
                        </button>
                    ))}
                </div>
            </div>

            {/* ─── Breadcrumb ─── */}
            {activeBinId && (
                <div className="flex items-center gap-1 mb-1.5 shrink-0 text-[10px]">
                    <button
                        type="button"
                        onClick={() => setActiveBinId(null)}
                        onDragOver={(e) => { e.preventDefault(); setDraggingOverId('root'); }}
                        onDrop={(e) => handleBinDrop(e, undefined)}
                        className={cn(
                            "flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer",
                            draggingOverId === 'root' ? "bg-accent/20 text-accent" : "text-stone-500 hover:text-stone-300"
                        )}
                    >
                        <ChevronLeft className="w-3 h-3" />
                        <span>{t('media_pool.root', 'Media Pool')}</span>
                    </button>
                    <ArrowRight className="w-2.5 h-2.5 text-stone-600" />
                    <span className="text-stone-300 font-semibold truncate">{activeBin?.name}</span>
                </div>
            )}

            {/* ─── Media Grid ─── */}
            <div className="@container flex-1 overflow-y-auto no-scrollbar min-h-0 px-1 pt-1">
                <div className="grid grid-cols-1 @[240px]:grid-cols-2 @[400px]:grid-cols-3 gap-1.5 pb-4">
                    
                    {/* ── Bins ── */}
                    {!activeBinId && bins.map(bin => {
                        const isDraggingOver = draggingOverId === bin.id;
                        return (
                            <div
                                key={bin.id}
                                onClick={() => setActiveBinId(bin.id)}
                                onDragOver={(e) => { e.preventDefault(); setDraggingOverId(bin.id); }}
                                onDragLeave={() => setDraggingOverId(null)}
                                onDrop={(e) => handleBinDrop(e, bin.id)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setContextMenu({ x: e.clientX, y: e.clientY, kind: 'bin', bin });
                                }}
                                className={cn(
                                    "group flex flex-col rounded-md overflow-hidden transition-all cursor-pointer",
                                    isDraggingOver ? "bg-accent/10 ring-1 ring-accent" : CARD_BG
                                )}
                            >
                                <div className="flex items-center gap-1.5 px-1.5 py-1 min-w-0 border-b border-white/5">
                                    <FolderOpen className="w-3 h-3 shrink-0 text-amber-500/60" />
                                    <span className="text-[10px] text-stone-300 truncate min-w-0 flex-1 font-medium group-hover:text-white">
                                        {bin.name}
                                    </span>
                                </div>
                                <div className={cn("aspect-video flex flex-col items-center justify-center gap-1", THUMB_BG)}>
                                    <FolderOpen className="w-6 h-6 text-amber-500/50" />
                                </div>
                            </div>
                        );
                    })}

                    {/* ── Items ── */}
                    {visibleItems.map(item => (
                        <MediaItemCard
                            key={item.id}
                            item={item}
                            isSelected={selectedIds.has(item.id)}
                            onClick={(e) => handleItemClick(item.id, e)}
                            playingItemId={playingItemId}
                            setPlayingItemId={setPlayingItemId}
                            handleDragStart={handleDragStart}
                            setContextMenu={(menu) => setContextMenu(menu as ContextMenuState)}
                            togglePlayback={togglePlayback}
                            videoRefs={videoRefs}
                            handleTimeUpdate={handleTimeUpdate}
                            mediaTimes={mediaTimes[item.id]}
                        />
                    ))}
                </div>
            </div>

            {/* ── Context Menus ── */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                >
                    {contextMenu.kind === 'item' && (
                        <>
                            <ContextMenuItem
                                icon={<Edit2 className="w-3 h-3" />}
                                label={t('media_pool.rename', 'Rename')}
                                onClick={() => {
                                    openModal(ModalType.PROMPT, {
                                        title: t('media_pool.rename', 'Rename Asset'),
                                        defaultValue: contextMenu.item.name,
                                        onSelection: (name: string | null) => {
                                            if (name) db.mediaPool.update(contextMenu.item.id, { name });
                                        }
                                    });
                                    setContextMenu(null);
                                }}
                            />
                            <ContextMenuItem
                                icon={<Trash2 className="w-3 h-3" />}
                                label={selectedIds.size > 1 && selectedIds.has(contextMenu.item.id) 
                                    ? t('media_pool.delete_multiple', 'Delete Selected') 
                                    : t('media_pool.delete', 'Delete')}
                                danger
                                onClick={() => {
                                    if (selectedIds.size > 1 && selectedIds.has(contextMenu.item.id)) {
                                        handleBulkDelete();
                                    } else {
                                        openModal(ModalType.CONFIRM, {
                                            title: t('media_pool.delete', 'Delete Asset'),
                                            message: t('media_pool.confirm_delete', 'Delete this asset?'),
                                            onSelection: (confirmed: boolean) => {
                                                if (confirmed) db.mediaPool.delete(contextMenu.item.id);
                                            }
                                        });
                                    }
                                    setContextMenu(null);
                                }}
                            />
                        </>
                    )}
                    {contextMenu.kind === 'bin' && (
                        <>
                            <ContextMenuItem
                                icon={<Edit2 className="w-3 h-3" />}
                                label={t('media_pool.rename_bin', 'Rename Bin')}
                                onClick={() => {
                                    openModal(ModalType.PROMPT, {
                                        title: t('media_pool.rename_bin', 'Rename Bin'),
                                        defaultValue: contextMenu.bin.name,
                                        onSelection: (name: string | null) => {
                                            if (name) db.mediaBins.update(contextMenu.bin.id, { name });
                                        }
                                    });
                                    setContextMenu(null);
                                }}
                            />
                            <ContextMenuItem
                                icon={<Trash2 className="w-3 h-3" />}
                                label={t('media_pool.delete_bin', 'Delete Bin')}
                                danger
                                onClick={() => {
                                    openModal(ModalType.CONFIRM, {
                                        title: t('media_pool.delete_bin', 'Delete Bin'),
                                        message: t('media_pool.confirm_delete_bin', 'Delete this bin and move items to root?'),
                                        onSelection: async (confirmed: boolean) => {
                                            if (confirmed) {
                                                await db.mediaPool.where('binId').equals(contextMenu.bin.id).modify({ binId: undefined });
                                                await db.mediaBins.delete(contextMenu.bin.id);
                                                if (activeBinId === contextMenu.bin.id) setActiveBinId(null);
                                            }
                                        }
                                    });
                                    setContextMenu(null);
                                }}
                            />
                        </>
                    )}
                </ContextMenu>
            )}

            <audio
                ref={scrubAudioRef}
                onTimeUpdate={(e) => {
                    if (playingItemId) {
                        handleTimeUpdate(playingItemId, e.currentTarget.currentTime, e.currentTarget.duration);
                    }
                }}
                onEnded={() => setPlayingItemId(null)}
            />
        </div>
    );
};

// ─── Subcomponents ───

interface MediaItemCardProps {
    item: IMediaItem;
    isSelected: boolean;
    onClick: (e: React.MouseEvent) => void;
    playingItemId: string | null;
    setPlayingItemId: (id: string | null) => void;
    handleDragStart: (e: React.DragEvent, item: IMediaItem) => void;
    setContextMenu: (menu: { x: number, y: number, kind: 'item', item: IMediaItem }) => void;
    togglePlayback: (e: React.MouseEvent, item: IMediaItem) => void;
    videoRefs: React.MutableRefObject<Record<string, HTMLVideoElement | null>>;
    handleTimeUpdate: (id: string, current: number, duration: number) => void;
    mediaTimes?: { current: number, duration: number };
}

const MediaItemCard: React.FC<MediaItemCardProps> = ({
    item, isSelected, onClick, playingItemId, setPlayingItemId, handleDragStart, 
    setContextMenu, togglePlayback, videoRefs, handleTimeUpdate, mediaTimes
}) => {
    const isPlaying = playingItemId === item.id;
    const displayUrl = useMediaUrl(item);

    const formatTime = (seconds: number) => {
        if (!seconds || !isFinite(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div
            draggable
            onClick={onClick}
            onDragStart={(e) => handleDragStart(e, item)}
            onContextMenu={(e) => {
                e.preventDefault();
                // If the item is not selected, select only it before showing menu
                if (!isSelected) {
                    onClick(e as unknown as React.MouseEvent);
                }
                setContextMenu({ x: e.clientX, y: e.clientY, kind: 'item', item });
            }}
            className={cn(
                "group flex flex-col rounded-md overflow-hidden cursor-grab active:cursor-grabbing transition-all ring-offset-2 ring-offset-stone-900",
                isSelected ? "bg-accent/20 ring-2 ring-accent" : CARD_BG
            )}
        >
            {/* Metadata Strip */}
            <div className="flex items-center gap-1.5 px-1.5 py-1 min-w-0 border-b border-white/5">
                <TypeIcon type={item.type} className={cn("w-3 h-3 shrink-0", getTypeAccent(item.type))} />
                <span className="text-[10px] text-stone-300 truncate min-w-0 flex-1 font-medium group-hover:text-white">
                    {item.name}
                </span>
            </div>

            {/* Thumbnail Area */}
            <div className={cn("relative aspect-video overflow-hidden", THUMB_BG)}>
                {item.type === 'image' && displayUrl && (
                    <img src={displayUrl} alt="" className="w-full h-full object-cover" />
                )}

                {item.type === 'video' && displayUrl && (
                    <video
                        ref={el => { videoRefs.current[item.id] = el; }}
                        src={displayUrl}
                        muted
                        playsInline
                        onLoadedMetadata={(e) => handleTimeUpdate(item.id, 0, e.currentTarget.duration)}
                        onTimeUpdate={(e) => handleTimeUpdate(item.id, e.currentTarget.currentTime, e.currentTarget.duration)}
                        onEnded={() => setPlayingItemId(null)}
                        className="w-full h-full object-cover"
                    />
                )}

                {item.type === 'audio' && (
                    <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-6 h-6 text-purple-500/30" />
                    </div>
                )}

                {/* Overlays */}
                {(item.type === 'video' || item.type === 'audio') && (
                    <>
                        <button
                            type="button"
                            onClick={(e) => togglePlayback(e, item)}
                            className={cn(
                                "absolute inset-0 flex items-center justify-center transition-opacity z-10",
                                isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            )}
                        >
                            <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                                {isPlaying ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white translate-x-px" />}
                            </div>
                        </button>

                        {mediaTimes && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-20">
                                <div 
                                    className={cn("h-full transition-all", item.type === 'audio' ? "bg-purple-500" : "bg-accent")}
                                    style={{ width: `${(mediaTimes.current / mediaTimes.duration) * 100}%` }}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Duration Label */}
            {mediaTimes && (
                <div className={cn("flex items-center justify-end px-1.5 py-0.5", STRIP_BG)}>
                    <span className="text-[9px] text-stone-500 tabular-nums font-medium">
                        {formatTime(mediaTimes.current)} / {formatTime(mediaTimes.duration)}
                    </span>
                </div>
            )}
        </div>
    );
};

// ─── Helpers ───

const TypeIcon = ({ type, className }: { type: MediaType; className?: string }) => {
    switch (type) {
        case 'image': return <ImageIcon className={className} />;
        case 'video': return <Film className={className} />;
        case 'audio': return <Music className={className} />;
    }
};

const getTypeAccent = (type: MediaType) => {
    switch (type) {
        case 'video': return 'text-blue-400';
        case 'audio': return 'text-purple-400';
        case 'image': return 'text-emerald-400';
        default: return 'text-stone-400';
    }
};
