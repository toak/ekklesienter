import JSZip from 'jszip';
import { db } from '@/core/db';
import { IPresentationFile, ISlide, IStyleLayer, INestedSlide, ICanvasSlide, ITimerSlide, IVerseSlide, SlideType } from '@/core/types';
import { ThumbnailService } from './ThumbnailService';
import { APP_VERSION, EKT_SCHEMA_VERSION } from '@/core/constants';

import { sha256, collectMediaRefs, patchMediaIds, readLocalFileSafe, getMediaBlob, MediaManifest, mimeToExt } from './mediaPackingUtils';

export const EktpService = {
    // Logic moved to mediaPackingUtils.ts


    // ---------------------------------------------------------------------------------------------------------------- //
    // EXPORT
    // ---------------------------------------------------------------------------------------------------------------- //

    /**
     * Packs a presentation into a Blob using robust EKTP architecture.
     * @param presentationId ID of the local presentation to pack
     * @param parentHashSet Tracks SHA256 hashes already bundled by parent archives to deduplicate at the ZIP level
     */
    async pack(presentationId: string, parentHashSet: Set<string> = new Set()): Promise<{ blob: Blob; manifest: MediaManifest }> {
        const presentation = await db.presentationFiles.get(presentationId);
        if (!presentation) throw new Error(`Presentation ${presentationId} not found`);

        const zip = new JSZip();

        // 1. Generate preview
        const thumbnailBlob = await ThumbnailService.generate(presentationId);
        if (thumbnailBlob) {
            zip.file('preview.png', thumbnailBlob);
            presentation.hasPreview = true;
        }

        // 2. Prep metadata and mode
        presentation.version = EKT_SCHEMA_VERSION;
        presentation.engineVersion = APP_VERSION;
        presentation.isMaster = false;

        const slideCount = presentation.slides.length;
        presentation.slideStorageMode = slideCount >= 100 ? 'split' : 'inline';

        // Always generate a canonical slideIndex to power SlideLoader
        presentation.slideIndex = presentation.slides.map(s => {
            s.type = s.type || 'normal';
            return {
                id: s.id,
                order: s.order,
                type: s.type
            };
        });

        // 3. Extract and deduplicate Media
        // Fetch audio scopes from relational table for this presentation
        const dbScopes = await db.audioScopes.where('presentationId').equals(presentationId).toArray();
        presentation.audioScopes = dbScopes;

        const mediaRefs = await collectMediaRefs(presentation.slides, [], presentation.audioScopes);
        const manifest: MediaManifest = {};
        const localIdToHash = new Map<string, string>();

        const mediaFolder = zip.folder('media')!;

        for (const [localId, ref] of mediaRefs.entries()) {
            const media = await getMediaBlob(localId);
            if (!media) continue;

            const blob = media.blob;
            const originalName = media.name;

            const hash = await sha256(blob);
            localIdToHash.set(localId, hash);

            // Cross-Level Deduplication: If parent archive already zipped this file, skip bundling it here.
            if (parentHashSet.has(hash)) {
                continue;
            }

            // Mark as used, and bundle into ZIP
            parentHashSet.add(hash);
            const ext = mimeToExt(blob.type);
            const filename = `${hash}.${ext}`;

            // Fast STORE compression because binary media formats like Jpegs and Mp4s are already compressed
            mediaFolder.file(filename, blob, { compression: 'STORE' });

            manifest[hash] = {
                filename,
                mimeType: blob.type,
                originalName,
                size: blob.size,
                role: ref.role
            };
        }

        // 4. Handle Nested Presentations recursively
        const nestedFolder = zip.folder('nested');
        for (const slide of presentation.slides) {
            if (slide.type === 'nested') {
                const ns = slide as INestedSlide;
                if (!ns.presentationId) continue;

                try {
                    // Recursive call passing our shared parentHashSet to allow global media deduplication
                    const { blob: nestedBlob, manifest: nestedManifest } = await this.pack(ns.presentationId, parentHashSet);
                    const nestedHash = await sha256(nestedBlob);

                    ns.ektpHash = nestedHash; // Replace link ID with self-verifying hash
                    nestedFolder?.file(`${nestedHash}.ektp`, nestedBlob, { compression: 'STORE' });
                    
                    Object.assign(manifest, nestedManifest);

                    // The nested archive must not carry over our local system ID mapping!
                    delete (ns as any).presentationId;
                } catch (e) {
                    console.error(`Failed to pack nested presentation on slide ${slide.id}`, e);
                }
            }
        }

        // 5. Build presentation.json
        patchMediaIds(presentation, localIdToHash);

        // Strip localized footprint artifacts not valid on destination machines
        const { fileHandle, thumbnailUrl, ektpHash, ...cleanPresentation } = presentation;

        if (cleanPresentation.slideStorageMode === 'split') {
            const slidesFolder = zip.folder('slides')!;
            // Write each slide cleanly bypassing memory spikes on large parses later
            for (const slide of cleanPresentation.slides) {
                slidesFolder.file(`slide-${slide.order}.json`, JSON.stringify(slide, null, 2));
            }
            // Strip monolith payload
            cleanPresentation.slides = [];
        }

        zip.file('presentation.json', JSON.stringify(cleanPresentation, null, 2));
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));

        // Assemble Final EKTP
        const blob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 } // Balance output compression with processor payload
        });
        
        return { blob, manifest };
    },

    async save(presentationId: string): Promise<void> {
        const presentation = await db.presentationFiles.get(presentationId);
        if (!presentation || !presentation.fileHandle) return;

        try {
            const options = { mode: 'readwrite' };
            if (await (presentation.fileHandle as any).queryPermission(options) !== 'granted') {
                if (await (presentation.fileHandle as any).requestPermission(options) !== 'granted') {
                    throw new Error('Permission to write to file denied');
                }
            }

            const { blob } = await this.pack(presentationId);
            const writable = await (presentation.fileHandle as any).createWritable();
            await writable.write(blob);
            await writable.close();

            const thumbnailBlob = await ThumbnailService.generate(presentationId);
            let thumbnailUrl = presentation.thumbnailUrl;
            if (thumbnailBlob) {
                const reader = new FileReader();
                thumbnailUrl = await new Promise((resolve) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(thumbnailBlob);
                });
            }

            // Important: Cache the finalized ektpHash back onto the DB entity so it is eligible as a 
            // verified cached entity for subsequent child dedup imports
            const archiveHash = await sha256(blob);

            await db.presentationFiles.update(presentationId, {
                updatedAt: new Date(),
                thumbnailUrl,
                ektpHash: archiveHash
            });
        } catch (error) {
            console.error('Save failed:', error);
            throw error;
        }
    },


    // ---------------------------------------------------------------------------------------------------------------- //
    // IMPORT
    // ---------------------------------------------------------------------------------------------------------------- //

    /**
     * Translates a .ektp blob to database, expanding Media/Nested content cleanly avoiding DB conflicts
     */
    async unpack(blob: Blob | File, depth: number = 0, importStack: Set<string> = new Set()): Promise<string> {
        // Deep recursive circuit breaker limits depth tracking
        if (depth > 2) throw new Error('Nested EKTP depth limit exceeded (configured max 2 levels).');

        const fileHash = await sha256(blob);

        // Cyclic import checking: a slide looping back into itself!
        if (importStack.has(fileHash)) {
            throw new Error(`Circular dependency detected: ektpHash ${fileHash} is already in the import stack.`);
        }

        // --- Archive Deduplication Cache ---
        // Have we already fully imported this presentation across ANY library tree?
        const existing = await db.presentationFiles.where('ektpHash').equals(fileHash).first();
        if (existing && existing.id) {
            return existing.id; // Just re-link it and skip import!
        }

        importStack.add(fileHash);

        let zip;
        try {
            zip = await JSZip.loadAsync(blob);
        } catch (e) {
            throw new Error('Failed to read file: Not a valid JSZip payload');
        }

        const docFile = zip.file('presentation.json') || zip.file('document.json');
        if (!docFile) throw new Error('Invalid .ektp file format: missing presentation.json');

        const content = await docFile.async('string');
        const presentation = JSON.parse(content) as IPresentationFile;
        presentation.isMaster = false;
        presentation.ektpHash = fileHash; // Crucial to mark identity

        if (!presentation.id) {
            throw new Error('Invalid .ektp file: missing core presentation schema requirements (id)');
        }

        // Legacy files may not have slideIndex — synthesize from slides array
        if (!Array.isArray(presentation.slideIndex) && Array.isArray(presentation.slides)) {
            presentation.slideIndex = presentation.slides.map((s, i) => ({
                id: s.id,
                order: s.order ?? i,
                type: s.type || 'normal'
            }));
        }

        // Assign a net new ID inside IndexedDB so we aren't colliding UUID clusters globally across churches
        const newPresentationId = crypto.randomUUID();
        presentation.id = newPresentationId;

        // Restore file system handle link binding hook
        if ('name' in blob && (blob as any).handle) {
            presentation.fileHandle = (blob as any).handle;
        }

        // Reconstitute slides from partial split payload directory lazily parsing when 100+ blocks exist
        if (presentation.slideStorageMode === 'split' && presentation.slideIndex) {
            presentation.slides = [];
            for (const sMeta of presentation.slideIndex) {
                const slideFile = zip.file(`slides/slide-${sMeta.order}.json`);
                if (slideFile) {
                    const slideData = JSON.parse(await slideFile.async('string'));
                    presentation.slides.push(slideData);
                }
            }
        }

        // Recurse into Nested blocks independently triggering downstream dedup evaluation before unpacking memory
        const nestedSlides = presentation.slides.filter(s => s.type === 'nested') as INestedSlide[];

        await Promise.all(nestedSlides.map(async (slide) => {
            if (!slide.ektpHash) return;
            try {
                const nestedBlob = await zip.file(`nested/${slide.ektpHash}.ektp`)?.async('blob');
                if (!nestedBlob) throw new Error("Nested archive missing in ZIP target tree");

                // Recursion handles deduplication under the hood
                const childId = await this.unpack(nestedBlob, depth + 1, importStack);

                // Cross link resolution completion state
                slide.presentationId = childId;
                delete (slide as any).ektpHash;
            } catch (e) {
                console.error(`Failed to load nested presentation ${slide.ektpHash}`, e);
            }
        }));

        // Handle visual metadata (Preview PNG) for finder
        const previewFile = zip.file('preview.png');
        if (previewFile) {
            const previewBlob = await previewFile.async('blob');
            const reader = new FileReader();
            presentation.thumbnailUrl = await new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(previewBlob);
            });
            presentation.hasPreview = true;
        }

        // Re-normalize legacy slides just in case they were dumped back directly
        presentation.slides.forEach(s => {
            if (!s.type) s.type = 'normal';
        });

        // Setup Media Replacement mapping...
        const hashToLocalId = new Map<string, string>();
        const mediaFolder = zip.folder('media');

        let manifest: MediaManifest = {};
        const manifestFile = zip.file('manifest.json');
        if (manifestFile) manifest = JSON.parse(await manifestFile.async('string'));

        if (mediaFolder) {
            const mediaFiles = Object.keys(zip.files).filter(path => path.startsWith('media/') && !zip.files[path].dir);
            for (const path of mediaFiles) {
                const hashExt = path.split('/').pop()!; // "a1b2c3.png"
                const hash = hashExt.split('.')[0];
                const ext = hashExt.split('.').pop()?.toLowerCase() || '';

                let meta = manifest[hash];
                if (!meta || !meta.mimeType || meta.mimeType === 'application/octet-stream') {
                    let inferredMime = 'application/octet-stream';
                    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
                        inferredMime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                    } else if (['mp4', 'webm', 'mov'].includes(ext)) {
                        inferredMime = `video/${ext === 'mov' ? 'quicktime' : ext}`;
                    } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
                        inferredMime = `audio/${ext === 'mp3' ? 'mpeg' : ext}`;
                    }
                    meta = { 
                        filename: hashExt, 
                        mimeType: inferredMime, 
                        originalName: hashExt, 
                        size: 0, 
                        role: 'media' 
                    } as any;
                }

                const data = await zip.file(path)!.async('blob');

                // Media Storage Global Deduplication: Use hash directly as its local ID key!
                const localId = hash;
                hashToLocalId.set(hash, localId);

                const type = meta.mimeType;
                const mediaName = meta.originalName || `Imported Media (${localId})`;

                // Determine organized path based on presentation name and media type
                const presName = presentation.name || 'Imported';
                const mediaCategory = type.startsWith('audio/') ? 'audio'
                    : type.startsWith('video/') ? 'video'
                    : 'images';
                const organizedPath = `${presName}/${mediaCategory}`;

                if (type.startsWith('image/') && !type.includes('svg')) {
                    // Store in backgrounds table (used by SlideBackground renderer)
                    const existingBg = await db.backgrounds.get(localId);
                    if (!existingBg) {
                        await db.backgrounds.add({ id: localId, name: mediaName, data, mimeType: type });
                    }
                    // Also store in mediaPool for reusability in the media pool UI
                    const existingPool = await db.mediaPool.get(localId);
                    if (!existingPool) {
                        await db.mediaPool.add({
                            id: localId,
                            name: mediaName,
                            path: organizedPath,
                            type: 'image',
                            data,
                            createdAt: Date.now()
                        });
                    }
                } else {
                    const existingPool = await db.mediaPool.get(localId);
                    if (!existingPool) {
                        await db.mediaPool.add({
                            id: localId,
                            name: mediaName,
                            path: organizedPath,
                            type: type.startsWith('audio/') ? 'audio' : (type.startsWith('video/') ? 'video' : 'image'),
                            data,
                            createdAt: Date.now()
                        });
                    }
                }
            }
        }

        patchMediaIds(presentation, hashToLocalId);

        // Terminate into state store tracking
        await db.presentationFiles.add(presentation);

        // Remove tracking lock for branch pathing on the cycle graph
        importStack.delete(fileHash);

        return newPresentationId;
    },

    download(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.endsWith('.ektp') ? filename : `${filename}.ektp`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};
