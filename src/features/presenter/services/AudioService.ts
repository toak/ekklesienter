import { IAudioScope, ISlide, ICanvasSlide } from '@/core/types';
import { generateWaveformPoints } from '@/core/utils/audioUtils';
import { db } from '@/core/db';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';
import { extractPathFromLocalResource } from './mediaPackingUtils';
import { IpcService } from '@/core/services/IpcService';

class AudioService {
    private static instance: AudioService;
    private audioContext: AudioContext | null = null;
    public targetScopeId: string | null = null;

    // Playback state
    public activeTracks: Map<string, {
        source: AudioBufferSourceNode | MediaElementAudioSourceNode;
        gain: GainNode;
        scope: IAudioScope;
        mediaElement?: HTMLAudioElement;
        startTime: number;
        startOffset: number;
        isPaused?: boolean;
        /** When true, the onended callback will NOT remove this track from activeTracks. */
        suppressEndedCleanup?: boolean;
    }> = new Map();
    
    // Timer management for delayed tracks
    private pendingDelays: Map<string, NodeJS.Timeout> = new Map();

    private syncingScopeId: string | null = null;

    // File cache with LRU limits to prevent memory bloat
    private bufferCache: Map<string, AudioBuffer> = new Map();
    private waveformCache: Map<string, number[]> = new Map();
    private blobUrlCache: Map<string, string> = new Map();
    
    // Limits
    private readonly MAX_BUFFER_CACHE = 10;
    private readonly MAX_WAVEFORM_CACHE = 50;
    private readonly MAX_BLOB_CACHE = 20;

    private loadingPromises: Map<string, Promise<AudioBuffer | null>> = new Map();
    private durationPromises: Map<string, Promise<number>> = new Map();
    private durationCache: Map<string, number> = new Map();
    private resolvePromises: Map<string, Promise<string>> = new Map();

    private constructor() { }

    public static getInstance(): AudioService {
        if (!AudioService.instance) {
            AudioService.instance = new AudioService();
        }
        return AudioService.instance;
    }

    private async ensureContext() {
        if (!this.audioContext) {
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            this.audioContext = new AudioContextClass();
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume().catch(e => console.warn('🔊 [AudioService] Failed to resume context:', e));
        }
        return this.audioContext;
    }

