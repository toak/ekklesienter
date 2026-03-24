import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EktpService } from './ektpService';
import { collectMediaRefs, patchMediaIds } from './mediaPackingUtils';
import { db } from '@/core/db';
import JSZip from 'jszip';

// Mock DB
vi.mock('@/core/db', () => ({
  db: {
    presentationFiles: {
      get: vi.fn(),
      update: vi.fn(),
      add: vi.fn(),
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      first: vi.fn(),
    },
    backgrounds: {
      get: vi.fn(),
      add: vi.fn(),
    },
    logos: {
      get: vi.fn(),
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
    generate: vi.fn().mockResolvedValue(new Blob(['thumb'], { type: 'image/png' })),
  },
}));

// Mock FileReader
const mockFileReader = {
  readAsDataURL: vi.fn(),
  onloadend: null as any,
  result: 'data:image/png;base64,test',
};
vi.stubGlobal('FileReader', vi.fn(() => {
  setTimeout(() => {
    if (mockFileReader.onloadend) mockFileReader.onloadend();
  }, 0);
  return mockFileReader;
}));

describe('EktpService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('collectMediaRefs', () => {
    it('should collect media IDs from slides', async () => {
      const presentation: any = {
        slides: [
          {
            type: 'normal',
            backgroundOverride: [{ image: { id: 'bg1', isFromDb: true } }],
            content: {
              canvasItems: [
                { fills: [{ image: { id: 'bg2', isFromDb: true } }] }
              ]
            },
            audioScopes: [{ fileId: 'audio1' }],
          },
          {
            type: 'timer',
            playlist: ['media1']
          }
        ]
      };

      const refs = await collectMediaRefs(presentation.slides, [], presentation.audioScopes);
      expect(refs.has('bg1')).toBe(true);
      expect(refs.has('bg2')).toBe(true);
      expect(refs.has('audio1')).toBe(true);
      expect(refs.has('media1')).toBe(true);
      expect(refs.size).toBe(4);
    });
  });

  describe('patchMediaIds', () => {
    it('should set isFromDb flag when patching media IDs', () => {

      const target: any = {
        backgroundOverride: [{ image: { id: 'old-id', url: '' } }],
        content: { canvasItems: [{ fills: [{ video: { id: 'old-video' } }] }] }
      };
      const map = new Map([['old-id', 'new-hash'], ['old-video', 'new-video-hash']]);
      patchMediaIds(target, map);
      expect(target.backgroundOverride[0].image.id).toBe('new-hash');
      expect(target.backgroundOverride[0].image.isFromDb).toBe(true);
      expect(target.content.canvasItems[0].fills[0].video.id).toBe('new-video-hash');
      expect(target.content.canvasItems[0].fills[0].video.isFromDb).toBe(true);
    });
  });

  describe('pack', () => {
    it('should pack presentation and media into zip', async () => {
      const mockPresentation: any = {
        id: 'p1',
        slides: [],
      };
      (db.presentationFiles.get as any).mockResolvedValue(mockPresentation);

      const { blob } = await EktpService.pack('p1');

      expect(blob).toBeInstanceOf(Blob);
      expect(db.presentationFiles.get).toHaveBeenCalledWith('p1');
      expect(JSZip).toHaveBeenCalled();
    });
  });

  describe('unpack', () => {
    it('should unpack .ektp file correctly', async () => {
      const mockPresentationJson = JSON.stringify({
        id: 'p1',
        slides: [],
      });

      const mockZip = {
        file: vi.fn().mockImplementation((path) => {
          if (path === 'presentation.json') return { async: vi.fn().mockResolvedValue(mockPresentationJson) };
          return null;
        }),
        folder: vi.fn().mockReturnThis(),
        files: { 'presentation.json': {} },
      };
      (JSZip.loadAsync as any).mockResolvedValue(mockZip);

      const blob = new Blob(['fake-zip'], { type: 'application/zip' });
      const result = await EktpService.unpack(blob);

      expect(typeof result).toBe('string');
      expect(JSZip.loadAsync).toHaveBeenCalledWith(blob);
    });
  });
});
