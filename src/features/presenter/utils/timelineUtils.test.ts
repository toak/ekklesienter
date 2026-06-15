import { describe, it, expect } from 'vitest';
import { findOverlappingScopes } from './timelineUtils';

describe('timelineUtils helpers', () => {
    it('should find overlapping scopes correctly', () => {
        const slideToIndexMap = new Map([['slide1', 0], ['slide2', 1]]);
        const visualTimeline = [
            {
                slide: {
                    type: 'normal',
                    audioScopes: [
                        { id: 'scope1', startSlideId: 'slide1', endSlideId: 'slide2' }
                    ]
                }
            }
        ];
        const overlapping = findOverlappingScopes(0, 1, visualTimeline as any, slideToIndexMap);
        expect(overlapping).toHaveLength(1);
        expect(overlapping[0].id).toBe('scope1');
    });
});
