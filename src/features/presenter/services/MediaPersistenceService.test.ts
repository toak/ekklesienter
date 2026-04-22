import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaPersistenceService } from './MediaPersistenceService';
import { db } from '@/core/db';
import { readLocalFileSafe, sha256 } from './mediaPackingUtils';

// Mock DB
vi.mock('@/core/db', () => ({
  db: {
    mediaPool: {
        get: vi.fn(),
        add: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        where: vi.fn().mockReturnValue({
            equals: vi.fn().mockReturnValue({
                filter: vi.fn().mockReturnValue({
                    toArray: vi.fn().mockResolvedValue([]),
                }),
                first: vi.fn().mockResolvedValue(null),
                toArray: vi.fn().mockResolvedValue([]),
            }),
        }),
        count: vi.fn().mockResolvedValue(0),
    },
    backgrounds: {
        get: vi.fn(),
        add: vi.fn(),
    }
  },
}));

// Mock utils
vi.mock('./mediaPackingUtils', () => ({
  readLocalFileSafe: vi.fn(),
  sha256: vi.fn(),
}));

// Mock mediaCache
vi.mock('@/core/utils/mediaCache', () => ({
  mediaCache: {
    put: vi.fn(),
  },
}));

describe('MediaPersistenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('importMediaBlob', () => {
    it('should deduplicate based on hash and return existing ID', async () => {
      const mockBlob = new Blob(['test-content'], { type: 'image/png' });
      const mockHash = 'mock-hash-123';
      (sha256 as any).mockResolvedValue(mockHash);
      
      // First call - item doesn't exist
      (db.mediaPool.get as any).mockResolvedValue(null);
      
      const id1 = await MediaPersistenceService.importMediaBlob(mockBlob, 'test.png', 'image');
      
      expect(id1).toBe(mockHash);
      expect(db.mediaPool.add).toHaveBeenCalledWith(expect.objectContaining({
        id: mockHash,
        name: 'test.png'
      }));

      // Second call - item exists
      (db.mediaPool.get as any).mockResolvedValue({ id: mockHash, data: mockBlob });
      
      const id2 = await MediaPersistenceService.importMediaBlob(mockBlob, 'test.png', 'image');
      
      expect(id2).toBe(mockHash);
      expect(db.mediaPool.add).toHaveBeenCalledTimes(1); // Not called a second time
    });

    it('should update binId if moving to a different bin', async () => {
        const mockBlob = new Blob(['test-content'], { type: 'image/png' });
        const mockHash = 'mock-hash-123';
        (sha256 as any).mockResolvedValue(mockHash);
        
        (db.mediaPool.get as any).mockResolvedValue({ 
            id: mockHash, 
            data: mockBlob,
            binId: 'old-bin' 
        });
        
        await MediaPersistenceService.importMediaBlob(mockBlob, 'test.png', 'image', { binId: 'new-bin' });
        
        expect(db.mediaPool.update).toHaveBeenCalledWith(mockHash, { binId: 'new-bin' });
    });
  });

  describe('ensureMediaInDb', () => {
    it('should cleanup placeholder UUID when importing from path', async () => {
        const mockHash = 'real-hash-id';
        const uuidId = 'random-uuid-123';
        const mockItem = {
            id: uuidId,
            path: '/path/to/file.png',
            type: 'image' as const,
        };

        (readLocalFileSafe as any).mockResolvedValue(new Blob(['content']));
        (sha256 as any).mockResolvedValue(mockHash);
        (db.mediaPool.get as any).mockResolvedValueOnce(null); // not in db by uuid
        (db.mediaPool.get as any).mockResolvedValueOnce(null); // not in db by hash initially
        
        const resultId = await MediaPersistenceService.ensureMediaInDb(mockItem as any);
        
        expect(resultId).toBe(mockHash);
        expect(db.mediaPool.delete).toHaveBeenCalledWith(uuidId);
    });
  });
});
