import { IAudioScope, ISlide } from '@/core/types';

/**
 * Finds all audio scopes that overlap with the given start and end slide indices.
 */
export function findOverlappingScopes(
    targetStartIdx: number,
    targetEndIdx: number,
    visualTimeline: Array<{ slide?: ISlide }>,
    slideToIndexMap: Map<string, number>
): IAudioScope[] {
    const overlapping: IAudioScope[] = [];
    const seenIds = new Set<string>();

    visualTimeline.forEach((item) => {
        if (item.slide?.type === 'normal' && item.slide.audioScopes) {
            item.slide.audioScopes.forEach((scope) => {
                if (seenIds.has(scope.id)) return;

                const startIdx = slideToIndexMap.get(scope.startSlideId);
                const endIdx = slideToIndexMap.get(scope.endSlideId);

                if (startIdx !== undefined && endIdx !== undefined) {
                    // Check for overlap: [start1, end1] overlaps [start2, end2]
                    // if (start1 <= end2 && start2 <= end1)
                    if (targetStartIdx <= endIdx && startIdx <= targetEndIdx) {
                        overlapping.push(scope);
                        seenIds.add(scope.id);
                    }
                }
            });
        }
    });

    return overlapping;
}
