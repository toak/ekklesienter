import { describe, it, expect } from 'vitest';
import { ThumbnailService } from './ThumbnailService';

describe('ThumbnailService', () => {
    it('should define generate thumbnail helpers', () => {
        expect(ThumbnailService.generate).toBeDefined();
    });
});
