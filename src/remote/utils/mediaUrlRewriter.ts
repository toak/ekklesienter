/**
 * Utility to specifically target and rewrite media URLs in the slide payload
 */
export const rewriteMediaUrls = (payload: any): any => {
    if (!payload || typeof payload !== 'object') return payload;

    // Clone the top level payload
    const newPayload = { ...payload };
    const mediaProxyHost = `${window.location.protocol}//${window.location.hostname}:3211`;

    // Helper to process a single media-carrying object (image/video metadata)
    const processMediaObject = (mediaObj: any) => {
        if (!mediaObj || typeof mediaObj !== 'object') return mediaObj;
        const mid = mediaObj.id || mediaObj.mediaId;
        if (mid && (mediaObj.isFromDb || (mediaObj.url && (mediaObj.url.startsWith('blob:') || mediaObj.url.startsWith('file:'))))) {
            return {
                ...mediaObj,
                url: `${mediaProxyHost}/media/${mid}`,
                isFromDb: false
            };
        }
        return mediaObj;
    };

    // Helper to process an array of StyleLayers OR a legacy BackgroundSettings object
    const processLayers = (layers: any) => {
        if (!layers) return layers;
        if (Array.isArray(layers)) {
            return layers.map(layer => {
                const newLayer = { ...layer };
                if (newLayer.image) newLayer.image = processMediaObject(newLayer.image);
                if (newLayer.video) newLayer.video = processMediaObject(newLayer.video);
                return newLayer;
            });
        }
        // Handle legacy BackgroundSettings object
        const newBg = { ...layers };
        if (newBg.image) newBg.image = processMediaObject(newBg.image);
        if (newBg.video) newBg.video = processMediaObject(newBg.video);
        return newBg;
    };

    // 1. Rewrite Slide Data (including canvas items and background override)
    if (newPayload.slideData) {
        const sd = { ...newPayload.slideData };

        // Handle Background Override
        if (sd.backgroundOverride) {
            sd.backgroundOverride = processLayers(sd.backgroundOverride);
        }

        // Handle Canvas Items (Elements)
        if (sd.content?.canvasItems) {
            sd.content = {
                ...sd.content,
                canvasItems: sd.content.canvasItems.map((item: any) => {
                    const newItem = { ...item };
                    if (newItem.fills) newItem.fills = processLayers(newItem.fills);
                    if (newItem.strokes) newItem.strokes = processLayers(newItem.strokes);
                    if (newItem.type === 'image' || newItem.type === 'video') {
                        if (newItem.isFromDb || (newItem.url && (newItem.url.startsWith('blob:') || newItem.url.startsWith('file:')))) {
                            newItem.url = `${mediaProxyHost}/media/${newItem.id || newItem.mediaId}`;
                            newItem.isFromDb = false;
                        }
                    }
                    return newItem;
                })
            };
        }

        // Handle Video Poster Frames
        if (sd.videoSettings?.mediaId) {
            sd.videoSettings = {
                ...sd.videoSettings,
                posterUrl: `${mediaProxyHost}/media/${sd.videoSettings.mediaId}`
            };
        }
        newPayload.slideData = sd;
    }

    // 2. Helper to process a whole slide object (used for neighbors)
    const processSlideData = (slide: any) => {
        if (!slide) return slide;
        let sd = { ...slide };
        if (sd.backgroundOverride) sd.backgroundOverride = processLayers(sd.backgroundOverride);
        if (sd.content?.canvasItems) {
            sd.content = {
                ...sd.content,
                canvasItems: sd.content.canvasItems.map((item: any) => {
                    const newItem = { ...item };
                    if (newItem.fills) newItem.fills = processLayers(newItem.fills);
                    if (newItem.strokes) newItem.strokes = processLayers(newItem.strokes);
                    if (newItem.type === 'image' || newItem.type === 'video') {
                        if (newItem.isFromDb || (newItem.url && (newItem.url.startsWith('blob:') || newItem.url.startsWith('file:')))) {
                            newItem.url = `${mediaProxyHost}/media/${newItem.id || newItem.mediaId}`;
                            newItem.isFromDb = false;
                        }
                    }
                    return newItem;
                })
            };
        }
        return sd;
    };

    if (newPayload.prevSlideData) newPayload.prevSlideData = processSlideData(newPayload.prevSlideData);
    if (newPayload.nextSlideData) newPayload.nextSlideData = processSlideData(newPayload.nextSlideData);

    // 3. Rewrite Template Backgrounds
    if (newPayload.slideTemplate?.background) {
        const st = { ...newPayload.slideTemplate };
        st.background = processLayers(st.background);
        newPayload.slideTemplate = st;
    }

    return newPayload;
};
