import { describe, it, expect, vi } from 'vitest';
import { getUniquePresentationName, getUniqueServiceName } from './nameUtils';
import { db } from '@/core/db';

vi.mock('@/core/db', () => ({
  db: {
    presentationFiles: {
      toArray: vi.fn(),
    },
    serviceFiles: {
      toArray: vi.fn(),
    },
  },
}));

describe('nameUtils', () => {
    it('should return original name if no duplicate exists', async () => {
        (db.presentationFiles.toArray as any).mockResolvedValue([
            { name: 'First Presentation' }
        ]);

        const uniqueName = await getUniquePresentationName('Second Presentation');
        expect(uniqueName).toBe('Second Presentation');
    });

    it('should append (1) if a duplicate exists', async () => {
        (db.presentationFiles.toArray as any).mockResolvedValue([
            { name: 'First Presentation' }
        ]);

        const uniqueName = await getUniquePresentationName('First Presentation');
        expect(uniqueName).toBe('First Presentation (1)');
    });

    it('should increment suffix if multiple duplicates exist', async () => {
        (db.presentationFiles.toArray as any).mockResolvedValue([
            { name: 'First Presentation' },
            { name: 'First Presentation (1)' },
            { name: 'First Presentation (2)' },
        ]);

        const uniqueName = await getUniquePresentationName('First Presentation (1)');
        expect(uniqueName).toBe('First Presentation (3)');
    });

    it('should handle unique names for services', async () => {
        (db.serviceFiles.toArray as any).mockResolvedValue([
            { name: 'Worship Service' }
        ]);

        const uniqueName = await getUniqueServiceName('Worship Service');
        expect(uniqueName).toBe('Worship Service (1)');
    });
});
