import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EktmpService } from './ektmpService';
import { db } from '@/core/db';
import JSZip from 'jszip';

// Mock DB
vi.mock('@/core/db', () => ({
  db: {
    templates: {
      get: vi.fn(),
      add: vi.fn(),
      toArray: vi.fn().mockResolvedValue([]),
    },
    blocks: {
      get: vi.fn(),
      add: vi.fn(),
    },
    backgrounds: {
      get: vi.fn(),
      add: vi.fn(),
    },
    logos: {
      get: vi.fn(),
      add: vi.fn(),
    },
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
  // @ts-ignore
  mockJSZip.loadAsync = vi.fn();
  return {
    default: mockJSZip,
  };
});

// Mock Services
vi.mock('./ThumbnailService', () => ({
  ThumbnailService: {
    generateFromTemplate: vi.fn().mockResolvedValue(new Blob(['thumb'], { type: 'image/png' })),
  },
}));

describe('EktmpService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('pack', () => {
    it('should pack a template into a .ektmp blob', async () => {
      const mockTemplate: any = {
        id: 't1',
        name: 'Test Template',
        background: [],
        category: 'b1',
      };
      (db.templates.get as any).mockResolvedValue(mockTemplate);
      (db.blocks.get as any).mockResolvedValue({ id: 'b1', name: 'Block 1' });

      const blob = await EktmpService.pack('t1');

      expect(blob).toBeInstanceOf(Blob);
      expect(db.templates.get).toHaveBeenCalledWith('t1');
      expect(JSZip).toHaveBeenCalled();
    });
  });

  describe('unpack', () => {
    it('should unpack .ektmp file correctly', async () => {
      const mockManifestJson = JSON.stringify({
        id: 't1',
        name: 'Test Template',
        background: [],
      });

      const mockZip = {
        file: vi.fn().mockImplementation((path) => {
          if (path === 'manifest.json') return { async: vi.fn().mockResolvedValue(mockManifestJson) };
          return null;
        }),
        folder: vi.fn().mockReturnThis(),
        files: { 'manifest.json': {} },
      };
      (JSZip.loadAsync as any).mockResolvedValue(mockZip);

      const blob = new Blob(['fake-zip'], { type: 'application/zip' });
      const result = await EktmpService.unpack(blob);

      expect(result.id).toContain('imported-');
      expect(result.name).toBe('Test Template');
      expect(JSZip.loadAsync).toHaveBeenCalledWith(blob);
    });
  });
});
