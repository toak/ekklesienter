import { db } from '@/core/db';
import { IMediaItem, MediaType } from '@/core/types';
import { readLocalFileSafe, sha256 } from './mediaPackingUtils';

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
        options: { forceBackground?: boolean } = {}
    ): Promise<string | null> {
        if (!path) return null;

        // 1. Read the file
        const blob = await readLocalFileSafe(path);
        if (!blob) {
            console.error(`[MediaPersistenceService] Failed to read file: ${path}`);
            return null;
        }

        return this.importMediaBlob(blob, path, type, options);
    }

    /**
     * Imports a Blob/File object directly into the database.
     */
    static async importMediaBlob(
        blob: Blob,
        sourcePath: string | null,
        type: MediaType,
        options: { forceBackground?: boolean } = {}
    ): Promise<string | null> {
        const hash = await sha256(blob);
        const name = sourcePath ? (sourcePath.split(/[/\\]/).pop() || 'media') : 'Imported Media';

        // 2. Check for existing item with this hash in mediaPool
        // Using hash as a stable ID for deduplication in mediaPool
        const existing = await db.mediaPool.get(hash);
        if (existing?.data) return existing.id;

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
            await db.mediaPool.add({
                id,
                name,
                path: sourcePath || hash,
                type,
                data: blob,
                createdAt: Date.now()
            });
        }

        // 4. Pre-populate MediaCache to ensure immediate UI update across the app
        const { mediaCache } = await import('@/core/utils/mediaCache');
        mediaCache.put(id, blob);

        return id;
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
            const newId = await this.importMediaFromPath(item.path, item.type);
            if (newId) return newId;
        }

        return item.id;
    }
}
