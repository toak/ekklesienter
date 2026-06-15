import { describe, it, expect } from 'vitest';
import { migrateBackgroundToLayers } from './styleMigration';

describe('styleMigration', () => {
    it('should preserve and migrate backward compatible designs', () => {
        const legacyBg = { type: 'color', color: '#ff0000' } as any;
        const layers = migrateBackgroundToLayers(legacyBg);
        expect(layers).toHaveLength(1);
        expect(layers[0].color).toBe('#ff0000');
    });
});
