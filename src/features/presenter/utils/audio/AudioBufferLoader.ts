import { db } from '@/core/db';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';
import { extractPathFromLocalResource } from '../../services/mediaPackingUtils';
import { IpcService } from '@/core/services/ipcService';
import { generateWaveformPoints } from '@/core/utils/audioUtils';

export class AudioBufferLoader {
    private static instance: AudioBufferLoader;

    // File cache with LRU limits to prevent memory bloat
    public bufferCache: Map<string, AudioBuffer> = new Map();
    public waveformCache: Map<string, number[]> = new Map();
    public blobUrlCache: Map<string, string> = new Map();
    public durationCache: Map<string, number> = new Map();

    // Limits
    private readonly MAX_BUFFER_CACHE = 10;
    private readonly MAX_WAVEFORM_CACHE = 50;
    private readonly MAX_BLOB_CACHE = 20;

    private loadingPromises: Map<string, Promise<AudioBuffer | null>> = new Map();
    private durationPromises: Map<string, Promise<number>> = new Map();
    private resolvePromises: Map<string, Promise<string>> = new Map();

    private constructor() { }

    public static getInstance(): AudioBufferLoader {
        if (!AudioBufferLoader.instance) {
            AudioBufferLoader.instance = new AudioBufferLoader();
        }
        return AudioBufferLoader.instance;
    }

    private resolveUrl(fileId: string): string {
        return getLocalResourceUrl(fileId);
    }

    public async resolveEffectiveUrl(fileId: string): Promise<string> {
        if (!fileId) return '';

        // Reuse cached blob URL if we already created one for this fileId
        const cached = this.blobUrlCache.get(fileId);
        if (cached) return cached;

        // Concurrency Guard: If we are already resolving this file, wait for it
        const ongoing = this.resolvePromises.get(fileId);
        if (ongoing) return ongoing;

        const resolutionPromise = (async () => {
            // Check if we already have this in DB (e.g. imported media)
            let dbItem = (await db.mediaPool.get(fileId) || await db.backgrounds.get(fileId)) as { data?: Blob, path?: string } | undefined;
            
            if (!dbItem) {
                // Fallback 1: check by exact path match
                const path = extractPathFromLocalResource(fileId) || fileId;
                dbItem = await db.mediaPool.where('path').equals(path).first();
                
                if (!dbItem) {
                    // Fallback 1.5: check backgrounds table by path
                    dbItem = await db.backgrounds.where('path').equals(path).first();
                }

                if (!dbItem) {
                    // Fallback 2: check by filename only (useful for presentations from other machines)
                    const filename = path.split(/[/\\]/).pop();
                    if (filename && filename.includes('.')) {
                        dbItem = await db.mediaPool.where('name').equals(filename).first();
                        
                        // Final sanity check: try normalized name fallback
                        if (!dbItem) {
                            const normalized = filename.normalize('NFC');
                            dbItem = await db.mediaPool.where('name').equals(normalized).first();
                        }
                    }
                }
            }

            if (dbItem?.data) {
                const blobUrl = URL.createObjectURL(dbItem.data);
                
                // LRU for Blob URLs to prevent memory leaks
                if (this.blobUrlCache.size >= this.MAX_BLOB_CACHE) {
                    const oldestKey = this.blobUrlCache.keys().next().value;
                    if (oldestKey) {
                        const oldUrl = this.blobUrlCache.get(oldestKey);
                        if (oldUrl) URL.revokeObjectURL(oldUrl);
                        this.blobUrlCache.delete(oldestKey);
                    }
                }
                
                this.blobUrlCache.set(fileId, blobUrl);
                return blobUrl;
            }

            const dbPath = dbItem && 'path' in dbItem ? dbItem.path as string : undefined;
            const pathToCheck = dbPath || extractPathFromLocalResource(fileId) || fileId;
            return this.resolveUrl(pathToCheck);
        })().finally(() => {
            this.resolvePromises.delete(fileId);
        });

        this.resolvePromises.set(fileId, resolutionPromise);
        return resolutionPromise;
    }

