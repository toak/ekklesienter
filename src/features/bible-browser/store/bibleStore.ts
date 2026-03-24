import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Verse } from '@/core/types';
import { db } from '@/core/db';
import { useHistoryStore } from '@/core/store/historyStore';
import { LiveSyncService } from '@/core/services/liveSyncService';

interface BibleStoreState {
  currentTranslationId: string;
  currentBookId: string;
  currentChapter: number;

  // What's shown on preview (updates on every click)
  activeVerse: Verse | null;

  // true = projector is currently showing a single verse (not multiverse, not blank)
  // When true, single-verse clicks also go to projector immediately
  projectorIsLive: boolean;

  // true = projector is showing committed multiverse
  isMultiVerseMode: boolean;

  secondTranslationId: string | null;

  // Highlighted verses (for multi-selection UI)
  selectedVerses: Verse[];
  lastClickedVerseId: number | null;

  // Actions
  setTranslation: (translationId: string) => void;
  setSecondTranslation: (translationId: string | null) => void;
  setBook: (bookId: string) => void;
  setChapter: (chapter: number) => void;

  // Called on single-verse click:
  // - Always updates preview
  // - Also updates projector if projectorIsLive && !isMultiVerseMode
  clickVerse: (verse: Verse) => void;

  // Called on Enter: commits current state to projector
  commitToProjector: () => void;

  // Direct commit (used by history panel, external callers)
  setActiveVerse: (verse: Verse, emitIpc?: boolean) => void;

  navigateNext: (detached?: boolean) => Promise<void>;
  navigatePrev: (detached?: boolean) => Promise<void>;
  updateVerseText: (verse: Verse, newText: string) => Promise<void>;

  // Multi-selection actions
  setSelectedVerses: (verses: Verse[]) => void;
  toggleVerseSelection: (verse: Verse) => void;
  selectVerseRange: (from: Verse, to: Verse, allVerses: Verse[]) => void;
  exitMultiVerseMode: () => void;
  setLastClickedVerseId: (id: number | null) => void;
}

