import { describe, it, expect } from 'vitest';
import { GraceLibExportService } from './GraceLibExportService';

describe('GraceLibExportService', () => {
    it('should construct secure lib manifests', () => {
        expect(GraceLibExportService.packEntireGraceLib).toBeDefined();
    });
});

