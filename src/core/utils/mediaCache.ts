import { db } from '../db';

/**
 * A simple global cache for media ObjectURLs to avoid redundant blob loads 
 * and URL creations, especially in the slide timeline.
 */
class MediaCache {
    private urlCache = new Map<string, { url: string; count: number }>();
    private blobCache = new Map<string, Blob>();

    /**
     * Gets or creates an ObjectURL for a given media ID from the backgrounds table.
     */
    async getBackgroundUrl(mediaId: string): Promise<string | null> {
        const cached = this.urlCache.get(mediaId);
        if (cached) {
            cached.count++;
            return cached.url;
        }

        try {
            let entry: any = await db.backgrounds.get(mediaId);
            
            // Fallback: If not in backgrounds, check mediaPool
            if (!entry) {
                entry = await db.mediaPool.get(mediaId);
            }

            if (!entry || !entry.data) {
                console.warn(`[MediaCache] Media not found in DB: ${mediaId}`);
                return null;
            }

            return this.put(mediaId, entry.data);
        } catch (error) {
            console.error(`MediaCache: Failed to load background ${mediaId}`, error);
            return null;
        }
    }

    /**
     * Manually injects a blob into the cache. 
     * Useful for immediate display after import before DB commit is fully propagated.
     */
    put(mediaId: string, blob: Blob): string {
        const existing = this.urlCache.get(mediaId);
        
        // If we already have a URL for this ID, just return it
        // Note: For now we assume blobs for a given ID are immutable.
        // If they weren't, we'd need a more complex check (e.g. comparing blob size/type)
        if (existing) {
            return existing.url;
        }

        const url = URL.createObjectURL(blob);
        console.log(`[MediaCache] Cached Blob: ${url} (ID: ${mediaId})`);
        this.urlCache.set(mediaId, { url, count: 1 });
        this.blobCache.set(mediaId, blob);
        return url;
    }

    /**
     * Notifies the cache that a component is done with a URL.
     * Note: In a real app we might revoke if count reaches 0, 
     * but for the timeline it's better to keep them alive while the timeline is visible.
     */
    release(mediaId: string) {
        const cached = this.urlCache.get(mediaId);
        if (cached) {
            cached.count--;
            // We don't immediately revoke to allow fast re-renders/scrolls
        }
    }

    /**
     * Clear all cached URLs. Use when navigating away from the presenter.
     */
    clear() {
        this.urlCache.forEach(item => URL.revokeObjectURL(item.url));
        this.urlCache.clear();
        this.blobCache.clear();
    }
}

export const mediaCache = new MediaCache();
