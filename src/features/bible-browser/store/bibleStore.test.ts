import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBibleStore } from './bibleStore';
import { db } from '@/core/db';
import { LiveSyncService } from '@/core/services/liveSyncService';

vi.mock('@/core/db', () => ({
  db: {
    verses: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      and: vi.fn().mockReturnThis(),
      first: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/core/services/liveSyncService', () => ({
  LiveSyncService: {
    showVerse: vi.fn(),
    showMultiVerses: vi.fn(),
  },
}));

describe('useBibleStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBibleStore.setState({
      activeVerse: null,
      liveVerse: null,
      projectorIsLive: false,
      selectedVerses: [],
    });
  });

  it('navigateNext with preferLiveAnchor should advance liveVerse independently', async () => {
    const v1 = { id: 1, translationId: 'KJV', bookId: 'GEN', chapter: 1, verseNumber: 1, text: 'v1' };
    const v2 = { id: 2, translationId: 'KJV', bookId: 'GEN', chapter: 1, verseNumber: 2, text: 'v2' };
    const v3 = { id: 3, translationId: 'KJV', bookId: 'GEN', chapter: 1, verseNumber: 3, text: 'v3' };

    (db.verses as any).first.mockResolvedValue(v2);

    useBibleStore.setState({
      activeVerse: v3, // PC at v3
      liveVerse: v1,   // Remote at v1
      projectorIsLive: true,
    });

    await useBibleStore.getState().navigateNext(false, true);

    const state = useBibleStore.getState();
    expect(state.liveVerse?.id).toBe(2);
    expect(state.activeVerse?.id).toBe(3); // Active remains at v3
    expect(LiveSyncService.showVerse).toHaveBeenCalledWith(v2, null);
  });

  it('navigateNext with preferLiveAnchor should advance both if synced', async () => {
    const v1 = { id: 1, translationId: 'KJV', bookId: 'GEN', chapter: 1, verseNumber: 1, text: 'v1' };
    const v2 = { id: 2, translationId: 'KJV', bookId: 'GEN', chapter: 1, verseNumber: 2, text: 'v2' };

    (db.verses as any).first.mockResolvedValue(v2);

    useBibleStore.setState({
      activeVerse: v1,
      liveVerse: v1,
      projectorIsLive: true,
    });

    await useBibleStore.getState().navigateNext(false, true);

    const state = useBibleStore.getState();
    expect(state.liveVerse?.id).toBe(2);
    expect(state.activeVerse?.id).toBe(2); // Follows to v2
  });

  it('clickVerse should update liveVerse if projector is live', () => {
    const v1 = { id: 1, translationId: 'KJV', bookId: 'GEN', chapter: 1, verseNumber: 1, text: 'v1' };
    useBibleStore.setState({ projectorIsLive: true });
    
    useBibleStore.getState().clickVerse(v1);
    
    expect(useBibleStore.getState().liveVerse?.id).toBe(1);
    expect(LiveSyncService.showVerse).toHaveBeenCalledWith(v1, null);
  });
});
