import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EktService } from './ektService';
import { db } from '../../../core/db';
import JSZip from 'jszip';

// Mock DB
vi.mock('../../../core/db', () => ({
  db: {
    serviceFiles: {
      get: vi.fn(),
      update: vi.fn(),
    },
    presentationFiles: {
      get: vi.fn(),
      update: vi.fn(),
    },
    backgrounds: {
      get: vi.fn(),
      add: vi.fn(),
    },
    logos: {
      get: vi.fn(),
    },
    mediaBins: {
      toArray: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
      add: vi.fn(),
    },
    mediaPool: {
      toArray: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
      add: vi.fn(),
    },
    transaction: vi.fn((mode, tables, cb) => cb()),
  },
}));

// Mock JSZip
vi.mock('jszip', () => {
  const mockJSZip = vi.fn().mockImplementation(function (this: any) {
    return {
      file: vi.fn(),
      folder: vi.fn().mockReturnThis(),
      generateAsync: vi.fn().mockResolvedValue(new Blob(['test-zip'], { type: 'application/zip' })),
    };
  });
  (mockJSZip as any).loadAsync = vi.fn();
  return {
    default: mockJSZip,
  };
});

// Mock Services
vi.mock('./ThumbnailService', () => ({
  ThumbnailService: {
    generate: vi.fn().mockResolvedValue(new Blob(['thumb'], { type: 'image/png' })),
  },
}));

vi.mock('./ektpService', () => ({
  EktpService: {
    getMediaIds: vi.fn().mockResolvedValue([]),
    pack: vi.fn().mockResolvedValue({ 
      blob: new Blob(['test-ektp'], { type: 'application/zip' }), 
      manifest: {} 
    }),
    unpack: vi.fn().mockResolvedValue('new-pres-id'),
  },
}));

describe('EktService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('pack', () => {
    it('should pack a service into a zip blob', async () => {
      const mockService = {
        id: 's1',
        name: 'Test Service',
        presentationIds: ['p1'],
        masterPresentationId: 'p1',
      };
      const mockPresentation = {
        id: 'p1',
        slides: [],
      };

      (db.serviceFiles.get as any).mockResolvedValue(mockService);
      (db.presentationFiles.get as any).mockResolvedValue(mockPresentation);

      const blob = await EktService.pack('s1');

      expect(blob).toBeInstanceOf(Blob);
      expect(db.serviceFiles.get).toHaveBeenCalledWith('s1');
      expect(JSZip).toHaveBeenCalled();
    });

    it('should throw error if service not found', async () => {
      (db.serviceFiles.get as any).mockResolvedValue(null);
      await expect(EktService.pack('non-existent')).rejects.toThrow('Service non-existent not found');
    });
  });

  describe('prepareImport', () => {
    it('should prepare import for a valid .ekt zip', async () => {
      const mockManifest = JSON.stringify({
        id: 's1',
        name: 'Test',
        presentationIds: ['p1'],
        masterPresentationId: 'p1',
      });

      // Mock JSZip.loadAsync
      const mockZip = {
        file: vi.fn().mockImplementation((path) => {
          if (path === 'service.json') return { async: vi.fn().mockResolvedValue(mockManifest) };
          return null;
        }),
        folder: vi.fn().mockReturnThis(),
        files: { 'service.json': {} },
      };
      (JSZip.loadAsync as any).mockResolvedValue(mockZip);

      const blob = new Blob(['fake-zip'], { type: 'application/zip' });
      const pending = await EktService.prepareImport(blob);

      expect(pending.newServiceId).toBeDefined();
      expect(JSZip.loadAsync).toHaveBeenCalledWith(blob);
    });

    it('should throw error for invalid zip', async () => {
      (JSZip.loadAsync as any).mockRejectedValue(new Error('Invalid zip'));
      const blob = new Blob(['invalid'], { type: 'text/plain' });
      await expect(EktService.prepareImport(blob)).rejects.toThrow('Not a valid ZIP archive');
    });
  });
});
