import { useMemo } from 'react';
import { ISlide, ICanvasSlide, INestedSlide, IPresentationFile } from '@/core/types';

interface UseTimelineLayoutProps {
    slides: ISlide[];
    activePresentationId: string | null;
    presentationsMap: Map<string, IPresentationFile>;
}

export interface TimelineItem {
    id: string;
    width: number;
    x: number;
    type: 'slide' | 'nested' | 'edit-button' | 'spacer';
    slide?: ISlide;
    presentationId?: string;
    parentSlideId?: string;
}

const TILE_WIDTH = 128;
const TILE_GAP = 12; // gap-3
const NESTED_TILE_WIDTH = 96;
const NESTED_TILE_GAP = 10;
const NESTED_SIDE_PADDING = 20;
const EDIT_BUTTON_WIDTH = 40;

/**
 * Hook to compute the flattened visual timeline including nested presentations.
 */
export const useTimelineLayout = ({
    slides,
    activePresentationId,
    presentationsMap
}: UseTimelineLayoutProps) => {
    const visualTimeline = useMemo(() => {
        const items: TimelineItem[] = [];
        let currentX = 0;

        for (const slide of slides) {
            // Top level slide
            items.push({
                id: slide.id,
                width: TILE_WIDTH,
                x: currentX,
                type: 'slide',
                slide,
                presentationId: activePresentationId || undefined
            });

            const nextTopLevelX = currentX + TILE_WIDTH + TILE_GAP;

            // If expanded, insert its children
            const masterPresId = slide.type === 'normal' 
                ? (slide as ICanvasSlide).masterPresentationId 
                : (slide.type === 'nested' ? (slide as INestedSlide).presentationId : undefined);
            
            if (slide.isExpanded && masterPresId) {
                const nested = presentationsMap.get(masterPresId);
                let nestedTrackX = nextTopLevelX;

                if (nested) {
                    // Start border/accent
                    items.push({
                        id: `spacer-start-${slide.id}`,
                        width: NESTED_SIDE_PADDING,
                        x: nestedTrackX,
                        type: 'spacer',
                        parentSlideId: slide.id
                    });
                    nestedTrackX += NESTED_SIDE_PADDING;

                    nested.slides.forEach((ns, idx) => {
                        items.push({
                            id: ns.id,
                            width: NESTED_TILE_WIDTH,
                            x: nestedTrackX,
                            type: 'nested',
                            slide: ns,
                            presentationId: nested.id,
                            parentSlideId: slide.id
                        });
                        nestedTrackX += NESTED_TILE_WIDTH;

                        // Gap between nested slides
                        if (idx < nested.slides.length - 1) {
                            items.push({
                                id: `spacer-ns-${ns.id}`,
                                width: NESTED_TILE_GAP,
                                x: nestedTrackX,
                                type: 'spacer',
                                parentSlideId: slide.id
                            });
                            nestedTrackX += NESTED_TILE_GAP;
                        }
                    });

                    // Gap before Edit button + Edit button
                    items.push({
                        id: `spacer-mid-${slide.id}`,
                        width: NESTED_TILE_GAP,
                        x: nestedTrackX,
                        type: 'spacer',
                        parentSlideId: slide.id
                    });
                    nestedTrackX += NESTED_TILE_GAP;

                    items.push({
                        id: `edit-${slide.id}`,
                        width: EDIT_BUTTON_WIDTH,
                        x: nestedTrackX,
                        type: 'edit-button',
                        parentSlideId: slide.id
                    });
                    nestedTrackX += EDIT_BUTTON_WIDTH;

                    // End accent/padding
                    items.push({
                        id: `spacer-end-${slide.id}`,
                        width: NESTED_SIDE_PADDING,
                        x: nestedTrackX,
                        type: 'spacer',
                        parentSlideId: slide.id
                    });
                    nestedTrackX += NESTED_SIDE_PADDING;
                }

                // The next top-level item starts after the NestedPresentationTile
                currentX = nestedTrackX + TILE_GAP;
            } else {
                currentX = nextTopLevelX;
            }
        }
        return items;
    }, [slides, presentationsMap, activePresentationId]);

    return { visualTimeline };
};
