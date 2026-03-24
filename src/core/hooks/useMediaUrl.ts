import { useState, useEffect } from 'react';
import { IMediaItem } from '../types';
import { db } from '../db';

/**
 * Robustly constructs a local-resource URL for a given path.
 * Handles absolute paths and ensures dummy 'localhost' host to avoid host-parsing traps.
 */
export const getLocalResourceUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('blob:') || path.startsWith('http') || path.startsWith('local-resource:')) return path;
    
    // Normalize slashes
    const cleanPath = path.replace(/\\/g, '/');
    const absolutePath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    
    // Encode parts but keep slashes
    const encodedPath = absolutePath.split('/').map(part => encodeURIComponent(part)).join('/');
    
    return `local-resource://localhost${encodedPath}`;
};

/**
 * Hook to resolve a display URL for an IMediaItem.
 * Priority:
 * 1. Data Blob from IndexedDB (if available)
 * 2. Static path (wrapped in local-resource:// if it's a file path)
 */
export function useMediaUrl(item: IMediaItem | null | undefined) {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        let currentUrl: string | null = null;

        const resolve = async () => {
            if (!item) {
                setUrl(null);
                return;
            }

            // 1. Check if the item has a Blob in the mediaPool table
            // Sometimes it's passed as a partial item or just ID from another place
            // so we try to fetch the full item if data is missing but it's supposed to be in DB
            try {
                const dbItem = await db.mediaPool.get(item.id);
                if (dbItem?.data) {
                    const blobUrl = URL.createObjectURL(dbItem.data);
                    currentUrl = blobUrl;
                    setUrl(blobUrl);
                    return;
                }
            } catch (err) {
                console.warn('useMediaUrl: Failed to fetch from mediaPool:', err);
            }

            // 2. Fallback to path
            if (item.path) {
                setUrl(getLocalResourceUrl(item.path));
            } else {
                setUrl(null);
            }
        };

        resolve();

        return () => {
            if (currentUrl) {
                URL.revokeObjectURL(currentUrl);
            }
        };
    }, [item?.id, item?.path]);

    return url;
}
