import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { db } from '../db';

class FFmpegService {
    private ffmpeg: FFmpeg | null = null;
    private isLoaded = false;
    private loadPromise: Promise<void> | null = null;
    public isSupported = true; // Assume true, fallback handled gently if SAB fails

    async load() {
        if (this.isLoaded) return;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            try {
                this.ffmpeg = new FFmpeg();
                
                const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
                await this.ffmpeg.load({
                    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                });
                this.isLoaded = true;
            } catch (error) {
                console.error('[FFmpegService] Failed to load FFmpeg.wasm:', error);
                this.isSupported = false;
                throw error;
            }
        })();

        return this.loadPromise;
    }

    /**
     * Lossless trim of a media file via stream copy.
     */
    async trimMedia(blob: Blob, start: number, end: number, extension = 'mp4'): Promise<Blob> {
        await this.load();
        if (!this.ffmpeg) throw new Error("FFmpeg not loaded.");

        const inputName = `input.${extension}`;
        const outputName = `output.${extension}`;

        // Write file
        await this.ffmpeg.writeFile(inputName, await fetchFile(blob));

        // Execute trim command (stream copy)
        // -ss start
        // -to end
        // -c copy
        await this.ffmpeg.exec([
            '-i', inputName,
            '-ss', String(start),
            '-to', String(end),
            '-c', 'copy',
            outputName
        ]);

        // Read resulting file
        const data = await this.ffmpeg.readFile(outputName);
        
        // Clean up memory
        await this.ffmpeg.deleteFile(inputName);
        await this.ffmpeg.deleteFile(outputName);

        const mimeType = blob.type || `video/${extension}`;
        return new Blob([data as Uint8Array], { type: mimeType });
    }

    /**
     * Trims a media item from the database and returns a new Blob
     */
    async trimMediaById(mediaId: string, start: number, end: number): Promise<Blob | null> {
        let entry: any = await db.backgrounds.get(mediaId);
        if (!entry) {
            entry = await db.mediaPool.get(mediaId);
        }

        if (!entry || !entry.data) return null;

        const blob = entry.data as Blob;
        // Basic detection of extension
        const extMatch = entry.name ? entry.name.match(/\.([a-z0-9]+)$/i) : null;
        let ext = extMatch ? extMatch[1].toLowerCase() : 'mp4';
        
        // Ensure webm goes to webm, etc
        if (blob.type.includes('webm')) ext = 'webm';
        else if (blob.type.includes('mp3')) ext = 'mp3';
        else if (blob.type.includes('wav')) ext = 'wav';

        return this.trimMedia(blob, start, end, ext);
    }
}

export const ffmpegService = new FFmpegService();
