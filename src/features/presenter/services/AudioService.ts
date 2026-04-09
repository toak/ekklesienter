import { IAudioScope, ISlide, ICanvasSlide } from '@/core/types';
import { generateWaveformPoints } from '@/core/utils/audioUtils';
import { db } from '@/core/db';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';
import { extractPathFromLocalResource } from './mediaPackingUtils';
import { IpcService } from '@/core/services/IpcService';

class AudioService {
    private static instance: AudioService;
    private audioContext: AudioContext | null = null;
    private targetScopeId: string | null = null;

    // Playback state
    private activeTracks: Map<string, {
        source: AudioBufferSourceNode | MediaElementAudioSourceNode;
        gain: GainNode;
        scope: IAudioScope;
        mediaElement?: HTMLAudioElement;
    }> = new Map();

    // File cache to avoid re-decoding
    private bufferCache: Map<string, AudioBuffer> = new Map();
    private loadingPromises: Map<string, Promise<AudioBuffer | null>> = new Map();
    private durationPromises: Map<string, Promise<number>> = new Map();
    private durationCache: Map<string, number> = new Map();
    private waveformCache: Map<string, number[]> = new Map();
    private blobUrlCache: Map<string, string> = new Map();

    private constructor() { }

    public static getInstance(): AudioService {
        if (!AudioService.instance) {
            AudioService.instance = new AudioService();
        }
        return AudioService.instance;
    }

