import { db } from '@/core/db/index';
import { EktpService } from './ektpService';
import { EktmpService } from './ektmpService';
import { GraceLibExportService } from './GraceLibExportService';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';
import { MediaType, ISlide, ICanvasItem } from '@/core/types';
import { toast } from 'sonner';
import { IpcService } from '@/core/services/ipcService';

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

        const mediaItems: { file?: File; path?: string; type: MediaType }[] = [];
        const presentations: { file?: File; path?: string }[] = [];

        for (const item of filesOrPaths) {
            const isFile = item instanceof File;
            const name = (isFile ? item.name : (item as string).split(/[/\\]/).pop() || '').toLowerCase();
            const ext = name.split('.').pop();

            if (ext && ['ektp', 'ektmp', 'ektgl', 'pptx'].includes(ext)) {
                presentations.push(isFile ? { file: item } : { path: item as string });
            } else {
                let type: MediaType = 'image';
                if (ext && ['mp4', 'webm', 'mov'].includes(ext)) type = 'video';
                if (ext && ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) type = 'audio';
                // Also check file.type if it's a File object
                if (isFile) {
                    if (item.type.startsWith('video/')) type = 'video';
                    else if (item.type.startsWith('audio/')) type = 'audio';
                }
                mediaItems.push(isFile ? { file: item, path: (item as any).path, type } : { path: item as string, type });
            }
        }

        // 1. Process Presentations Sequentially (they have internal logic/side effects)
        for (const pres of presentations) {
            try {
                if (pres.file) await this.importFileObject(pres.file, currentBinId, t);
                else if (pres.path) await this.importFilePath(pres.path, currentBinId, t);
            } catch (err) {
                console.error('[LibraryImportService] Presentation import failed:', err);
                toast.error(t('import_failed', 'Failed to import presentation'));
            }
        }

        // 2. Process Media in Batch (Fast & Parallel)
        if (mediaItems.length > 0) {
            const { MediaPersistenceService } = await import('./MediaPersistenceService');
            const results = await MediaPersistenceService.importMediaBatch(mediaItems, { binId: currentBinId });
            const successfulIds = results.filter((id): id is string => id !== null);
            if (successfulIds.length > 0) {
                toast.success(t('media_imported_batch', 'Imported {{count}} media files', { count: successfulIds.length }));
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
            const presentationId = await EktpService.unpack(file, 0, new Set(), currentBinId);
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
            const { getUniquePresentationName } = await import('@/core/utils/nameUtils');
            const uniqueName = await getUniquePresentationName(presentation.name);
            await db.presentationFiles.add({
                ...presentation,
                id: newId,
                name: uniqueName,
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
            const presentationId = await EktpService.unpack(file, 0, new Set(), currentBinId);
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
            const { getUniquePresentationName } = await import('@/core/utils/nameUtils');
            const uniqueName = await getUniquePresentationName(presentation.name);
            await db.presentationFiles.add({
                ...presentation,
                id: newId,
                name: uniqueName,
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

    /**
     * Triggers file selection and imports slides from the chosen .ektp or .pptx file directly into the timeline.
     */
    static async selectAndImportSlides(
        targetPresentationId: string,
        targetIndex: number,
        t: any
    ): Promise<void> {
        let file: File | null = null;

        if (!IpcService.isElectron()) {
            file = await new Promise<File | null>((resolve) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.ektp,.pptx';
                input.onchange = (e) => {
                    const files = Array.from((e.target as HTMLInputElement).files || []);
                    resolve(files.length > 0 ? files[0] : null);
                };
                input.click();
            });
        } else {
            try {
                const files = await IpcService.selectFile({
                    properties: ['openFile'],
                    filters: [
                        { name: 'Presentation Files', extensions: ['ektp', 'pptx'] }
                    ]
                });
                if (files && files.length > 0) {
                    const nameStr = files[0].split(/[/\\]/).pop() || 'Untitled';
                    file = await this.pathToLocalFile(files[0], nameStr, 'application/zip');
                }
            } catch (error) {
                console.error('[LibraryImportService] Failed to select file:', error);
            }
        }

        if (!file) return;

        try {
            const name = file.name.toLowerCase();
            let slides: ISlide[] = [];

            if (name.endsWith('.ektp')) {
                const tempPresId = await EktpService.unpack(file);
                const tempPres = await db.presentationFiles.get(tempPresId);
                if (tempPres) {
                    slides = tempPres.slides;
                    await db.presentationFiles.delete(tempPresId);
                }
            } else if (name.endsWith('.pptx')) {
                const { PptxImportService } = await import('./PptxImportService');
                const presentation = await PptxImportService.convert(file);
                slides = presentation.slides;
            }

            if (slides.length === 0) {
                toast.error(t('no_slides_imported', 'No slides found in the selected file'));
                return;
            }

            const targetPres = await db.presentationFiles.get(targetPresentationId);
            if (!targetPres) return;

            const updatedSlides = [...targetPres.slides];
            const slideIdMap = new Map<string, string>();
            
            const newSlidesToInsert: ISlide[] = slides.map(s => {
                const cloned: ISlide = structuredClone(s);
                const newId = crypto.randomUUID();
                slideIdMap.set(s.id, newId);
                cloned.id = newId;
                if (cloned.type === 'normal' && cloned.content && cloned.content.canvasItems) {
                    cloned.content.canvasItems = cloned.content.canvasItems.map((item: ICanvasItem) => ({
                        ...item,
                        id: crypto.randomUUID()
                    }));
                }
                return cloned;
            });

            updatedSlides.splice(targetIndex, 0, ...newSlidesToInsert);
            const ordered = updatedSlides.map((s, i) => ({ ...s, order: i }));

            // Update presentation slides via presentation store to notify UI
            const { usePresentationStore } = await import('@/features/presenter/store/presentationStore');
            await usePresentationStore.getState().updatePresentationSlides(targetPresentationId, ordered);

            // Select the first imported slide
            usePresentationStore.getState().setSelectedSlideIds(newSlidesToInsert.map(s => s.id));
            usePresentationStore.getState().setPreviewSlide(newSlidesToInsert[0].id, targetPresentationId);

            toast.success(t('slides_imported_success', 'Imported {{count}} slides directly to timeline', { count: newSlidesToInsert.length }));
        } catch (err) {
            console.error('[LibraryImportService] Failed to import slides from file:', err);
            toast.error(t('import_slides_failed', 'Failed to import slides from file'));
        }
    }
}
