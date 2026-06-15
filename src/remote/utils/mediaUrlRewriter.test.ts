import { describe, it, expect } from 'vitest';
import { rewriteMediaUrls } from './mediaUrlRewriter';

describe('mediaUrlRewriter utility', () => {
    it('should rewrite relative media paths safely', () => {
        const payload = {
            slideData: {
                backgroundOverride: [
                    {
                        image: { id: 'media-123', isFromDb: true, url: 'file://path/to/img.png' }
                    }
                ]
            }
        };
        const rewritten = rewriteMediaUrls(payload);
        const slideData = rewritten?.slideData as Record<string, unknown>;
        const backgroundOverride = slideData?.backgroundOverride as Array<Record<string, unknown>>;
        const bgLayer = backgroundOverride?.[0];
        const image = bgLayer?.image as Record<string, unknown>;
        expect(image?.url).toContain('/media/media-123');
    });
});
