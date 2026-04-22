import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/core/db';
import { usePresentationStore } from '../presentationStore';
import { toast } from '@/core/utils/toast';

vi.mock('@/core/db', () => ({
  db: {
    presentationFiles: {
      get: vi.fn(),
      update: vi.fn(),
      add: vi.fn(),
    },
  },
}));

vi.mock('@/core/utils/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('createNestedPresentationSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePresentationStore.setState({
      activePresentationId: 'active-p',
      activePresentation: { id: 'active-p', slides: [] } as any,
      activeServiceId: 'service-1',
    });
  });

  it('addPresentationToTimeline should use presentation directly if it belongs to the same service', async () => {
    const existingPres = {
      id: 'existing-p',
      name: 'Existing Pres',
      serviceId: 'service-1',
      slides: [],
      updatedAt: new Date(),
    };

    (db.presentationFiles.get as any).mockResolvedValue(existingPres);
    
    // Mock updatePresentationSlides
    const updatePresentationSlidesSpy = vi.spyOn(usePresentationStore.getState(), 'updatePresentationSlides');

    await usePresentationStore.getState().addPresentationToTimeline('existing-p');

    // Should NOT call createPresentation
    // Actually createPresentation is a store action, we can't easily spy on it if it's called via get().createPresentation
    // But we can check if it was used in updatePresentationSlides
    
    expect(updatePresentationSlidesSpy).toHaveBeenCalledWith('active-p', expect.arrayContaining([
      expect.objectContaining({
        masterPresentationId: 'existing-p',
        linkedPresentationId: undefined,
      })
    ]));
    
    expect(toast.success).toHaveBeenCalled();
  });

  it('addPresentationToTimeline should create a snapshot if it belongs to a different service (or library)', async () => {
    const libraryPres = {
      id: 'lib-p',
      name: 'Library Pres',
      serviceId: 'other-service',
      slides: [],
      updatedAt: new Date(),
    };

    (db.presentationFiles.get as any).mockResolvedValue(libraryPres);
    
    // Mock createPresentation to return a new ID
    const createPresentationSpy = vi.spyOn(usePresentationStore.getState(), 'createPresentation').mockResolvedValue('snapshot-p');
    const updatePresentationSlidesSpy = vi.spyOn(usePresentationStore.getState(), 'updatePresentationSlides').mockResolvedValue(undefined);

    await usePresentationStore.getState().addPresentationToTimeline('lib-p');

    expect(createPresentationSpy).toHaveBeenCalledWith('Library Pres (Snapshot)', { serviceId: 'service-1' });
    
    expect(updatePresentationSlidesSpy).toHaveBeenCalledWith('snapshot-p', expect.any(Array));
    expect(updatePresentationSlidesSpy).toHaveBeenCalledWith('active-p', expect.arrayContaining([
      expect.objectContaining({
        masterPresentationId: 'snapshot-p',
        linkedPresentationId: 'lib-p',
      })
    ]));
  });

  it('addPresentationToTimeline should prevent recursive nesting', async () => {
    await usePresentationStore.getState().addPresentationToTimeline('active-p');
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Cannot add a presentation to itself'));
  });
});
