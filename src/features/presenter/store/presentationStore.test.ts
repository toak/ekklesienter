import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePresentationStore } from './presentationStore';
import { db } from '@/core/db';

// Mock DB
vi.mock('@/core/db', () => ({
  db: {
    serviceFiles: {
      get: vi.fn(),
      update: vi.fn(),
      add: vi.fn(),
      orderBy: vi.fn().mockReturnThis(),
      reverse: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    },
    presentationFiles: {
      get: vi.fn(),
      update: vi.fn(),
      add: vi.fn(),
      orderBy: vi.fn().mockReturnThis(),
      reverse: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    },
    templates: {
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    presentationBins: {
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    transaction: vi.fn((mode, tables, cb) => cb()),
  },
}));

// Mock Services
vi.mock('../services/ektService', () => ({
  EktService: {
    save: vi.fn(),
    load: vi.fn(),
  },
}));

vi.mock('../services/ektpService', () => ({
  EktpService: {
    save: vi.fn(),
    load: vi.fn(),
  },
}));

describe('usePresentationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state if possible, or just re-import/re-create
    // Note: Zustand persist might keep state between tests if not handled
    usePresentationStore.setState({
      activeServiceId: null,
      activePresentationId: null,
      selectedPresentationId: null,
      previewSlideId: null,
      liveSlideId: null,
      activeService: null,
      activePresentation: null,
      selectedPresentation: null,
      selectedSlideIds: [],
    });
  });

  it('should have initial state', () => {
    const state = usePresentationStore.getState();
    expect(state.activeServiceId).toBeNull();
    expect(state.activePresentationId).toBeNull();
    expect(state.previewSlideId).toBeNull();
  });

  it('setActiveService should load service and master presentation', async () => {
    const mockService = {
      id: 'service-1',
      masterPresentationId: 'master-1',
      name: 'Test Service',
    };
    const mockPresentation = {
      id: 'master-1',
      slides: [{ id: 'slide-1' }],
    };

    (db.serviceFiles.get as any).mockResolvedValue(mockService);
    (db.presentationFiles.get as any).mockResolvedValue(mockPresentation);

    await usePresentationStore.getState().setActiveService('service-1');

    expect(db.serviceFiles.get).toHaveBeenCalledWith('service-1');
    expect(usePresentationStore.getState().activeServiceId).toBe('service-1');
    expect(usePresentationStore.getState().activePresentationId).toBe('master-1');
    expect(usePresentationStore.getState().previewSlideId).toBe('slide-1');
  });

  it('setPreviewSlide should update previewSlideId', async () => {
    await usePresentationStore.getState().setPreviewSlide('slide-2', 'pres-1');
    expect(usePresentationStore.getState().previewSlideId).toBe('slide-2');
    expect(usePresentationStore.getState().selectedPresentationId).toBe('pres-1');
  });

  it('toggleSlideSelection should handle multi-selection', () => {
    usePresentationStore.setState({
      activePresentation: { id: 'p1', slides: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] } as any
    });

    usePresentationStore.getState().toggleSlideSelection('s1');
    expect(usePresentationStore.getState().selectedSlideIds).toEqual(['s1']);

    usePresentationStore.getState().toggleSlideSelection('s2', true);
    expect(usePresentationStore.getState().selectedSlideIds).toEqual(['s1', 's2']);

    usePresentationStore.getState().toggleSlideSelection('s1', true);
    expect(usePresentationStore.getState().selectedSlideIds).toEqual(['s2']);
  });

  it('clearSelection should clear selectedSlideIds', () => {
    usePresentationStore.setState({ selectedSlideIds: ['s1', 's2'] });
    usePresentationStore.getState().clearSelection();
    expect(usePresentationStore.getState().selectedSlideIds).toEqual([]);
  });
});
