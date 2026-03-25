import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { IMediaItem, MediaType } from '@/core/types';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';

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

  // Preload audio durations using AudioContext for audio items without stored duration
  useEffect(() => {
    const audioOnly = visibleItems.filter(i => i.type === 'audio' && !mediaTimes[i.id]);
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
        .catch(() => { /* mute errors */ });
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
