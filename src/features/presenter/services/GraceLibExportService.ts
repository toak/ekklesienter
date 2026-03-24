import JSZip from 'jszip';
import { db } from '@/core/db';
import { APP_VERSION, EKT_SCHEMA_VERSION } from '@/core/constants';
import { EktpService } from './ektpService';
import { EktmpService } from './ektmpService';
import { toast } from '@/core/utils/toast';
import i18n from '@/core/i18n';

/**
 * Service for exporting and importing GraceLib data in various formats.
 */
export const GraceLibExportService = {

    async packSingleItem(id: string, type: 'presentation' | 'template'): Promise<Blob> {
        if (type === 'presentation') {
            // EktpService.pack returns { blob, manifest } — we use blob
            const { blob } = await EktpService.pack(id);
            return blob;
        } else {
            // EktmpService.pack correctly packages media
            return await EktmpService.pack(id);
        }
    },

    async packEntireGraceLib(): Promise<Blob> {
        const zip = new JSZip();
        const presentations = await db.presentationFiles
            .filter(p => !p.serviceId) // Only GraceLib standalone presentations
            .toArray();
        const templates = await db.templates.toArray();

        zip.file('manifest.json', JSON.stringify({
            version: EKT_SCHEMA_VERSION,
            engineVersion: APP_VERSION,
            exportedAt: new Date().toISOString(),
            presentations: presentations.map(p => ({ id: p.id, name: p.name, binId: p.binId })),
            templates: templates.map(t => ({ id: t.id, name: t.name }))
        }, null, 2));

        // Bin structure to recreate folders on import
        const bins = await db.presentationBins.toArray();
        zip.file('bins.json', JSON.stringify(bins, null, 2));

        // Pack each presentation using EktpService.pack
        // nested logic is preserved inside the individual .ektp blobs
        const presFolder = zip.folder('presentations')!;
        const globalHashSet = new Set<string>(); // global deduplication for media

        for (const p of presentations) {
            try {
                const { blob } = await EktpService.pack(p.id, globalHashSet);
                presFolder.file(`${p.id}.ektp`, blob, { compression: 'STORE' });
            } catch (e) {
                console.error(`Failed to pack presentation ${p.id}`, e);
            }
        }

        // Pack each template using EktmpService.pack
        const tmplFolder = zip.folder('templates')!;
        for (const t of templates) {
            try {
                const blob = await EktmpService.pack(t.id);
                tmplFolder.file(`${t.id}.ektmp`, blob, { compression: 'STORE' });
            } catch (e) {
                console.error(`Failed to pack template ${t.id}`, e);
            }
        }

        return await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
    },

    async unpackEntireGraceLib(blob: Blob): Promise<void> {
        const zip = await JSZip.loadAsync(blob);

        // 1. Restore bins
        const binsFile = zip.file('bins.json');
        if (binsFile) {
            const bins = JSON.parse(await binsFile.async('string'));
            for (const bin of bins) {
                const exists = await db.presentationBins.get(bin.id);
                if (!exists) await db.presentationBins.add(bin);
            }
        }

        // 2. Import presentations via EktpService.unpack
        const presFiles = Object.keys(zip.files)
            .filter(p => p.startsWith('presentations/') && p.endsWith('.ektp'));

        // Pre-parse manifest outside the loop
        const manifestFile = zip.file('manifest.json');
        const manifest = manifestFile ? JSON.parse(await manifestFile.async('string')) : null;

        for (const path of presFiles) {
            const ektpBlob = await zip.file(path)!.async('blob');
            try {
                // EktpService.unpack handles media unpacking internally
                // For native File dropping in Electron/Web we wrap blob into File
                const file = new File([ektpBlob], 'presentation.ektp', { type: 'application/zip' });
                const newId = await EktpService.unpack(file);
                
                // Restore binId from manifest
                if (manifest) {
                    const originalId = path.split('/').pop()!.replace('.ektp', '');
                    const meta = manifest.presentations.find((p: any) => p.id === originalId);
                    if (meta?.binId) {
                        await db.presentationFiles.update(newId, { binId: meta.binId });
                    }
                }
            } catch (e) {
                console.error(`Failed to unpack presentation at ${path}`, e);
            }
        }

        // 3. Import templates via EktmpService.unpack
        const tmplFiles = Object.keys(zip.files)
            .filter(p => p.startsWith('templates/') && p.endsWith('.ektmp'));

        for (const path of tmplFiles) {
            const ektmpBlob = await zip.file(path)!.async('blob');
            try {
                const file = new File([ektmpBlob], 'template.ektmp', { type: 'application/zip' });
                const template = await EktmpService.unpack(file, { preserveId: false, isUserCreated: true });
                const exists = await db.templates.get(template.id);
                if (!exists) await db.templates.add(template);
            } catch (e) {
                console.error(`Failed to unpack template at ${path}`, e);
            }
        }
    },

    async exportItem(id: string, type: 'presentation' | 'template', name: string) {
        try {
            const blob = await this.packSingleItem(id, type);
            const extension = type === 'presentation' ? '.ektp' : '.ektmp';
            const saved = await this._saveFile(blob, `${name}${extension}`, type);
            if (saved) toast.success(i18n.t('export_success', 'Export successful'));
        } catch (error) {
            console.error('Export failed:', error);
            toast.error(i18n.t('export_failed', 'Export failed'));
        }
    },

    async exportCollection(type: 'presentations' | 'templates') {
        try {
            const items = type === 'presentations'
                ? await db.presentationFiles.filter(p => !p.serviceId).toArray()
                : await db.templates.toArray();

            if (items.length === 0) {
                toast.error(i18n.t('nothing_to_export', 'Nothing to export'));
                return;
            }

            const extension = type === 'presentations' ? '.ektp' : '.ektmp';
            const itemType = type === 'presentations' ? 'presentation' : 'template';

            let savedCount = 0;
            for (const item of items) {
                const blob = await this.packSingleItem(item.id, itemType as any);
                const saved = await this._saveFile(blob, `${item.name}${extension}`, itemType as any);
                if (saved) savedCount++;
            }

            if (savedCount > 0) {
                toast.success(i18n.t('collection_export_success', 'Collection exported successfully'));
            }
        } catch (error) {
            console.error('Collection export failed:', error);
            toast.error(i18n.t('export_failed', 'Export failed'));
        }
    },

    async exportGraceLib() {
        try {
            const blob = await this.packEntireGraceLib();
            const filename = `GraceLib_${new Date().toISOString().split('T')[0]}.ektgl`;
            const saved = await this._saveFile(blob, filename, 'gracelib');
            if (saved) toast.success(i18n.t('gracelib_export_success', 'GraceLib exported successfully'));
        } catch (error) {
            console.error('GraceLib export failed:', error);
            toast.error(i18n.t('export_failed', 'Export failed'));
        }
    },

    /**
     * Universal file saver supporting Electron IPC and Web APIs.
     */
    async _saveFile(blob: Blob, filename: string, type: string) {
        // Electron approach
        if ((window as any).electron?.ipcRenderer?.invoke) {
            const uint8Array = new Uint8Array(await blob.arrayBuffer());
            const extMap: Record<string, string[]> = {
                presentation: ['ektp'],
                template: ['ektmp'],
                gracelib: ['ektgl'],
            };
            
            // Clean filename to prevent double extensions if passed wrongly
            const cleanName = filename.endsWith(`.${extMap[type]?.[0]}`) ? filename : `${filename}.${extMap[type]?.[0] || 'bin'}`;
            
            const saved = await (window as any).electron.ipcRenderer.invoke('export:save-file', {
                filename: cleanName,
                data: uint8Array,
                title: i18n.t('export_item', 'Export Item'),
                filters: [{ name: type, extensions: extMap[type] || ['bin'] }]
            });
            
            if (!saved) {
                return false; // User cancelled
            }
            return true;
        }

        // Web fallback (File System Access API)
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: filename,
                    types: [{ description: type, accept: { 'application/zip': [`.${filename.split('.').pop()}`] } }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return true;
            } catch (e: any) {
                if (e.name === 'AbortError') return false;
            }
        }

        // Final fallback standard download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    }
};

