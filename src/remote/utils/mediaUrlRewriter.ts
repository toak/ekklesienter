/**
 * Utility to specifically target and rewrite media URLs in the slide payload
 */
export const rewriteMediaUrls = (payload: Record<string, unknown> | null | undefined): Record<string, unknown> | null | undefined => {
    if (!payload || typeof payload !== 'object') return payload;

    // Clone the top level payload
    const newPayload = { ...payload } as Record<string, unknown>;
    const mediaProxyHost = `${window.location.protocol}//${window.location.hostname}:3211`;

    // Helper to process a single media-carrying object (image/video metadata)
    const processMediaObject = (mediaObj: Record<string, unknown> | null | undefined): Record<string, unknown> | null | undefined => {
        if (!mediaObj || typeof mediaObj !== 'object') return mediaObj;
        const mid = mediaObj.id || mediaObj.mediaId;
        if (mid && (mediaObj.isFromDb || (mediaObj.url && (String(mediaObj.url).startsWith('blob:') || String(mediaObj.url).startsWith('file:'))))) {
            return {
                ...mediaObj,
                url: `${mediaProxyHost}/media/${mid}`,
                isFromDb: false
            };
        }
        return mediaObj;
    };

    // Helper to process an array of StyleLayers OR a legacy BackgroundSettings object
    const processLayers = (layers: unknown): unknown => {
        if (!layers) return layers;
        if (Array.isArray(layers)) {
            return layers.map(layer => {
                if (layer && typeof layer === 'object') {
                    const newLayer = { ...layer } as Record<string, unknown>;
                    if (newLayer.image) newLayer.image = processMediaObject(newLayer.image as Record<string, unknown>);
                    if (newLayer.video) newLayer.video = processMediaObject(newLayer.video as Record<string, unknown>);
                    return newLayer;
                }
                return layer;
            });
        }
        // Handle legacy BackgroundSettings object
        if (typeof layers === 'object') {
            const newBg = { ...layers } as Record<string, unknown>;
            if (newBg.image) newBg.image = processMediaObject(newBg.image as Record<string, unknown>);
            if (newBg.video) newBg.video = processMediaObject(newBg.video as Record<string, unknown>);
            return newBg;
        }
        return layers;
    };

    // 1. Rewrite Slide Data (including canvas items and background override)
    if (newPayload.slideData && typeof newPayload.slideData === 'object') {
        const sd = { ...newPayload.slideData } as Record<string, unknown>;

        // Handle Background Override
        if (sd.backgroundOverride) {
            sd.backgroundOverride = processLayers(sd.backgroundOverride);
        }

        // Handle Canvas Items (Elements)
        const content = sd.content as Record<string, unknown> | undefined;
        if (content && Array.isArray(content.canvasItems)) {
            sd.content = {
                ...content,
                canvasItems: content.canvasItems.map((item) => {
                    if (item && typeof item === 'object') {
                        const newItem = { ...item } as Record<string, unknown>;
                        if (newItem.fills) newItem.fills = processLayers(newItem.fills);
                        if (newItem.strokes) newItem.strokes = processLayers(newItem.strokes);
                        if (newItem.type === 'image' || newItem.type === 'video') {
                            if (newItem.isFromDb || (newItem.url && (String(newItem.url).startsWith('blob:') || String(newItem.url).startsWith('file:')))) {
                                newItem.url = `${mediaProxyHost}/media/${newItem.id || newItem.mediaId}`;
                                newItem.isFromDb = false;
                            }
                        }
                        return newItem;
                    }
                    return item;
                })
            };
        }

        // Handle Video Poster Frames
        const videoSettings = sd.videoSettings as Record<string, unknown> | undefined;
        if (videoSettings?.mediaId) {
            sd.videoSettings = {
                ...videoSettings,
                posterUrl: `${mediaProxyHost}/media/${videoSettings.mediaId}`
            };
        }
        newPayload.slideData = sd;
    }

    // 2. Helper to process a whole slide object (used for neighbors)
    const processSlideData = (slide: unknown): unknown => {
        if (!slide || typeof slide !== 'object') return slide;
        const sd = { ...slide } as Record<string, unknown>;
        if (sd.backgroundOverride) sd.backgroundOverride = processLayers(sd.backgroundOverride);
        
        const content = sd.content as Record<string, unknown> | undefined;
        if (content && Array.isArray(content.canvasItems)) {
            sd.content = {
                ...content,
                canvasItems: content.canvasItems.map((item) => {
                    if (item && typeof item === 'object') {
                        const newItem = { ...item } as Record<string, unknown>;
                        if (newItem.fills) newItem.fills = processLayers(newItem.fills);
                        if (newItem.strokes) newItem.strokes = processLayers(newItem.strokes);
                        if (newItem.type === 'image' || newItem.type === 'video') {
                            if (newItem.isFromDb || (newItem.url && (String(newItem.url).startsWith('blob:') || String(newItem.url).startsWith('file:')))) {
                                newItem.url = `${mediaProxyHost}/media/${newItem.id || newItem.mediaId}`;
                                newItem.isFromDb = false;
                            }
                        }
                        return newItem;
                    }
                    return item;
                })
            };
        }
        return sd;
    };

    if (newPayload.prevSlideData) newPayload.prevSlideData = processSlideData(newPayload.prevSlideData);
    if (newPayload.nextSlideData) newPayload.nextSlideData = processSlideData(newPayload.nextSlideData);
    if (Array.isArray(newPayload.timelineSlides)) {
        newPayload.timelineSlides = newPayload.timelineSlides.map(processSlideData);
    }

    // 3. Rewrite Template Backgrounds
    const slideTemplate = newPayload.slideTemplate as Record<string, unknown> | undefined;
    if (slideTemplate?.background) {
        const st = { ...slideTemplate } as Record<string, unknown>;
        st.background = processLayers(st.background);
        newPayload.slideTemplate = st;
    }

    return newPayload;
};
