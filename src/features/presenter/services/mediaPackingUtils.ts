import { db } from '@/core/db';
import { IStyleLayer, ISlide, ICanvasSlide, ITimerSlide, SlideType, IAudioScope } from '@/core/types';

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
 */
export async function sha256(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Safely reads a local file using Electron IPC if available.
 */
export async function readLocalFileSafe(path: string): Promise<Blob | null> {
    try {
        if (window.electron?.ipcRenderer) {
            const stats = await window.electron.ipcRenderer.invoke('read-file-data', path);
            if (stats && stats.data) return new Blob([stats.data]);
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

    const addRef = (id: string | undefined, role: string, originalName: string = id || '', extra: any = {}) => {
        if (id && !mediaMap.has(id)) {
            mediaMap.set(id, { role, originalName, ...extra });
        }
    };

    const collectFromLayers = (layers: IStyleLayer[], layerRole: string) => {
        for (const layer of layers) {
            if (layer.image?.id && layer.image.isFromDb) {
                addRef(layer.image.id, `${layerRole}_image`);
            }
            if (layer.video?.id && layer.video.isFromDb) {
                addRef(layer.video.id, `${layerRole}_video`);
            }
        }
    };

    // 1. Base Layers
    collectFromLayers(baseLayers, 'base');

    // 2. Presentation Audio Scopes
    for (const scope of presentationAudioScopes) {
        if (scope.fileId) addRef(scope.fileId, 'audio_scope', scope.fileName || scope.fileId);
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
                    
                    if (item.type === 'text' && item.text?.fontFamily) {
                        fontFamilies.add(item.text.fontFamily);
                    }
                }
            }
            if (s.audioScopes) {
                for (const scope of s.audioScopes) {
                    if (scope.fileId) addRef(scope.fileId, 'slide_audio', scope.fileName || scope.fileId);
                }
            }
            if (s.timerSettings?.playlist) {
                for (const mid of s.timerSettings.playlist) addRef(mid, 'timer_audio');
            }
        } else if (type === 'timer') {
            const s = slide as ITimerSlide;
            if (s.playlist) {
                for (const mid of s.playlist) addRef(mid, 'timer_audio');
            }
        } else if (type === 'verse') {
            const s = slide as any; // Future-proofing if backgroundOverride is added to Verse
            if (s.backgroundOverride) collectFromLayers(s.backgroundOverride, 'background');
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

    return null;
}

/**
 * Recursively replaces IDs in an object using a provided map.
 */
export function patchMediaIds(target: any, map: Map<string, string>) {
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
                    const replacement = map.get(target[key]);
                    if (replacement) {
                        if (key === 'url' && target[key].startsWith('blob:')) continue;
                        target[key] = replacement;
                    }
                }
            } else if (key === 'image' || key === 'video') {
                const mediaObj = target[key];
                if (mediaObj && typeof mediaObj === 'object' && typeof mediaObj.id === 'string') {
                    const replacement = map.get(mediaObj.id);
                    if (replacement) {
                        mediaObj.id = replacement;
                        mediaObj.isFromDb = true;
                    }
                    patchMediaIds(mediaObj, map);
                }
            } else if (typeof target[key] === 'object') {
                patchMediaIds(target[key], map);
            }
        }
    }
}
