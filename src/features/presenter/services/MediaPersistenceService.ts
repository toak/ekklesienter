import { db } from '@/core/db';
import { IMediaItem, MediaType } from '@/core/types';
import { readLocalFileSafe, sha256 } from './mediaPackingUtils';
import { mediaCache } from '@/core/utils/mediaCache';

/**
 * Service to handle Importing and Persisting media (images, videos, audio) 
 * into IndexedDB as Blobs. This ensures that media is portable and
 * doesn't depend on fragile local filesystem paths.
 */
export class MediaPersistenceService {
    /**
     * Imports a media file from a local filesystem path.
     * 1. Reads the file as a Blob via IPC.
     * 2. Checks if a media item with the same content (hash) already exists.
     * 3. Saves to mediaPool (audio/video/image) or backgrounds (image).
     */
    static async importMediaFromPath(
        path: string, 
        type: MediaType, 
        options: { forceBackground?: boolean; binId?: string } = {}
    ): Promise<string | null> {
        if (!path) return null;

        // 1. Read the file
        const blob = await readLocalFileSafe(path);
        if (!blob) return null;

        return this.importMediaBlob(blob, path, type, options);
    }

    /**
     * Imports a Blob/File object directly into the database.
     */
    static async importMediaBlob(
        blob: Blob,
        sourcePath: string | null,
        type: MediaType,
        options: { forceBackground?: boolean; binId?: string } = {}
    ): Promise<string | null> {
        // 1. Hash the blob
        const hash = await sha256(blob);

        const name = sourcePath ? (sourcePath.split(/[/\\]/).pop() || 'media') : 'Imported Media';

        // 2. Check for existing item with this hash in mediaPool
        // Using hash as a stable ID for deduplication in mediaPool
        const existing = await db.mediaPool.get(hash);
        
        // If it exists but was in a different bin, or we want to ensure it's in the current bin
        if (existing) {
            if (options.binId !== undefined && existing.binId !== options.binId) {
                await db.mediaPool.update(hash, { binId: options.binId });
            }
            if (existing.data) {
                mediaCache.put(hash, blob); // Ensure it's in cache for immediate UI use
                return existing.id;
            }
        }

        const id = hash; // Use hash as primary key for deduplication and portability

        // 3. Save to appropriate table
        if (options.forceBackground && type === 'image') {
            const existingBg = await db.backgrounds.get(id);
            if (!existingBg) {
                await db.backgrounds.add({
                    id,
                    name,
                    data: blob,
                    mimeType: blob.type
                });
            }
        }

        // Always add to mediaPool for general reference
        if (!existing) {
            // Check for legacy placeholders with the same path but different ID (UUID)
            // This prevents duplication when re-importing something that was previously a placeholder
            if (sourcePath) {
                const legacyPlaceholders = await db.mediaPool
                    .where('path')
                    .equals(sourcePath)
                    .filter(m => !m.data && m.id !== id)
                    .toArray();
                
                if (legacyPlaceholders.length > 0) {
                    await Promise.all(legacyPlaceholders.map(lp => db.mediaPool.delete(lp.id)));
                }
            }

            await db.mediaPool.add({
                id,
                name,
                path: sourcePath || hash,
                type,
                data: blob,
                binId: options.binId,
                createdAt: Date.now()
            });
        } else if (!existing.data) {
            // Upgrade placeholder to real entry
            await db.mediaPool.update(hash, {
                data: blob,
                path: sourcePath || existing.path,
                binId: options.binId ?? existing.binId
            });
        }

        // 4. Pre-populate MediaCache to ensure immediate UI update across the app
        mediaCache.put(id, blob);

        return id;
    }

    /**
     * Imports a batch of media files efficiently.
     * Uses a concurrency limit to prevent overwhelming the browser/system.
     */
    static async importMediaBatch(
        items: { file?: File | Blob; path?: string; type: MediaType }[],
        options: { forceBackground?: boolean; binId?: string } = {}
    ): Promise<(string | null)[]> {
        const CONCURRENCY = 4;
        const results: (string | null)[] = Array(items.length).fill(null);
        const queue = items.map((item, index) => ({ item, index }));
        
        const workers = Array(Math.min(CONCURRENCY, items.length)).fill(null).map(async () => {
            while (queue.length > 0) {
                const task = queue.shift();
                if (!task) break;

                const { item, index } = task;
                try {
                    let id: string | null = null;
                    if (item.file) {
                        id = await this.importMediaBlob(item.file, item.path || null, item.type, options);
                    } else if (item.path) {
                        id = await this.importMediaFromPath(item.path, item.type, options);
                    }
                    results[index] = id;
                } catch (err) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    console.error(`[MediaPersistenceService] Batch item ${index} failed:`, errMsg);
                }
            }
        });

        await Promise.all(workers);
        
        return results;
    }

    /**
     * Ensures that a given IMediaItem has its binary data in the DB.
     * If data is missing but path is present, it attempts an import.
     */
    static async ensureMediaInDb(item: IMediaItem): Promise<string> {
        if (item.data) return item.id;

        // Check if it's already in DB by ID
        const dbItem = await db.mediaPool.get(item.id);
        if (dbItem?.data) return dbItem.id;

        // Try to import from path if it's a local file
        if (item.path && (item.path.startsWith('/') || item.path.includes(':\\') || item.path.startsWith('local-resource:'))) {
            const newId = await this.importMediaFromPath(item.path, item.type, { binId: item.binId });
            
            // If we've successfully imported and got a different ID (hash vs UUID), 
            // cleanup the placeholder UUID entry to prevent duplicates in the UI.
            if (newId && newId !== item.id) {
                try {
                    await db.mediaPool.delete(item.id);
                } catch (e) {
                    console.warn(`[MediaPersistenceService] Failed to cleanup placeholder: ${item.id}`, e);
                }
                return newId;
            }
            
            if (newId) return newId;
        }

        return item.id;
    }
}
