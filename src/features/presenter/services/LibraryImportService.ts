import { db } from '@/core/db/index';
import { EktpService } from './ektpService';
import { EktmpService } from './ektmpService';
import { GraceLibExportService } from './GraceLibExportService';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';
import { MediaType } from '@/core/types';
import { toast } from 'sonner';
import { IpcService } from '@/core/services/IpcService';

interface ILibraryImportOptions {
    t: any;
    currentBinId: string | undefined;
}

/**
 * Service to handle importing of various file types into the presentation library.
 * Supports .ektp, .ektmp, .ektgl, .pptx, and common media files.
 */
export class LibraryImportService {
    /**
     * Handles the import of one or more files/paths.
     * 
     * @param filesOrPaths - Array of File objects or string paths to import.
     * @param currentBinId - Optional ID of the bin to import presentations into.
     * @param t - Translation function for localized messages.
     */
    static async importFiles(
        filesOrPaths: File[] | string[], 
        currentBinId: string | undefined, 
        t: any
    ): Promise<void> {
        if (!filesOrPaths || filesOrPaths.length === 0) return;

        for (const item of filesOrPaths) {
            try {
                // Case 1: If we got File objects (Native Drop or Web Input)
                if (item instanceof File) {
                    await this.importFileObject(item, currentBinId, t);
                }
                // Case 2: If we got string paths (Electron selectFile)
                else if (typeof item === 'string') {
                    await this.importFilePath(item, currentBinId, t);
                }
            } catch (error) {
                console.error('[LibraryImportService] Import failed:', error);
                toast.error(t('import_failed', 'Failed to import item'));
            }
        }
    }

    /**
     * Internal helper to import a File object.
     */
    private static async importFileObject(
        file: File, 
        currentBinId: string | undefined, 
        t: any
    ): Promise<void> {
        const name = file.name.toLowerCase();
        
        if (name.endsWith('.ektgl')) {
            await GraceLibExportService.unpackEntireGraceLib(file);
            toast.success(t('gracelib_imported', 'GraceLib imported'));
        } 
        else if (name.endsWith('.ektp')) {
            const presentationId = await EktpService.unpack(file);
            const presentation = await db.presentationFiles.get(presentationId);
            if (presentation) {
                await db.presentationFiles.update(presentationId, {
                    binId: currentBinId || undefined,
                    serviceId: undefined,
                    isMaster: false
                });
                toast.success(t('presentation_imported', 'Presentation imported: {{name}}', { name: presentation.name }));
            }
        } 
        else if (name.endsWith('.ektmp')) {
            await EktmpService.unpack(file);
            toast.success(t('template_imported', 'Template imported: {{name}}', { name: file.name }));
        } 
        else if (name.endsWith('.pptx')) {
            const { PptxImportService } = await import('./PptxImportService');
            const presentation = await PptxImportService.convert(file);
            const newId = `imported-pptx-${crypto.randomUUID()}`;
            await db.presentationFiles.add({
                ...presentation,
                id: newId,
                serviceId: undefined,
                binId: currentBinId || undefined,
                updatedAt: new Date(),
                isMaster: false
            });
            toast.success(t('pptx_import_success', 'PowerPoint imported'));
        } 
        else {
            // Media Fallback
            let type: MediaType = 'image';
            if (file.type.startsWith('video/')) type = 'video';
            if (file.type.startsWith('audio/')) type = 'audio';

            const { MediaPersistenceService } = await import('./MediaPersistenceService');
            await MediaPersistenceService.importMediaBlob(file, (file as any).path || null, type);
            toast.success(t('media_imported', 'Media imported: {{name}}', { name: file.name }));
        }
    }

    /**
     * Internal helper to import a file from a local path (Electron).
     */
    private static async importFilePath(
        path: string, 
        currentBinId: string | undefined, 
        t: any
    ): Promise<void> {
        const nameStr = path.split(/[/\\]/).pop() || 'Untitled';
        const name = nameStr.toLowerCase();
        const ext = name.split('.').pop()?.toLowerCase() || '';

        if (ext === 'ektgl') {
            const file = await this.pathToLocalFile(path, nameStr, 'application/zip');
            await GraceLibExportService.unpackEntireGraceLib(file);
            toast.success(t('gracelib_imported', 'GraceLib imported'));
        } 
        else if (ext === 'ektp') {
            const file = await this.pathToLocalFile(path, nameStr, 'application/zip');
            const presentationId = await EktpService.unpack(file);
            const presentation = await db.presentationFiles.get(presentationId);
            if (presentation) {
                await db.presentationFiles.update(presentationId, {
                    binId: currentBinId || undefined,
                    serviceId: undefined,
                    isMaster: false
                });
                toast.success(t('presentation_imported', 'Presentation imported: {{name}}', { name: presentation.name }));
            }
        } 
        else if (ext === 'ektmp') {
            const file = await this.pathToLocalFile(path, nameStr, 'application/zip');
            await EktmpService.unpack(file);
            toast.success(t('template_imported', 'Template imported: {{name}}', { name: nameStr }));
        } 
        else if (ext === 'pptx') {
            const file = await this.pathToLocalFile(path, nameStr, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
            const { PptxImportService } = await import('./PptxImportService');
            const presentation = await PptxImportService.convert(file);
            const newId = `imported-pptx-${crypto.randomUUID()}`;
            await db.presentationFiles.add({
                ...presentation,
                id: newId,
                serviceId: undefined,
                binId: currentBinId || undefined,
                updatedAt: new Date(),
                isMaster: false
            });
            toast.success(t('pptx_import_success', 'PowerPoint imported'));
        } 
        else {
            // Media file
            let type: MediaType = 'image';
            if (['mp4', 'webm', 'mov'].includes(ext)) type = 'video';
            if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) type = 'audio';

            const { MediaPersistenceService } = await import('./MediaPersistenceService');
            await MediaPersistenceService.importMediaFromPath(path, type);
            toast.success(t('media_imported', 'Media imported: {{name}}', { name: nameStr }));
        }
    }

    /**
     * Triggers the file selection dialog (Electron or Browser fallback) and imports selected files.
     */
    static async selectAndImport(options: ILibraryImportOptions): Promise<void> {
        const { t, currentBinId } = options;

        if (!IpcService.isElectron()) {
            // Web fallback
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = '.ektp,.ektmp,.ektgl,.pptx,image/*,video/*,audio/*';
            input.onchange = (e) => {
                const files = Array.from((e.target as HTMLInputElement).files || []);
                this.importFiles(files, currentBinId, t);
            };
            input.click();
            return;
        }

        try {
            const files = await IpcService.selectFile({
                properties: ['openFile', 'multiSelections'],
                filters: [
                    { name: 'Supported Files', extensions: ['ektp', 'ektmp', 'ektgl', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'mp4', 'webm', 'ogg', 'mp3', 'wav', 'm4a', 'aac', 'flac'] }
                ]
            });
            if (!files) return;
            await this.importFiles(files, currentBinId, t);
        } catch (error) {
            console.error('[LibraryImportService] Failed to open file picker:', error);
        }
    }

    /**
     * Converts a local file path to a File object for processing.
     */
    private static async pathToLocalFile(path: string, fileName: string, type: string): Promise<File> {
        const response = await fetch(getLocalResourceUrl(path));
        const blob = await response.blob();
        return new File([blob], fileName, { type });
    }
}