    public async getWaveform(fileId: string, samples: number = 100, ctx: AudioContext): Promise<number[] | null> {
        if (!fileId) return null;
        const cacheKey = `${fileId}:${samples}`;
        const cached = this.waveformCache.get(cacheKey);
        if (cached) return cached;

        // Size check first as it is the safest/fastest
        const stats = await this.getFileStats(fileId);
        if (stats && stats.size > 50 * 1024 * 1024) return null;

        const duration = await this.getDuration(fileId);
        if (duration <= 0 || duration > 300) return null;

        const buffer = await this.loadAudio(fileId, ctx);
        if (!buffer) return null;

        const points = generateWaveformPoints(buffer, samples);
        
        // Update waveform LRU cache
        if (this.waveformCache.size >= this.MAX_WAVEFORM_CACHE) {
            const oldestKey = this.waveformCache.keys().next().value;
            if (oldestKey) this.waveformCache.delete(oldestKey);
        }
        this.waveformCache.set(cacheKey, points);
        
        return points;
    }

    public async loadAudio(url: string, ctx: AudioContext): Promise<AudioBuffer | null> {
        if (!url) return null;
        let resolvedUrl = await this.resolveEffectiveUrl(url);
        if (!resolvedUrl) return null;

        const cached = this.bufferCache.get(resolvedUrl);
        if (cached) return cached;

        // Concurrency Guard
        const existingPromise = this.loadingPromises.get(resolvedUrl);
        if (existingPromise) return existingPromise;

        const loadPromise = (async () => {
            try {
                // Metadata-first check BEFORE fetch
                // We allow up to 300s (5 minutes) to be decoded into memory.
                // This is needed for waveforms. Anything longer is discarded to save RAM.
                const duration = await this.getDuration(url);
                if (duration <= 0 || duration > 300) {
                    return null;
                }

                const response = await fetch(resolvedUrl);
                if (!response.ok) {
                    return null;
                }

                const contentLength = response.headers.get('Content-Length');
                if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) {
                    return null;
                }

                const arrayBuffer = await response.arrayBuffer();

                try {
                    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                    
                    // Update buffer LRU cache
                    if (this.bufferCache.size >= this.MAX_BUFFER_CACHE) {
                        const oldestKey = this.bufferCache.keys().next().value;
                        if (oldestKey) this.bufferCache.delete(oldestKey);
                    }
                    this.bufferCache.set(resolvedUrl, audioBuffer);
                    
                    return audioBuffer;
                } catch (e) {
                    console.error('AudioBufferLoader: Decode error', e);
                    return null;
                }
            } catch (error) {
                return null;
            } finally {
                this.loadingPromises.delete(resolvedUrl);
            }
        })();

        this.loadingPromises.set(resolvedUrl, loadPromise);
        return loadPromise;
    }

    public async getFileStats(path: string): Promise<{ size: number } | null> {
        try {
            return await IpcService.invoke<{ size: number } | null>('get-file-stats', path);
        } catch (e) {
            return null;
        }
    }

    public async getDuration(url: string): Promise<number> {
        if (!url) return 0;
        let resolvedUrl = await this.resolveEffectiveUrl(url);
        if (!resolvedUrl) return 0;

        if (this.durationCache.has(resolvedUrl)) return this.durationCache.get(resolvedUrl)!;

        // Concurrency Guard for metadata probe
        const existingPromise = this.durationPromises.get(resolvedUrl);
        if (existingPromise) return existingPromise;

        const probePromise = (async () => {
            // Size-based Fast Fail BEFORE media pipeline
            // If file is > 50MB, assume it's long and avoid probing
            const stats = await this.getFileStats(url);
            if (!stats) {
                return 0; // File is missing, don't even try to probe
            }
            if (stats.size > 50 * 1024 * 1024) {
                return 301; // Fake "long enough" duration to trigger streaming
            }

            return new Promise<number>((resolve) => {
                const tempAudio = new Audio(resolvedUrl);
                tempAudio.onloadedmetadata = () => {
                    const d = tempAudio.duration;
                    tempAudio.src = '';
                    tempAudio.load(); // Aggressive release
                    this.durationCache.set(resolvedUrl, d);
                    resolve(d);
                };
                tempAudio.onerror = () => {
                    tempAudio.src = '';
                    resolve(0);
                };
                // 5s timeout for probe to prevent hanging
                setTimeout(() => {
                    tempAudio.src = '';
                    resolve(0);
                }, 5000);
            });
        })().finally(() => {
            this.durationPromises.delete(resolvedUrl);
        });

        this.durationPromises.set(resolvedUrl, probePromise);
        return probePromise;
    }
}
