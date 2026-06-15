import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen } from 'lucide-react';
import { db } from '@/core/db';
import { IMediaItem, MediaType } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useShallow } from 'zustand/react/shallow';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';
import { toast } from '@/core/utils/toast';
import { IpcService } from '@/core/services/ipcService';

// Hooks
import { useMediaPoolData } from '../../hooks/useMediaPoolData';
import { useMediaSelection } from '../../hooks/useMediaSelection';

// Components
import { MediaPoolToolbar } from './MediaPoolToolbar';
import { MediaPoolBreadcrumb } from './MediaPoolBreadcrumb';
import { MediaItemCard, CARD_BG, THUMB_BG } from './MediaItemCard';
import { MediaPoolContextMenu, ContextMenuState } from './MediaPoolContextMenu';

/**
 * Main Media Pool Panel component.
 * Orchestrates media browsing, importing, and organization.
 */
export const MediaPoolPanel: React.FC = () => {
    const { t } = useTranslation();
    const { openModal } = useModalStore(useShallow(s => ({ openModal: s.openModal })));
    
    // State
    const [filter, setFilter] = useState<MediaType | 'all'>('all');
    const [activeBinId, setActiveBinId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
    const [playingItemId, setPlayingItemId] = useState<string | null>(null);
    const [draggingOverId, setDraggingOverId] = useState<string | null>(null);
    
    // Refs
    const scrubAudioRef = useRef<HTMLAudioElement | null>(null);
    const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

    // ─── Data & Selection Hooks ───
    const { 
        bins, 
        mediaItems, 
        visibleItems, 
        activeBin, 
        mediaTimes, 
        setMediaTimes 
    } = useMediaPoolData(filter, activeBinId);

    const { 
        selectedIds, 
        setSelectedIds, 
        handleItemClick, 
        handleBulkDelete 
    } = useMediaSelection(visibleItems);

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
            
            const { MediaPersistenceService } = await import('../../services/MediaPersistenceService');
            
            let importedCount = 0;
            let skippedCount = 0;

            for (const filePath of filePaths) {
                const ext = filePath.split('.').pop()?.toLowerCase() || '';
                let type: MediaType = 'image';
                if (['mp4', 'webm', 'mov'].includes(ext)) type = 'video';
                if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) type = 'audio';

                // Check for existing binary data or path to avoid duplicate hashing if possible, 
                // but importMediaFromPath is robust enough to handle it.
                // For better UX with large lists, we could check paths first as a hint.
                const newId = await MediaPersistenceService.importMediaFromPath(filePath, type, { 
                    binId: activeBinId ?? undefined 
                });

                if (newId) {
                    importedCount++;
                } else {
                    skippedCount++;
                }
            }

            if (importedCount > 0) {
                const message = t('media_imported', 'Imported {{count}} files', { count: importedCount }) + 
                    (skippedCount > 0 ? ` (${t('skipped_count', '{{count}} skipped', { count: skippedCount })})` : '');
                toast.success(message);
            } else if (skippedCount > 0) {
                toast.info(t('media_skipped', 'Skipped {{count}} already imported files', { count: skippedCount }));
            }
        } catch (error) {
            console.error('Failed to import media:', error);
            toast.error(t('import_error', 'Failed to import media'));
        }
    };

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
            <MediaPoolToolbar
                filter={filter}
                setFilter={setFilter}
                handleImportMedia={handleImportMedia}
                handleCreateBin={handleCreateBin}
            />

            <MediaPoolBreadcrumb
                activeBinId={activeBinId}
                activeBin={activeBin}
                draggingOverId={draggingOverId}
                setActiveBinId={setActiveBinId}
                setDraggingOverId={setDraggingOverId}
                handleBinDrop={handleBinDrop}
            />

            <div className="@container flex-1 overflow-y-auto no-scrollbar min-h-0 px-1 pt-1">
                <div className="grid grid-cols-1 @[240px]:grid-cols-2 @[400px]:grid-cols-3 gap-1.5 pb-4">
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

            <MediaPoolContextMenu
                contextMenu={contextMenu}
                onClose={() => setContextMenu(null)}
                selectedIds={selectedIds}
                handleBulkDelete={handleBulkDelete}
                activeBinId={activeBinId}
                setActiveBinId={setActiveBinId}
            />

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