    private ensureContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        return this.audioContext;
    }

    private resolveUrl(fileId: string): string {
        return getLocalResourceUrl(fileId);
    }

    private async resolveEffectiveUrl(fileId: string): Promise<string> {
        if (!fileId) return '';

        // Reuse cached blob URL if we already created one for this fileId
        const cached = this.blobUrlCache.get(fileId);
        if (cached) return cached;
        
        // Check if we already have this in DB (e.g. imported media)
        let dbItem = await db.mediaPool.get(fileId) || await db.backgrounds.get(fileId);
        
        if (!dbItem) {
            // Fallback 1: check by exact path match
            const path = extractPathFromLocalResource(fileId) || fileId;
            dbItem = await db.mediaPool.where('path').equals(path).first();
            
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
            console.log(`[AudioService] Created Blob URL: ${blobUrl} (Origin: ${window.location.origin}, ID: ${fileId})`);
            this.blobUrlCache.set(fileId, blobUrl);
            return blobUrl;
        }

        const dbPath = dbItem && 'path' in dbItem ? dbItem.path as string : undefined;
        const pathToCheck = dbPath || extractPathFromLocalResource(fileId) || fileId;
        const stats = await this.getFileStats(pathToCheck);
        
        if (!stats) {
            console.warn(`[AudioService] File not found on disk or DB: ${pathToCheck}`);
            return '';
        }
        
        return this.resolveUrl(pathToCheck);
    }

    public async getWaveform(fileId: string, samples: number = 100): Promise<number[] | null> {
        if (!fileId) return null;
        const cacheKey = `${fileId}:${samples}`;
        if (this.waveformCache.has(cacheKey)) {
            return this.waveformCache.get(cacheKey)!;
        }

        // AI Fix: If duration or size is already known to be long, don't even try
        // Size check first as it is the safest/fastest
        const stats = await this.getFileStats(fileId);
        if (stats && stats.size > 50 * 1024 * 1024) return null;

        const duration = await this.getDuration(fileId);
        if (duration > 300) return null;

        const buffer = await this.loadAudio(fileId);
        if (!buffer) return null;

        const points = generateWaveformPoints(buffer, samples);
        this.waveformCache.set(cacheKey, points);
        return points;
    }

    private async loadAudio(url: string): Promise<AudioBuffer | null> {
        if (!url) return null;
        let resolvedUrl = await this.resolveEffectiveUrl(url);
        if (!resolvedUrl) return null;

        if (this.bufferCache.has(resolvedUrl)) return this.bufferCache.get(resolvedUrl)!;

        // AI Fix: Concurrency Guard
        const existingPromise = this.loadingPromises.get(resolvedUrl);
        if (existingPromise) return existingPromise;

        const loadPromise = (async () => {
            try {
                // AI Fix: Metadata-first check BEFORE fetch
                const duration = await this.getDuration(url);
                if (duration > 60) {
                    return null;
                }

                const response = await fetch(resolvedUrl);
                if (!response.ok) {
                    // One last attempt: maybe the URL resolution was wrong for a DB item?
                    // Already checked dbItem above, so if we're here, fetch just failed.
                    return null;
                }

                const contentLength = response.headers.get('Content-Length');
                if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) {
                    return null;
                }

                const arrayBuffer = await response.arrayBuffer();
                const ctx = this.ensureContext();

                try {
                    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                    this.bufferCache.set(resolvedUrl, audioBuffer);
                    return audioBuffer;
                } catch (e) {
                    console.error('AudioService: Decode error', e);
                    return null;
                }
            } catch (error) {
                return null;
            } finally {
                this.loadingPromises.delete(resolvedUrl);
                // If we created a blob URL, we should probably revoke it eventually,
                // but bufferCache depends on it for now.
            }
        })();

        this.loadingPromises.set(resolvedUrl, loadPromise);
        return loadPromise;
    }

    private async getFileStats(path: string): Promise<{ size: number } | null> {
        try {
            return await IpcService.invoke<{ size: number } | null>('get-file-stats', path);
        } catch (e) {
            return null;
        }
    }

    private async getDuration(url: string): Promise<number> {
        if (!url) return 0;
        let resolvedUrl = await this.resolveEffectiveUrl(url);
        if (!resolvedUrl) return 0;

        if (this.durationCache.has(resolvedUrl)) return this.durationCache.get(resolvedUrl)!;

        // AI Fix: Concurrency Guard for metadata probe
        const existingPromise = this.durationPromises.get(resolvedUrl);
        if (existingPromise) return existingPromise;

        const probePromise = (async () => {
            // AI Fix: Size-based Fast Fail BEFORE media pipeline
            // If file is > 50MB, assume it's long and avoid probing if we are in a crash-prone state
            const stats = await this.getFileStats(url);
            if (stats && stats.size > 50 * 1024 * 1024) {
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

    public async sync(liveSlideId: string | null, slides: ISlide[], presentationScopes?: IAudioScope[]) {
        if (!liveSlideId) {
            this.targetScopeId = null;
            this.stopAll(0.5);
            return;
        }

        const activeScope = this.findActiveScope(liveSlideId, slides, presentationScopes);
        if (!activeScope) {
            this.targetScopeId = null;
            this.stopAll(1.0);
            return;
        }

        this.targetScopeId = activeScope.id;
        const currentTrack = this.activeTracks.get(activeScope.id);

        if (currentTrack) {
            if (this.audioContext) {
                const now = this.audioContext.currentTime;
                const volumeChanged = currentTrack.scope.volume !== activeScope.volume;
                const muteChanged = currentTrack.scope.isMuted !== activeScope.isMuted;

                if (volumeChanged || muteChanged) {
                    const targetVolume = activeScope.isMuted ? 0.001 : (activeScope.volume ?? 1);
                    const fadeDuration = activeScope.volumeFadeDuration ?? 0.1;

                    currentTrack.gain.gain.cancelScheduledValues(now);
                    currentTrack.gain.gain.setValueAtTime(Math.max(0.0001, currentTrack.gain.gain.value), now);
                    currentTrack.gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, targetVolume), now + Math.max(0.01, fadeDuration));

                    currentTrack.scope.volume = activeScope.volume;
                    currentTrack.scope.isMuted = activeScope.isMuted;
                }
            }
            return;
        }

        await this.playScope(activeScope);
    }

    private findActiveScope(slideId: string, slides: ISlide[], presentationScopes?: IAudioScope[]): IAudioScope | null {
        const slideIndex = slides.findIndex(s => s.id === slideId);
        if (slideIndex === -1) return null;

        const allScopes: IAudioScope[] = [];
        
        // 1. Root-level/Relational Scopes
        if (presentationScopes && Array.isArray(presentationScopes)) {
            allScopes.push(...presentationScopes);
        }

        // 2. Slide-level Scopes (Legacy nesting)
        slides.forEach(s => { 
            if (s.type === 'normal') {
                const cs = s as ICanvasSlide;
                if (cs.audioScopes) allScopes.push(...cs.audioScopes); 
            }
        });

        for (const scope of allScopes) {
            const startIndex = slides.findIndex(s => s.id === scope.startSlideId);
            const endIndex = slides.findIndex(s => s.id === scope.endSlideId);
            if (startIndex !== -1 && endIndex !== -1 && slideIndex >= startIndex && slideIndex <= endIndex) {
                return scope;
            }
        }
        return null;
    }

    public async playScope(scope: IAudioScope): Promise<{ duration: number; startTime: number } | null> {
        if (!scope?.fileId) return null;

        const ctx = this.ensureContext();
        const resolvedUrl = await this.resolveEffectiveUrl(scope.fileId);
        if (!resolvedUrl) return null;

        // AI Fix (Proactive Guard): Check duration FIRST with a metadata probe
        // This avoids fetching the whole 2GB file if it's just meant for streaming.
        const cachedBuffer = this.bufferCache.get(resolvedUrl);
        let duration = cachedBuffer ? cachedBuffer.duration : 0;
        let isLongFile = false;

        if (!cachedBuffer) {
            duration = await this.getDuration(scope.fileId);
            // If duration is > 300s (5 minutes), we treat it as a long file and bypass decode
            if (duration > 300) {
                isLongFile = true;
            }
        }

        if (this.targetScopeId && this.targetScopeId !== scope.id) return null;

        // Determine if we need to load/decode or stream
        let buffer: AudioBuffer | null = null;
        let audio: HTMLAudioElement | undefined;

        if (isLongFile) {
            // Streaming path
            audio = new Audio(resolvedUrl);
            audio.crossOrigin = "anonymous";
        } else {
            // Buffered path (fetch + decode)
            buffer = await this.loadAudio(scope.fileId);
            if (!buffer) {
                // Fallback to streaming if buffer loading failed (e.g. file too large but duration was missing)
                if (duration === 0) duration = await this.getDuration(scope.fileId);
                if (duration === 0) return null;
                audio = new Audio(resolvedUrl);
                audio.crossOrigin = "anonymous";
            } else {
                duration = buffer.duration;
            }
        }

        const now = ctx.currentTime;
        const fadeInTime = Math.max(0.01, scope.crossfadeSettings?.fadeInDuration ?? 1.0);
        const fadeOutTime = Math.max(0.01, scope.crossfadeSettings?.fadeOutDuration ?? 1.0);

        // Fade and cleanup previous — collect first, delete, then iterate (no mutation during iteration)
        const idsToFadeOut = Array.from(this.activeTracks.keys()).filter(id => id !== scope.id);
        const tracksToFadeOut = idsToFadeOut.map(id => ({ id, track: this.activeTracks.get(id)! }));
        idsToFadeOut.forEach(id => this.activeTracks.delete(id));

        tracksToFadeOut.forEach(({ track }) => {
            try {
                const trackFadeOut = Math.max(0.01, track.scope.crossfadeSettings?.fadeOutDuration ?? fadeOutTime);
                track.gain.gain.cancelScheduledValues(now);
                track.gain.gain.setValueAtTime(Math.max(0.0001, track.gain.gain.value), now);
                track.gain.gain.exponentialRampToValueAtTime(0.0001, now + trackFadeOut);

                if (track.source instanceof AudioBufferSourceNode) {
                    track.source.stop(now + trackFadeOut);
                } else {
                    // Cleanup for MediaElement
                    const el = track.mediaElement;
                    setTimeout(() => {
                        try {
                            if (el) {
                                el.pause();
                                el.src = ""; // Release resources
                                el.load(); // Force browser to drop buffers
                                el.remove();
                            }
                        } catch (e) { /* intentional */ }
                    }, trackFadeOut * 1000);
                }
            } catch (e) { /* intentional */ }
        });

        const offset = scope.trimStart || 0;
        let source: AudioBufferSourceNode | MediaElementAudioSourceNode;

        if (audio) {
            // Disable native loop for HTMLAudioElement so we can handle it manually with trimming
            audio.loop = false;
            audio.currentTime = offset;
            source = ctx.createMediaElementSource(audio);
            
            // Boundary enforcement for streaming audio
            const trimEnd = scope.trimEnd || 0;
            const onTimeUpdate = () => {
                if (trimEnd > 0 && audio.currentTime >= trimEnd - 0.05) {
                    if (scope.loop) {
                        audio.currentTime = offset;
                        audio.play().catch(() => {});
                    } else {
                        audio.pause();
                        audio.currentTime = trimEnd;
                    }
                }
            };
            audio.addEventListener('timeupdate', onTimeUpdate);
            
            // AI Fix: Ensure we don't start multiple times
            audio.play().catch(e => console.error('AudioService: Playback failed', e));
        } else {
            const bufSource = ctx.createBufferSource();
            bufSource.buffer = buffer!;
            
            if (scope.loop) {
                bufSource.loop = true;
                bufSource.loopStart = offset;
                bufSource.loopEnd = scope.trimEnd || buffer!.duration;
            } else {
                bufSource.loop = false;
            }
            
            source = bufSource;
            const playDuration = (scope.trimEnd && scope.trimEnd > offset) ? (scope.trimEnd - offset) : buffer!.duration - offset;
            bufSource.start(now, offset, scope.loop ? undefined : Math.max(0, playDuration));
        }

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.001, now);
        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        const targetVolume = scope.isMuted ? 0.001 : (scope.volume ?? 1);
        gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, targetVolume), now + fadeInTime);

        // Handle end
        const onEnded = () => {
            if (scope.onEnded) scope.onEnded();
            if (this.activeTracks.get(scope.id)?.source === source) {
                this.activeTracks.delete(scope.id);
            }
            if (audio) {
                audio.pause();
                audio.src = "";
                audio.load();
            }
        };

        if (source instanceof AudioBufferSourceNode) {
            source.onended = onEnded;
        } else if (audio) {
            audio.onended = onEnded;
        }

        const finalDuration = (scope.trimEnd && scope.trimEnd > offset) ? (scope.trimEnd - offset) : duration - offset;
        this.activeTracks.set(scope.id, { source, gain: gainNode, scope: { ...scope }, mediaElement: audio });

        return { duration: finalDuration, startTime: now };
    }


    public stopScope(scopeId: string, fadeDuration: number) {
        const track = this.activeTracks.get(scopeId);
        if (!track || !this.audioContext) return;

        this.activeTracks.delete(scopeId);
        try {
            const now = this.audioContext.currentTime;
            const finalFade = Math.max(0.01, track.scope.crossfadeSettings?.fadeOutDuration ?? fadeDuration);
            track.gain.gain.cancelScheduledValues(now);
            track.gain.gain.setValueAtTime(Math.max(0.0001, track.gain.gain.value), now);
            track.gain.gain.exponentialRampToValueAtTime(0.0001, now + finalFade);

            if (track.source instanceof AudioBufferSourceNode) {
                track.source.stop(now + finalFade);
            } else {
                const el = track.mediaElement;
                setTimeout(() => {
                    try {
                        if (el) {
                            el.pause();
                            el.src = "";
                            el.load();
                        }
                    } catch (e) { }
                }, finalFade * 1000);
            }
        } catch (e) { }
    }

    public stopAll(fadeDuration: number) {
        if (!this.audioContext) return;
        const now = this.audioContext.currentTime;
        const tracksToStop = Array.from(this.activeTracks.values());
        this.activeTracks.clear();

        tracksToStop.forEach((track) => {
            try {
                const trackFade = Math.max(0.01, track.scope.crossfadeSettings?.fadeOutDuration ?? fadeDuration);
                track.gain.gain.cancelScheduledValues(now);
                track.gain.gain.setValueAtTime(Math.max(0.0001, track.gain.gain.value), now);
                track.gain.gain.exponentialRampToValueAtTime(0.0001, now + trackFade);
                if (track.source instanceof AudioBufferSourceNode) {
                    track.source.stop(now + trackFade);
                } else {
                    const el = track.mediaElement;
                    setTimeout(() => {
                        try {
                            if (el) {
                                el.pause();
                                el.src = "";
                                el.load();
                            }
                        } catch (e) { }
                    }, trackFade * 1000);
                }
            } catch (e) { }
        });
    }

    public getTrackProgress(scopeId: string): { current: number; duration: number } | null {
        return null;
    }
}

export const audioService = AudioService.getInstance();
