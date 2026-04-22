import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { IMediaItem, MediaType } from '@/core/types';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';
import { IpcService } from '@/core/services/IpcService';

/**
 * Hook to manage media pool data: bins, media items, and duration preloading.
 */
export function useMediaPoolData(filter: MediaType | 'all', activeBinId: string | null) {
  const [mediaTimes, setMediaTimes] = useState<Record<string, { current: number; duration: number }>>({});

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

  // File integrity check: Verify that local files still exist on disk
  useEffect(() => {
    // Only check items that haven't been checked in this session or are visible
    // We check visible items to ensure they are up to date
    visibleItems.forEach(async (item) => {
      // Skip blobs (they are always "present") and items already marked correctly
      if (!item.path || !!item.data) return;

      try {
        const stats = await IpcService.invoke('get-file-stats', item.path);
        const isMissing = !stats;
        
        // Only update if state changed to avoid unnecessary re-renders/db writes
        if (item.isMissing !== isMissing) {
          await db.mediaPool.update(item.id, { isMissing });
        }
      } catch (error) {
        if (item.isMissing !== true) {
          await db.mediaPool.update(item.id, { isMissing: true });
        }
      }
    });
  }, [visibleItems.length, activeBinId]); // Re-check when bin changes or count changes

  // Preload audio durations using AudioContext for audio items without stored duration
  useEffect(() => {
    // Skip items marked as missing to avoid console noise (404s)
    const audioOnly = visibleItems.filter(i => i.type === 'audio' && !mediaTimes[i.id] && !i.isMissing);
    for (const item of audioOnly) {
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
        .catch(() => {
          // If fetch fails, it might be missing. We could mark it here too,
          // but the dedicated integrity check useEffect handles it more reliably.
        });
    }
  }, [visibleItems.length]);

  return {
    bins,
    mediaItems,
    visibleItems,
    activeBin,
    mediaTimes,
    setMediaTimes
  };
}
