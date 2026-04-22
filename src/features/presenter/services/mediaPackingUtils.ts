import { db } from '@/core/db';
import { IStyleLayer, ISlide, ICanvasSlide, ITimerSlide, SlideType, IAudioScope } from '@/core/types';
import { IpcService } from '@/core/services/IpcService';

export interface MediaManifest {
    [contentHash: string]: {
        filename: string;
        mimeType: string;
        originalName: string;
        size: number;
        role?: string;
        fontFamily?: string;
        fontWeight?: string | number;
    }
}

/**
 * SHA-256 content-based hashing for blobs.
 * Optmized for large files: If file > 20MB, hashes a sample (head + mid + tail + size)
 * for near-instant deduplication without reading the whole file into RAM.
 */
export async function sha256(blob: Blob): Promise<string> {
    const SIZE_LIMIT = 20 * 1024 * 1024; // 20MB
    const SAMPLE_SIZE = 1 * 1024 * 1024; // 1MB
    
    let content: Blob;
    if (blob.size <= SIZE_LIMIT) {
        content = blob;
    } else {
        // Sampled hashing for massive files (Video/Large Audio)
        const head = blob.slice(0, SAMPLE_SIZE);
        const mid = blob.slice(Math.floor(blob.size / 2), Math.floor(blob.size / 2) + SAMPLE_SIZE);
        const tail = blob.slice(blob.size - SAMPLE_SIZE);
        const meta = new Blob([
            blob.size.toString(), 
            blob.type,
            // Include a middle-of-the-way sample too for safety
            blob.slice(Math.floor(blob.size / 4), Math.floor(blob.size / 4) + SAMPLE_SIZE / 2)
        ]);
        content = new Blob([head, mid, tail, meta]);
    }
    
    const arrayBuffer = await content.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extracts a filesystem path from a local-resource:// or file:/// URL.
 */
export function extractPathFromLocalResource(url: string): string | null {
    if (!url) return null;
    if (url.startsWith('local-resource://localhost/')) {
        return decodeURIComponent(url.replace('local-resource://localhost/', '/'));
    }
    if (url.startsWith('file:///')) {
        return decodeURIComponent(url.replace('file:///', '/'));
    }
    if (url.startsWith('/') || /^[a-zA-Z]:\\/.test(url)) {
        return url;
    }
    return null;
}

/**
 * Safely reads a local file using Electron IPC or streaming fetch if possible.
 */
export async function readLocalFileSafe(path: string): Promise<Blob | null> {
    try {
        // PREFER FETCH: Streaming via protocol is MUCH faster than IPC Buffer transfer
        // especially for large audio/video files (no struct-clone overhead).
        if (IpcService.isElectron()) {
            const normalizedPath = path.replace(/\\/g, '/');
            const url = `local-resource://localhost${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;
            
            try {
                const response = await fetch(url);
                if (response.ok) return await response.blob();
            } catch (fetchError) {
                console.warn(`Fetch via protocol failed for ${path}, falling back to IPC:`, fetchError);
            }

            // Fallback for edge cases where protocol might not be ready or fail
            const stats = await IpcService.invoke<{ data: Uint8Array } | null>('read-file-data', path);
            if (stats && stats.data) return new Blob([new Uint8Array(stats.data)]);
        }
    } catch (e) {
        console.warn(`Failed to read local media file: ${path}`, e);
    }
    return null;
}

/**
 * Canonical MIME to Extension mapping.
 */
export function mimeToExt(mime: string): string {
    const sub = mime.split('/')[1]?.split('+')[0] || '';
    if (sub.includes('png')) return 'png';
    if (sub.includes('jpeg') || sub.includes('jpg')) return 'jpg';
    if (sub.includes('webp')) return 'webp';
    if (sub.includes('mp4')) return 'mp4';
    if (sub.includes('webm')) return 'webm';
    if (sub.includes('svg')) return 'svg';
    if (sub.includes('mpeg') || sub.includes('mp3')) return 'mp3';
    if (sub.includes('ogg')) return 'ogg';
    if (sub.includes('wav')) return 'wav';
    if (sub.includes('woff2')) return 'woff2';
    if (sub.includes('woff')) return 'woff';
    if (sub.includes('ttf')) return 'ttf';
    return 'bin';
}

/**
 * Canonical Extension to MIME mapping.
 */
export function extToMime(ext: string): string {
    const e = ext.toLowerCase();
    if (e === 'png') return 'image/png';
    if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
    if (e === 'webp') return 'image/webp';
    if (e === 'svg') return 'image/svg+xml';
    if (e === 'mp4') return 'video/mp4';
    if (e === 'webm') return 'video/webm';
    if (e === 'mpeg' || e === 'mp3') return 'audio/mpeg';
    if (e === 'ogg') return 'audio/ogg';
    if (e === 'wav') return 'audio/wav';
    if (e === 'woff2') return 'font/woff2';
    if (e === 'woff') return 'font/woff';
    if (e === 'ttf') return 'font/ttf';
    return 'application/octet-stream';
}

/**
 * Finds a custom font in the media pool.
 * Deprecated: Used single-pass font loading in collectMediaRefs instead.
 */
export async function findFontMedia(fontFamily: string, fontWeight?: string | number) {
    const items = await db.mediaPool
        .filter(item => item.name === fontFamily || item.name.startsWith(fontFamily))
        .toArray();
    return items[0];
}

/**
 * Collects all media and font references from a set of slides and optional base layers.
 */
export async function collectMediaRefs(
    slides: ISlide[], 
    baseLayers: IStyleLayer[] = [],
    presentationAudioScopes: IAudioScope[] = []
): Promise<Map<string, { role: string; originalName: string; fontFamily?: string; fontWeight?: string | number }>> {
    const mediaMap = new Map<string, { role: string; originalName: string; fontFamily?: string; fontWeight?: string | number }>();

    const addRef = (id: string | undefined, role: string, originalName: string = id || '', extra: Record<string, any> = {}) => {
        if (id && !mediaMap.has(id)) {
            mediaMap.set(id, { role, originalName, ...extra });
        }
    };

    const collectFromLayers = (layers: IStyleLayer[], layerRole: string) => {
        for (const layer of layers) {
            // Always collect media with a valid ID — isFromDb is no longer a gate.
            // This ensures backgrounds and canvas element images are packed regardless
            // of whether the flag was set by the original code path.
            if (layer.image?.id) {
                const name = (layer.image as { name?: string }).name || layer.image.id;
                addRef(layer.image.id, `${layerRole}_image`, name);
            } else if (layer.image?.url) {
                const path = extractPathFromLocalResource(layer.image.url);
                if (path) addRef(path, `${layerRole}_image_linked`, path);
            }

            if (layer.video?.id) {
                const name = (layer.video as { name?: string }).name || layer.video.id;
                addRef(layer.video.id, `${layerRole}_video`, name);
            } else if (layer.video?.url) {
                const path = extractPathFromLocalResource(layer.video.url);
                if (path) addRef(path, `${layerRole}_video_linked`, path);
            }
        }
    };

    // 1. Base Layers
    collectFromLayers(baseLayers, 'base');

    // 2. Presentation Audio Scopes
    for (const scope of presentationAudioScopes) {
        if (scope.fileId) {
            const h = extractPathFromLocalResource(scope.fileId) || scope.fileId;
            addRef(h, 'audio_scope', scope.fileName || scope.fileId);
        }
    }

    // 3. Slides & Font Gathering
    const fontFamilies = new Set<string>();

    for (const slide of slides) {
        const type = slide.type || 'normal';

        if (type === 'normal') {
            const s = slide as ICanvasSlide;
            if (s.backgroundOverride) collectFromLayers(s.backgroundOverride, 'background');
            
            if (s.content && s.content.canvasItems) {
                for (const item of s.content.canvasItems) {
                    if (item.fills) collectFromLayers(item.fills, 'item_fill');
                    if (item.strokes) collectFromLayers(item.strokes, 'item_stroke');

                    if (item.type === 'image' && item.image?.id) {
                        const img = item.image;
                        addRef(img.id, 'item_image', img.name || img.id);
                    } else if (item.type === 'video' && item.video?.id) {
                        const vid = item.video;
                        addRef(vid.id, 'item_video', vid.name || vid.id);
                    }

                    if (item.type === 'text' && item.text) {
                        if (item.text.fontFamily) fontFamilies.add(item.text.fontFamily);
                        if (item.text.textFills) collectFromLayers(item.text.textFills, 'text_fill');
                        if (item.text.textStrokes) collectFromLayers(item.text.textStrokes, 'text_stroke');
                    }
                }
            }
            if (s.audioScopes) {
                for (const scope of s.audioScopes) {
                    if (scope.fileId) {
                        const h = extractPathFromLocalResource(scope.fileId) || scope.fileId;
                        addRef(h, 'slide_audio', scope.fileName || scope.fileId);
                    }
                }
            }
            if (s.timerSettings?.playlist) {
                for (const mid of s.timerSettings.playlist) {
                    const h = extractPathFromLocalResource(mid) || mid;
                    addRef(h, 'timer_audio');
                }
            }
        } else if (type === 'timer') {
            const s = slide as ITimerSlide;
            if (s.playlist) {
                for (const mid of s.playlist) {
                    const h = extractPathFromLocalResource(mid) || mid;
                    addRef(h, 'timer_audio');
                }
            }
        } else if (type === 'verse') {
            const s = slide as unknown as ICanvasSlide; // Verses use canvas layout
            if (s.backgroundOverride) collectFromLayers(s.backgroundOverride, 'background');
        } else if (type === 'video') {
            const s = slide as any; // Legacy video slides are loosely typed
            if (s.backgroundOverride) collectFromLayers(s.backgroundOverride, 'background');
            if (s.videoSettings?.mediaId) {
                const id = extractPathFromLocalResource(s.videoSettings.mediaId) || s.videoSettings.mediaId;
                addRef(id, 'video_slide_media', `Slide Video: ${s.name || s.id}`);
            }
        }
    }

    // 4. Batch load fonts
    const fontNames = Array.from(fontFamilies);
    const fontItems = new Map<string, any>();
    
    if (fontNames.length > 0) {
        await db.mediaPool.each(item => {
            for (const family of fontNames) {
                if (!fontItems.has(family) && (item.name === family || item.name.startsWith(family))) {
                    fontItems.set(family, item);
                }
            }
        });
    }

    // Add collected fonts to media map
    for (const slide of slides) {
        if (slide.type === 'normal') {
            const s = slide as ICanvasSlide;
            if (s.content?.canvasItems) {
                for (const item of s.content.canvasItems) {
                    if (item.type === 'text' && item.text?.fontFamily) {
                        const font = fontItems.get(item.text.fontFamily);
                        if (font) {
                            addRef(font.id, 'font', font.name, {
                                fontFamily: item.text.fontFamily,
                                fontWeight: item.text.fontWeight
                            });
                        }
                    }
                }
            }
        }
    }

    return mediaMap;
}

/**
 * Fetches a media blob from backgrounds, logos, or mediaPool.
 */
export async function getMediaBlob(localId: string): Promise<{ blob: Blob; name: string } | null> {
    const bg = await db.backgrounds.get(localId);
    if (bg) return { blob: bg.data, name: bg.name };

    const logo = await db.logos.get(localId);
    if (logo) return { blob: logo.data, name: logo.name };

    const mediaItem = await db.mediaPool.get(localId);
    if (mediaItem) {
        const blob = mediaItem.data || await readLocalFileSafe(mediaItem.path);
        if (blob) return { blob, name: mediaItem.name };
    }

    // Try treating localId as a path or URL
    const path = extractPathFromLocalResource(localId);
    if (path) {
        const blob = await readLocalFileSafe(path);
        if (blob) {
            const name = path.split(/[/\\]/).pop() || 'Untitled';
            return { blob, name };
        }
    }

    return null;
}

/**
 * Recursively replaces IDs in an object using a provided map.
 */
export function patchMediaIds(target: unknown, map: Map<string, string>) {
    if (!target || typeof target !== 'object') return;

    if (Array.isArray(target)) {
        for (let i = 0; i < target.length; i++) {
            if (typeof target[i] === 'string') {
                const replacement = map.get(target[i]);
                if (replacement) target[i] = replacement;
            } else {
                patchMediaIds(target[i], map);
            }
        }
    } else {
        for (const key of Object.keys(target)) {
            if (key === 'fileId' || key === 'url') {
                if (typeof target[key] === 'string') {
                    // Try exact match first
                    let replacement = map.get(target[key]);
                    
                    // Fallback: Try normalized path if it's a local URL
                    if (!replacement) {
                        const path = extractPathFromLocalResource(target[key]);
                        if (path) replacement = map.get(path);
                    }

                    if (replacement) {
                        if (key === 'url' && target[key].startsWith('blob:')) continue;
                        target[key] = replacement;
                    }
                }
            } else if (key === 'image' || key === 'video') {
                const mediaObj = target[key];
                if (mediaObj && typeof mediaObj === 'object') {
                    // Patch both ID and URL for robust remapping of linked files
                    if (typeof mediaObj.id === 'string') {
                        let replacement = map.get(mediaObj.id);
                        if (!replacement) {
                            const path = extractPathFromLocalResource(mediaObj.id);
                            if (path) replacement = map.get(path);
                        }
                        if (replacement) {
                            mediaObj.id = replacement;
                            mediaObj.isFromDb = true;
                        }
                    }
                    if (typeof mediaObj.url === 'string') {
                        let replacement = map.get(mediaObj.url);
                        if (!replacement) {
                            const path = extractPathFromLocalResource(mediaObj.url);
                            if (path) replacement = map.get(path);
                        }
                        if (replacement) {
                            if (!mediaObj.id) mediaObj.id = replacement; // FIX: Ensure ID exists for DB linkage
                            mediaObj.url = replacement;
                            mediaObj.isFromDb = true;
                        }
                    }
                    patchMediaIds(mediaObj, map);
                }
            } else if (key === 'textFills' || key === 'textStrokes') {
                if (Array.isArray(target[key])) {
                    patchMediaIds(target[key], map);
                }
            } else if (typeof target[key] === 'object') {
                patchMediaIds(target[key], map);
            }
        }
    }
}