export const useBibleStore = create<BibleStoreState>()(
  persist(
    (set, get) => ({
      currentTranslationId: 'KJV',
      currentBookId: 'GEN',
      currentChapter: 1,
      activeVerse: null,
      projectorIsLive: false,
      isMultiVerseMode: false,
      secondTranslationId: null,
      selectedVerses: [],
      lastClickedVerseId: null,

      setTranslation: (translationId) => set({ currentTranslationId: translationId }),
      setSecondTranslation: (translationId) => set({ secondTranslationId: translationId }),

      setBook: (bookId) => set({
        currentBookId: bookId,
        currentChapter: 1,
        selectedVerses: [],
        isMultiVerseMode: false,
        lastClickedVerseId: null,
      }),

      setChapter: (chapter) => set({
        currentChapter: chapter,
        selectedVerses: [],
        isMultiVerseMode: false,
        lastClickedVerseId: null,
      }),

      // Single-verse click
      clickVerse: (verse: Verse) => {
        const { projectorIsLive, isMultiVerseMode, secondTranslationId } = get();

        // Always update preview
        set({ activeVerse: verse, selectedVerses: [verse] });
        useHistoryStore.getState().addToHistory(verse);

        // Update projector immediately ONLY if projector is live in single-verse mode
        if (projectorIsLive && !isMultiVerseMode) {
          LiveSyncService.showVerse(verse, secondTranslationId);
        }
      },

      // Enter key — commits to projector regardless of current state
      commitToProjector: () => {
        const { selectedVerses, activeVerse, secondTranslationId } = get();

        if (selectedVerses.length >= 2) {
          set({ isMultiVerseMode: true, projectorIsLive: false });
          LiveSyncService.showMultiVerses(selectedVerses, secondTranslationId);
        } else if (activeVerse) {
          set({ isMultiVerseMode: false, projectorIsLive: true });
          LiveSyncService.showVerse(activeVerse, secondTranslationId);
        }
      },

      // Direct commit — history panel, external callers, always sends IPC
      setActiveVerse: (verse: Verse, emitIpc = true) => {
        set({
          activeVerse: verse,
          isMultiVerseMode: false,
          selectedVerses: [verse],
          projectorIsLive: emitIpc ? true : get().projectorIsLive,
        });
        useHistoryStore.getState().addToHistory(verse);
        if (emitIpc) {
          LiveSyncService.showVerse(verse, get().secondTranslationId);
        }
      },

      navigateNext: async (detached = false) => {
        const { activeVerse, secondTranslationId } = get();
        if (!activeVerse) return;
        const nextVerse = await db.verses
          .where('[translationId+bookId+chapter]')
          .equals([activeVerse.translationId, activeVerse.bookId, activeVerse.chapter])
          .and(v => v.verseNumber === activeVerse.verseNumber + 1)
          .first();
        if (nextVerse) {
          set({ activeVerse: nextVerse, isMultiVerseMode: false, selectedVerses: [nextVerse] });
          if (!detached) {
            set({ projectorIsLive: true });
            LiveSyncService.showVerse(nextVerse, secondTranslationId);
          }
        }
      },

      navigatePrev: async (detached = false) => {
        const { activeVerse, secondTranslationId } = get();
        if (!activeVerse) return;
        const prevVerse = await db.verses
          .where('[translationId+bookId+chapter]')
          .equals([activeVerse.translationId, activeVerse.bookId, activeVerse.chapter])
          .and(v => v.verseNumber === activeVerse.verseNumber - 1)
          .first();
        if (prevVerse) {
          set({ activeVerse: prevVerse, isMultiVerseMode: false, selectedVerses: [prevVerse] });
          if (!detached) {
            set({ projectorIsLive: true });
            LiveSyncService.showVerse(prevVerse, secondTranslationId);
          }
        }
      },

      updateVerseText: async (verse, newText) => {
        if (verse.id) {
          await db.verses.update(verse.id, { text: newText });
          const { activeVerse } = get();
          if (activeVerse && activeVerse.id === verse.id) {
            set({ activeVerse: { ...activeVerse, text: newText } });
          }
        }
      },

      setSelectedVerses: (verses) => {
        const sorted = [...verses].sort((a, b) => a.verseNumber - b.verseNumber);
        set({ selectedVerses: sorted });
        if (sorted.length === 1) {
          set({ activeVerse: sorted[0] });
        }
      },

      toggleVerseSelection: (verse) => {
        const { selectedVerses } = get();
        const isSelected = selectedVerses.some(v => v.id === verse.id);
        const newSelected = isSelected
          ? selectedVerses.filter(v => v.id !== verse.id)
          : [...selectedVerses, verse].sort((a, b) => a.verseNumber - b.verseNumber);
        set({ selectedVerses: newSelected });
        if (newSelected.length === 1) {
          set({ activeVerse: newSelected[0] });
        }
      },

      selectVerseRange: (from, to, allVerses) => {
        const start = Math.min(from.verseNumber, to.verseNumber);
        const end = Math.max(from.verseNumber, to.verseNumber);
        const range = allVerses
          .filter(v => v.verseNumber >= start && v.verseNumber <= end)
          .sort((a, b) => a.verseNumber - b.verseNumber);
        set({ selectedVerses: range });
        if (range.length === 1) {
          set({ activeVerse: range[0] });
        }
      },

      exitMultiVerseMode: () => {
        const { activeVerse, secondTranslationId } = get();
        set({
          isMultiVerseMode: false,
          projectorIsLive: !!activeVerse,
          selectedVerses: activeVerse ? [activeVerse] : [],
          lastClickedVerseId: null,
        });
        if (activeVerse) {
          LiveSyncService.showVerse(activeVerse, secondTranslationId);
        }
      },

      setLastClickedVerseId: (id) => set({ lastClickedVerseId: id }),
    }),
    {
      name: 'bible-navigation',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentTranslationId: state.currentTranslationId,
        currentBookId: state.currentBookId,
        currentChapter: state.currentChapter,
        secondTranslationId: state.secondTranslationId,
      }),
    }
  )
);
