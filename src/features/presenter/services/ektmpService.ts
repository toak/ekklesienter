import JSZip from 'jszip';
import { db } from '@/core/db';
import { 
    ITemplate, IBlock, ICanvasSlide, ISlide, 
    ITemplateSlide, INestedSlide, MediaSource 
} from '@/core/types';
import { ThumbnailService } from './ThumbnailService';
import { APP_VERSION, EKT_SCHEMA_VERSION } from '@/core/constants';
import { IpcService } from '@/core/services/ipcService';
import { 
    sha256, collectMediaRefs, patchMediaIds, 
    getMediaBlob, mimeToExt, MediaManifest 
} from './mediaPackingUtils';

/**
 * Service for handling Ekklesia Template (.ektmp) files.
 * Enhanced with Content-Hash deduplication and Split-Slide storage.
 */
export const EktmpService = {
    /**
     * Packs a local template from IndexedDB into a .ektmp Blob.
     */
    async pack(templateId: string, parentHashSet: Set<string> = new Set()): Promise<Blob> {
        const template = await db.templates.get(templateId);
        if (!template) throw new Error(`Template ${templateId} not found`);

        const zip = new JSZip();

        // 1. Previews
        const thumbBlob = await ThumbnailService.generateFromTemplate(templateId);
        if (thumbBlob) {
            zip.file('preview.png', thumbBlob);
            zip.file('previews/preview.png', thumbBlob); // Redundant for spec consistency
        }
        // TODO: Generate per-slide previews if needed

        // 2. Prep Media
        // Map ITemplateSlide to ISlide (Normal) for collection
        const pseudoSlides: ISlide[] = (template.templateSlides || []).map(ts => ({
            id: ts.id,
            type: ts.type || 'normal',
            order: 0, // transient
            blockId: template.category,
            templateId: template.id,
            backgroundOverride: ts.backgroundOverride,
            content: { variables: {}, canvasItems: ts.canvasItems }
        } as ICanvasSlide));

        // Also add base template canvas items as a pseudo-slide
        if (template.canvasItems) {
            pseudoSlides.push({
                id: 'base',
                type: 'normal',
                order: -1,
                blockId: template.category,
                templateId: template.id,
                content: { variables: {}, canvasItems: template.canvasItems }
            } as ICanvasSlide);
        }

        const mediaRefs = await collectMediaRefs(pseudoSlides, template.background);
        const manifest: MediaManifest = {};
        const localIdToHash = new Map<string, string>();

        const mediaFolder = zip.folder('media')!;

        for (const [localId, ref] of mediaRefs.entries()) {
            const media = await getMediaBlob(localId);
            if (!media) continue;

            const blob = media.blob;
            const hash = await sha256(blob);
            localIdToHash.set(localId, hash);

            if (!parentHashSet.has(hash)) {
                parentHashSet.add(hash);
                const ext = mimeToExt(blob.type);
                const subfolder = ref.role === 'font' ? 'fonts/' : '';
                const filename = `${subfolder}${hash}.${ext}`;
                mediaFolder.file(filename, blob, { compression: 'STORE' });

                manifest[hash] = {
                    filename,
                    mimeType: blob.type,
                    originalName: media.name,
                    size: blob.size,
                    role: ref.role,
                    fontFamily: ref.fontFamily,
                    fontWeight: ref.fontWeight
                };
            }
        }

        // 3. Patch IDs
        patchMediaIds(template, localIdToHash);

        // 4. Split Slides
        const slidesFolder = zip.folder('slides')!;
        if (template.templateSlides) {
            template.templateSlides.forEach((slide, index) => {
                slidesFolder.file(`slide-${index}.json`, JSON.stringify(slide, null, 2));
            });
            // We keep them in manifest.json for now but refined structure might strip them
        }

        // 5. Block Metadata
        if (template.category) {
            const block = await db.blocks.get(template.category);
            if (block) zip.file('block.json', JSON.stringify(block, null, 2));
        }

        // 6. Manifests
        const cleanTemplate = { ...template };
        (cleanTemplate as any).version = EKT_SCHEMA_VERSION;
        (cleanTemplate as any).engineVersion = APP_VERSION;

        zip.file('manifest.json', JSON.stringify(cleanTemplate, null, 2));
        zip.file('manifest_media.json', JSON.stringify(manifest, null, 2));

        // Metadata
        const metadata = {
            author: 'Ekklesia User',
            createdAt: new Date().toISOString(),
            compatibleEngineVersion: APP_VERSION
        };
        zip.file('metadata.json', JSON.stringify(metadata, null, 2));

        return await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
    },

    /**
     * Unpacks a .ektmp Blob, inserts embedded media into DB, 
     * and returns the imported template data.
     */
    async unpack(blob: Blob | File, options?: { preserveId?: boolean; isUserCreated?: boolean }): Promise<ITemplate> {
        let zip;
        try {
            zip = await JSZip.loadAsync(blob);
        } catch (e) {
            throw new Error('Failed to read template: Not a valid ZIP archive');
        }

        const manifestFile = zip.file('manifest.json');
        if (!manifestFile) throw new Error('Invalid .ektmp file: missing manifest.json');

        const template = JSON.parse(await manifestFile.async('string')) as ITemplate;
        
        // Use manifest_media.json if available, fallback to old manifest.json logic
        let mediaManifest: MediaManifest = {};
        const mediaManifestFile = zip.file('manifest_media.json');
        if (mediaManifestFile) {
            mediaManifest = JSON.parse(await mediaManifestFile.async('string'));
        }

        const hashToLocalId = new Map<string, string>();
        const mediaFiles = Object.keys(zip.files).filter(path => path.startsWith('media/') && !zip.files[path].dir);

        for (const path of mediaFiles) {
            const hashExt = path.split('/').pop()!;
            const hash = hashExt.split('.')[0];
            const meta = mediaManifest[hash] || { mimeType: 'application/octet-stream', originalName: hashExt };

            const data = await zip.file(path)!.async('blob');
            const localId = hash; 
            hashToLocalId.set(hash, localId);

            const type = meta.mimeType;

            if (type.startsWith('image/') && !type.includes('svg')) {
                if (!(await db.backgrounds.get(localId))) {
                    await db.backgrounds.add({ id: localId, name: meta.originalName, data, mimeType: type });
                }
            } else {
                if (!(await db.mediaPool.get(localId))) {
                    await db.mediaPool.add({
                        id: localId,
                        name: meta.originalName,
                        path: '', // Clear path for DB-stored items so useMediaUrl resolves from Blob
                        type: type.startsWith('audio/') ? 'audio' : (type.startsWith('video/') ? 'video' : 'image'),
                        data,
                        createdAt: Date.now()
                    });
                }
            }
            // TODO: Font registration logic if needed
        }

        // Relink
        patchMediaIds(template, hashToLocalId);

        // Block import
        const blockFile = zip.file('block.json');
        if (blockFile) {
            const block = JSON.parse(await blockFile.async('string')) as IBlock;
            if (block.id && !(await db.blocks.get(block.id))) {
                await db.blocks.add(block);
            }
        }

        return {
            ...template,
            id: options?.preserveId ? template.id : `imported-${crypto.randomUUID()}`,
            isUserCreated: options?.isUserCreated ?? true,
        };
    },

    async syncFileSystemTemplates() {
        if (!IpcService.isElectron()) return;
        try {
            const files = await IpcService.templates.list();
            for (const filename of files) {
                const buffer = await IpcService.templates.read(filename);
                if (!buffer) continue;
                const blob = new Blob([buffer as any]);
                const templateData = await this.unpack(blob, { preserveId: true, isUserCreated: false });
                if (!(await db.templates.get(templateData.id))) {
                    await db.templates.add(templateData);
                }
            }
        } catch (error) {
            console.error('Sync failed:', error);
        }
    },

    async saveAsEktmpFile(templateId: string) {
        if (!IpcService.isElectron()) return;
        try {
            const template = await db.templates.get(templateId);
            if (!template) return;
            const blob = await this.pack(templateId);
            await IpcService.templates.write(`${template.id}.ektmp`, new Uint8Array(await blob.arrayBuffer()));
        } catch (error) {
            console.error('Save failed:', error);
        }
    },

    async deleteFromFilesystem(templateId: string) {
        if (!IpcService.isElectron()) return;
        try {
            await IpcService.templates.delete(`${templateId}.ektmp`);
        } catch (error) {
            console.error('Delete failed:', error);
        }
    },

    download(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.endsWith('.ektmp') ? filename : `${filename}.ektmp`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};
