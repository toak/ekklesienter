import { db } from '@/core/db';
import { ipcService } from '@/core/services/ipcService';
import { getBookName } from '@/core/data/bookData';

let lastUpdateId = 0;

/**
 * Service for synchronizing application state with the remote controller.
 * Handles complex payload construction, recursive slide resolution, and async media status.
 */
export const remoteSyncService = {
  /**
   * Constructs and sends the application state to the remote controller.
   */
  async updateRemoteState(params: {
    appMode: string;
    activeVerse: any;
    activePresentation: any;
    selectedPresentation: any;
    presentationStack: any[];
    projectorIsLive: boolean;
    liveSlideId: string | null;
    previewSlideId: string | null;
    lang: string;
    themeAccent: string;
    isPlaying: boolean;
    activeOverride: string | null;
    activeLogo: any;
    activeLogoUrl: string | null;
    settings: any;
  }) {
    if (!ipcService.isElectron()) return;
    
    const currentUpdateId = ++lastUpdateId;
    const { 
      appMode, activeVerse, activePresentation, selectedPresentation, 
      presentationStack, projectorIsLive, liveSlideId, previewSlideId, 
      lang, themeAccent, isPlaying, activeOverride, activeLogo, activeLogoUrl, settings 
    } = params;

    let isLive = projectorIsLive || !!liveSlideId;
    let slideTitle = 'Ready';
    let slidePreviewText = '';
    let slideData: any = null;
    let slideTemplate: any = null;
    let slideBlock: any = null;
    let prevSlideData: any = null;
    let nextSlideData: any = null;
    let timelineSlides: any[] = [];

    // 1. Resolve Audio Scopes for the current presentation context
    let timelineScopes: any[] = [];
    let timelineAudioPresId: string | null = null;
    try {
        const targetPres = selectedPresentation || activePresentation;
        if (targetPres?.id) {
            timelineAudioPresId = targetPres.id;
            timelineScopes = await db.audioScopes.where('presentationId').equals(targetPres.id).toArray();
            if (currentUpdateId !== lastUpdateId) return;
        }
    } catch (err) { }

    const checkHasAudio = (id: string, presContext: any) => {
        if (!presContext) return false;
        const slide = presContext.slides.find((s: any) => s.id === id);
        if (!slide) return false;
        if (slide.audio || (slide.audioScopes && slide.audioScopes.length > 0)) return true;
        
        if (timelineScopes.length > 0 && timelineAudioPresId === presContext.id) {
            const slideIndex = presContext.slides.findIndex((s: any) => s.id === id);
            return timelineScopes.some((scope: any) => {
                const startIndex = presContext.slides.findIndex((s: any) => s.id === scope.startSlideId);
                const endIndex = presContext.slides.findIndex((s: any) => s.id === scope.endSlideId);
                return slideIndex >= startIndex && slideIndex <= endIndex && startIndex !== -1 && endIndex !== -1;
            });
        }
        return false;
    };

    // 2. Resolve Main Slide Content
    if (appMode === 'scripture' && activeVerse) {
        slideTitle = `${getBookName(activeVerse.bookId, lang)} ${activeVerse.chapter}:${activeVerse.verseNumber}`;
        slidePreviewText = activeVerse.text;
        isLive = projectorIsLive;
    } else if (appMode === 'presentation' && activePresentation) {
        let targetId = liveSlideId || previewSlideId;
        let currentPres = activePresentation;
        if (selectedPresentation) {
            if (!targetId || !activePresentation || selectedPresentation.slides.some((s: any) => s.id === targetId)) {
                currentPres = selectedPresentation;
            }
        }

        let slide = null;
        if (currentPres?.slides?.length > 0) {
            if (targetId) {
                slide = currentPres.slides.find((s: any) => s.id === targetId);
            }
            if (!slide) {
                slide = currentPres.slides[0];
                targetId = slide.id;
            }
        }
        
        if (slide) {
            slideData = slide;
            slideTitle = (slide as any).name || (slide as any).label || 'Presentation Slide';
            
            try {
                if (slide.templateId) slideTemplate = await db.templates.get(slide.templateId);
                if (slide.blockId) slideBlock = await db.blocks.get(slide.blockId);
                if (currentUpdateId !== lastUpdateId) return;

                // Attempt to resolve more specific name for video/media slides
                if (slideTitle === 'Presentation Slide') {
                    const canvasItems = (slide as any).content?.canvasItems || (slide as any).canvasItems;
                    const items = (slide as any).items;
                    const isVideo = (slide as any).type === 'video' || items?.some((i: any) => i.type === 'video') || canvasItems?.some((i: any) => i.type === 'video');
                    
                    if (isVideo) {
                        const mediaId = (slide as any).videoSettings?.mediaId || items?.find((i: any) => i.type === 'video')?.mediaId || canvasItems?.find((i: any) => i.type === 'video')?.mediaId;
                        if (mediaId) {
                            const mediaDoc = await db.mediaPool.get(mediaId);
                            if (currentUpdateId !== lastUpdateId) return;
                            if (mediaDoc?.name) slideTitle = mediaDoc.name;
                        }
                    }
                }
            } catch (e) { }
            
            const s = slide as any;
            let extractedText = (s.blocks?.[0]?.text as string) || (s.items?.[0]?.text as string);
            if (!extractedText && s.content?.canvasItems) {
                const firstTextItem = s.content.canvasItems.find((i: any) => i.type === 'text');
                if (firstTextItem?.text) extractedText = firstTextItem.text.content;
            }
            slidePreviewText = extractedText || '';
            if (!slidePreviewText) {
                const hasVideo = s.items?.some((i: any) => i.type === 'video') || s.content?.canvasItems?.some((i: any) => i.type === 'video') || s.type === 'video';
                if (hasVideo) slidePreviewText = '[ Video Slide ]';
                else slidePreviewText = '[ Slide Content ]';
            }

            if (liveSlideId && targetId === liveSlideId) isLive = true;

            // Internal helper for resolving nested/master slide references recursively
            const resolveNeighbor = async (sRef: any, dir: 'first' | 'last'): Promise<any> => {
                if (sRef.blockId !== 'master-presentation') return sRef;
                const mId = sRef.type === 'normal' ? sRef.masterPresentationId : (sRef.type === 'nested' ? sRef.presentationId : undefined);
                if (!mId) return sRef;
                const p = await db.presentationFiles.get(mId);
                if (currentUpdateId !== lastUpdateId) throw new Error('stale');
                if (p && p.slides.length > 0) return resolveNeighbor(dir === 'first' ? p.slides[0] : p.slides[p.slides.length-1], dir);
                return sRef;
            };

            try {
                const idx = currentPres.slides.findIndex((s: any) => s.id === targetId);
                
                // Resolve Previous Slide
                if (idx > 0) {
                    prevSlideData = await resolveNeighbor(currentPres.slides[idx - 1], 'last');
                } else if (presentationStack.length > 0) {
                    const last = presentationStack[presentationStack.length - 1];
                    const pPres = await db.presentationFiles.get(last.presentationId);
                    if (currentUpdateId === lastUpdateId && pPres) {
                        const pIdx = pPres.slides.findIndex((s: any) => s.id === last.parentNestedSlideId);
                        if (pIdx > 0) prevSlideData = await resolveNeighbor(pPres.slides[pIdx - 1], 'last');
                    }
                }

                // Resolve Next Slide
                if (idx < currentPres.slides.length - 1 && idx !== -1) {
                    nextSlideData = await resolveNeighbor(currentPres.slides[idx + 1], 'first');
                } else if (presentationStack.length > 0) {
                    const last = presentationStack[presentationStack.length - 1];
                    const pPres = await db.presentationFiles.get(last.presentationId);
                    if (currentUpdateId === lastUpdateId && pPres) {
                        const pIdx = pPres.slides.findIndex((s: any) => s.id === last.parentNestedSlideId);
                        if (pIdx !== -1 && pIdx < pPres.slides.length - 1) nextSlideData = await resolveNeighbor(pPres.slides[pIdx + 1], 'first');
                    }
                }
            } catch (err: any) {
                if (err.message === 'stale') return;
                console.error('[RemoteSync] Slide resolution error:', err);
            }
            
            // Populate timeline slides
            timelineSlides = currentPres.slides || [];
        }
    }

    // 3. Prepare Remote Assets (Logo)
    let remoteLogoUrl = activeLogoUrl;
    if (activeLogoUrl?.startsWith('blob:') || activeLogoUrl?.startsWith('file:')) {
        let host = 'localhost';
        let port = 3211;
        if (ipcService.isElectron()) {
            try {
                const info = await ipcService.invoke<{ ip: string; port: number } | null>('remote:get-info');
                if (info && info.ip && info.ip !== '127.0.0.1') {
                    host = info.ip;
                    port = info.port || 3211;
                }
            } catch (err) {
                console.error('[RemoteSync] Failed to resolve remote server info:', err);
            }
        }
        const protocol = window.location.protocol === 'file:' ? 'http:' : window.location.protocol;
        remoteLogoUrl = `${protocol}//${host}:${port}/media/${activeLogo.id}`;
    }

    // 4. Dispatch construction to IPC
    ipcService.send('remote:update-state', {
        active: isLive,
        slideTitle,
        slidePreviewText: slidePreviewText || (previewSlideId ? 'Selected' : 'No slide selected'),
        slideData, 
        slideTemplate, 
        slideBlock, 
        prevSlideData, 
        nextSlideData,
        timelineSlides,
        playing: isPlaying,
        activeOverride,
        activeLogoUrl: remoteLogoUrl,
        themeAccent, 
        lang,
        hasAudio: slideData ? checkHasAudio(slideData.id, selectedPresentation || activePresentation) : false,
        settings
    });
  }
};

/** @deprecated Use remoteSyncService instead. */
export const RemoteSyncService = remoteSyncService;