    /**
     * Resumes the audio context manually (e.g. on user interaction).
     */
    public async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume().catch(e => console.warn('🔊 [AudioService] Failed manual resume:', e));
        }
    }

    private resolveUrl(fileId: string): string {
        return getLocalResourceUrl(fileId);
    }

    private async resolveEffectiveUrl(fileId: string): Promise<string> {
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

    public async getWaveform(fileId: string, samples: number = 100): Promise<number[] | null> {
        if (!fileId) return null;
        const cacheKey = `${fileId}:${samples}`;
        const cached = this.waveformCache.get(cacheKey);
        if (cached) return cached;

        // AI Fix: If duration or size is already known to be long, don't even try
        // Size check first as it is the safest/fastest
        const stats = await this.getFileStats(fileId);
        if (stats && stats.size > 50 * 1024 * 1024) return null;

        const duration = await this.getDuration(fileId);
        if (duration <= 0 || duration > 300) return null;

        const buffer = await this.loadAudio(fileId);
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

    private async loadAudio(url: string): Promise<AudioBuffer | null> {
        if (!url) return null;
        let resolvedUrl = await this.resolveEffectiveUrl(url);
        if (!resolvedUrl) return null;

        const cached = this.bufferCache.get(resolvedUrl);
        if (cached) return cached;

        // AI Fix: Concurrency Guard
        const existingPromise = this.loadingPromises.get(resolvedUrl);
        if (existingPromise) return existingPromise;

        const loadPromise = (async () => {
            try {
                // AI Fix: Metadata-first check BEFORE fetch
                // We allow up to 300s (5 minutes) to be decoded into memory.
                // This is needed for waveforms. Anything longer is discarded to save RAM.
                const duration = await this.getDuration(url);
                if (duration <= 0 || duration > 300) {
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
                const ctx = await this.ensureContext();

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

    public async sync(
        liveSlideId: string | null,
        slides: ISlide[],
        presentationScopes: IAudioScope[],
        parentSlideId?: string | null,
        parentSlides?: ISlide[],
        parentScopes?: IAudioScope[]
    ) {
        if (!this.audioContext) {
            await this.ensureContext();
        }
        
        if (!liveSlideId) {
            this.targetScopeId = null;
            this.stopAll(0.5);
            return;
        }

        // 1. Try to find scope in current presentation (nested)
        let activeScope = this.findActiveScope(liveSlideId, slides, presentationScopes);
        
        // 2. Fallback: If nested and no local scope, try to find scope in parent presentation
        if (!activeScope && parentSlideId && parentSlides && parentSlides.length > 0) {
            activeScope = this.findActiveScope(parentSlideId, parentSlides, parentScopes);
        }

        if (!activeScope) {
            this.targetScopeId = null;
            this.clearPendingDelays();
            this.stopAll(1.0);
            return;
        }

        const currentTrack = this.activeTracks.get(activeScope.id);
        const hasPendingDelay = this.pendingDelays.has(activeScope.id);
        
        this.targetScopeId = activeScope.id;

        // If we switched to a NEW scope (or no scope), clear all other delays
        this.clearPendingDelays(activeScope.id);

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

        // Concurrency Guard: Don't start the same scope multiple times in parallel
        if (this.syncingScopeId === activeScope.id) {
            return;
        }

        // Handle Strategy for NEW scope
        const strategy = activeScope.strategy || 'auto';
        
        try {
            this.syncingScopeId = activeScope.id;

            if (strategy === 'manual') {
                await this.playScope(activeScope, { startPaused: true });
            } else if (strategy === 'delay') {
                if (hasPendingDelay) return; // Already waiting
                
                const delaySec = activeScope.delaySeconds || 1;
                
                const timer = setTimeout(() => {
                    this.pendingDelays.delete(activeScope.id);
                    this.playScope(activeScope);
                }, delaySec * 1000);
                
                this.pendingDelays.set(activeScope.id, timer);
            } else {
                // Default: Auto-play
                await this.playScope(activeScope);
            }
        } finally {
            if (this.syncingScopeId === activeScope.id) {
                this.syncingScopeId = null;
            }
        }
    }

    private clearPendingDelays(exceptScopeId?: string) {
        if (exceptScopeId) {
            for (const [id, timer] of this.pendingDelays.entries()) {
                if (id !== exceptScopeId) {
                    clearTimeout(timer);
                    this.pendingDelays.delete(id);
                }
            }
        } else {
            this.pendingDelays.forEach(clearTimeout);
            this.pendingDelays.clear();
        }
    }

    private findActiveScope(slideId: string, slides: ISlide[], presentationScopes?: IAudioScope[]): IAudioScope | null {
        const slideIndex = slides.findIndex(s => s.id === slideId);
        if (slideIndex === -1) return null;

        const allScopes: IAudioScope[] = [];
        
        // 1. Root-level/Relational Scopes
        if (presentationScopes && Array.isArray(presentationScopes)) {
            allScopes.push(...presentationScopes);
        }

        // 2. Slide-level Scopes (Nesting & Legacy)
        slides.forEach(s => { 
            // Broaden to all slide types (e.g. verse slides can have audio too)
            const cs = s as ICanvasSlide & { audio?: { path: string, filename?: string } };
            
            // 2a. Relational scopes stored in slide
            if (cs.audioScopes && Array.isArray(cs.audioScopes)) {
                allScopes.push(...cs.audioScopes); 
            }

            // 2b. Legacy "Attached Audio" (s.audio)
            if (cs.audio?.path) {
                // Convert to a virtual scope that covers just this slide
                allScopes.push({
                    id: `legacy-${s.id}`,
                    presentationId: '',
                    startSlideId: s.id,
                    endSlideId: s.id,
                    fileId: cs.audio.path,
                    fileName: cs.audio.filename || cs.audio.path.split('/').pop(),
                    volume: 1,
                    loop: false
                });
            }
        });

        for (const scope of allScopes) {
            const startIndex = slides.findIndex(s => s.id === scope.startSlideId);
            const endIndex = slides.findIndex(s => s.id === scope.endSlideId);
            
            // Safety: If startIndex found but endIndex missing (legacy/partial data), treat as single slide
            const resolvedEndIndex = (startIndex !== -1 && endIndex === -1) ? startIndex : endIndex;

            if (startIndex !== -1 && resolvedEndIndex !== -1 && slideIndex >= startIndex && slideIndex <= resolvedEndIndex) {
                return scope;
            }
        }

        // 3. FEATURE FALLBACK: Virtual Scopes (e.g. Timer Audio)
        // If we have an active track that identifies as a feature scope, and it's for this slide, return it
        const timerPrefix = `timer-audio-${slideId}`;
        const activeTrack = Array.from(this.activeTracks.keys()).find(k => k === timerPrefix);
        if (activeTrack) {
            const track = this.activeTracks.get(activeTrack);
            if (track) return track.scope;
        }

        return null;
    }

    public async playScope(scope: IAudioScope, options?: { startPaused?: boolean }): Promise<{ duration: number; startTime: number } | null> {
        if (!scope?.fileId) return null;

        const ctx = await this.ensureContext();
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

        // NEW GUARD: If this scope is already present, do NOT reset its start time or override its pause state.
        // This prevents the "stuck progress bar" and "auto-resume" issues during sync cycles.
        const existingTrack = this.activeTracks.get(scope.id);
        if (existingTrack && existingTrack.scope.fileId === scope.fileId) {
            // Keep the current state (playing or paused)
            existingTrack.scope = { ...scope };
            const duration = (existingTrack.source instanceof AudioBufferSourceNode && existingTrack.source.buffer) ? existingTrack.source.buffer.duration : (existingTrack.mediaElement?.duration || 0);
            return { duration, startTime: existingTrack.startTime };
        }

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
                
                if (duration === 0) {
                    audio = new Audio(resolvedUrl);
                    audio.crossOrigin = "anonymous";
                }
            } else {
                duration = buffer.duration;
            }
        }

        const now = ctx.currentTime;
        const fadeInTime = Math.max(0.01, scope.crossfadeSettings?.fadeInDuration ?? 1.0);
        const fadeOutTime = Math.max(0.01, scope.crossfadeSettings?.fadeOutDuration ?? 1.0);

        // Fade and cleanup previous — ALWAYS include previous instance of self if it exists
        // to prevent overlapping audio when restarting the same scope.
        const idsToFadeOut = Array.from(this.activeTracks.keys());
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
            if (!options?.startPaused) {
                audio.play().catch(e => console.error('AudioService: Playback failed', e));
            }
        } else {
            const bufSource = ctx.createBufferSource();
            if (buffer) {
                bufSource.buffer = buffer;
                
                if (scope.loop) {
                    bufSource.loop = true;
                    bufSource.loopStart = offset;
                    bufSource.loopEnd = scope.trimEnd || buffer.duration;
                } else {
                    bufSource.loop = false;
                }
                
                source = bufSource;
                const playDuration = (scope.trimEnd && scope.trimEnd > offset) ? (scope.trimEnd - offset) : buffer.duration - offset;
                
                if (!options?.startPaused) {
                    bufSource.start(now, offset, scope.loop ? undefined : Math.max(0, playDuration));
                }
            } else {
                // Should not happen, but for type safety
                source = bufSource;
            }
        }

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.001, now);
        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        const targetVolume = scope.isMuted ? 0.001 : (scope.volume ?? 1);
        gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, targetVolume), now + fadeInTime);

        // Handle end — only clean up if this source is still the "current" one
        // and the track hasn't been paused/seeking (suppressEndedCleanup).
        const onEnded = () => {
            const currentTrack = this.activeTracks.get(scope.id);
            if (currentTrack?.suppressEndedCleanup) return;
            if (scope.onEnded) scope.onEnded();
            if (currentTrack?.source === source) {
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
        this.activeTracks.set(scope.id, { 
            source, 
            gain: gainNode, 
            scope: { ...scope }, 
            mediaElement: audio,
            startTime: now,
            startOffset: offset,
            isPaused: options?.startPaused || false
        });

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
        this.clearPendingDelays();

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

    public getTrackProgress(scopeId: string): { currentTime: number; duration: number; isPlaying: boolean } | null {
        const track = this.activeTracks.get(scopeId);
        if (!track || !this.audioContext) return null;

        let currentTime = 0;
        let duration = 0;
        let isPlaying = false;

        const trimStart = track.scope.trimStart || 0;

        if (track.mediaElement) {
            currentTime = track.mediaElement.currentTime;
            duration = track.scope.trimEnd || track.mediaElement.duration || 0;
            isPlaying = !track.mediaElement.paused;
        } else if (track.source instanceof AudioBufferSourceNode && track.source.buffer) {
            duration = track.scope.trimEnd || track.source.buffer.duration || 0;
            isPlaying = !track.isPaused;
            if (!track.isPaused) {
                const speed = (track.scope as IAudioScope & { speed?: number }).speed ?? 1.0;
                const elapsed = (this.audioContext.currentTime - track.startTime) * speed;
                currentTime = track.startOffset + elapsed;
            } else {
                currentTime = track.startOffset;
            }
        }

        return { currentTime, duration, isPlaying };
    }

    /**
     * Helper for synchronization bridge
     */
    public isPlaying(scopeId: string): boolean {
        return this.getTrackProgress(scopeId)?.isPlaying ?? false;
    }

    /**
     * Helper for synchronization bridge
     */
    public getPosition(scopeId: string): { currentTime: number; duration: number } {
        const progress = this.getTrackProgress(scopeId);
        return { 
            currentTime: progress?.currentTime ?? 0, 
            duration: progress?.duration ?? 0 
        };
    }

    /**
     * Returns the underlying file ID for a scope
     */
    public getFileId(scopeId: string): string | undefined {
        return this.activeTracks.get(scopeId)?.scope?.[ 'fileId' ];
    }

    public playTrack(scopeId: string) {
        const track = this.activeTracks.get(scopeId);
        if (!track) return;
        
        if (track.mediaElement) {
            track.mediaElement.play().catch(() => {});
            track.isPaused = false;
        } else if (track.isPaused) {
            // BufferSourceNodes cannot be resumed; we must recreate.
            // Suppress onended from the old (stopped) source so it doesn't
            // delete the track entry and trigger sync() to start a duplicate.
            track.suppressEndedCleanup = true;
            // Disconnect old source to release resources
            try { track.source.disconnect(); } catch (_) {}
            this.activeTracks.delete(scopeId);
            this.playScope({ ...track.scope, trimStart: track.startOffset });
        }
    }

    public pauseTrack(scopeId: string) {
        const track = this.activeTracks.get(scopeId);
        if (!track) return;

        if (track.mediaElement) {
            track.mediaElement.pause();
            track.isPaused = true;
        } else {
            // Stop and record offset.
            // Set suppressEndedCleanup BEFORE calling source.stop() so the
            // synchronous onended callback doesn't delete the track entry.
            const progress = this.getTrackProgress(scopeId);
            if (progress) {
                track.startOffset = progress.currentTime;
                track.isPaused = true;
                track.suppressEndedCleanup = true;
                if (track.source instanceof AudioBufferSourceNode) {
                    try { track.source.stop(); } catch (_) {}
                    try { track.source.disconnect(); } catch (_) {}
                }
            }
        }
    }

    public seekTrack(scopeId: string, time: number) {
        const track = this.activeTracks.get(scopeId);
        if (!track) return;

        if (track.mediaElement) {
            track.mediaElement.currentTime = time;
        } else {
            // BufferSourceNodes can't seek — recreate from new offset.
            // Stop the old source and suppress its onended cleanup.
            track.suppressEndedCleanup = true;
            if (track.source instanceof AudioBufferSourceNode) {
                try { track.source.stop(); } catch (_) {}
            }
            try { track.source.disconnect(); } catch (_) {}
            this.activeTracks.delete(scopeId);
            this.playScope({ ...track.scope, trimStart: time });
        }
    }

    /**
     * Complete cleanup for AudioService.
     * Stops all tracks, clears caches and revokes all blob URLs.
     */
    public dispose() {
        this.stopAll(0);
        
        // Revoke all blob URLs
        this.blobUrlCache.forEach(url => {
            try { URL.revokeObjectURL(url); } catch (_) {}
        });
        
        this.blobUrlCache.clear();
        this.bufferCache.clear();
        this.waveformCache.clear();
        this.durationCache.clear();
        this.loadingPromises.clear();
        this.resolvePromises.clear();
        this.durationPromises.clear();
        
        console.log('🔊 [AudioService] Disposed and resources released.');
    }
}

export const audioService = AudioService.getInstance();
