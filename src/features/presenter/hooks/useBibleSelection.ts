import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { BOOK_ORDER } from '@/core/data/bookData';
import { Verse, ICanvasSlide, ISlide, IPresentationFile, Translation, Book } from '@/core/types';

export interface UseBibleSelectionReturn {
  selectedTranslationId: string;
  setSelectedTranslationId: React.Dispatch<React.SetStateAction<string>>;
  secondTranslationId: string | null;
  setSecondTranslationId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedBookId: string;
  setSelectedBookId: React.Dispatch<React.SetStateAction<string>>;
  selectedChapter: number;
  setSelectedChapter: React.Dispatch<React.SetStateAction<number>>;
  selectedVerseNumbers: number[];
  setSelectedVerseNumbers: React.Dispatch<React.SetStateAction<number[]>>;
  lastClickedVerseNumber: number | null;
  setLastClickedVerseNumber: React.Dispatch<React.SetStateAction<number | null>>;
  insertMode: 'single' | 'multiple';
  setInsertMode: React.Dispatch<React.SetStateAction<'single' | 'multiple'>>;
  showSecondTranslation: boolean;
  setShowSecondTranslation: React.Dispatch<React.SetStateAction<boolean>>;
  carouselIndex: number;
  setCarouselIndex: React.Dispatch<React.SetStateAction<number>>;
  translations: Translation[];
  sortedBooks: Book[];
  versesInChapter: Verse[];
  chaptersCount: number;
  selectedVerses: Verse[];
  secondTranslationVerse: Verse | null;
  secondTranslationVerses: Verse[];
}

/**
 * Hook to manage the state and data for Bible selection in modals.
 */
export function useBibleSelection(presentation: IPresentationFile | null | undefined, slideId?: string): UseBibleSelectionReturn {
  // 1. Selection State
  const [selectedTranslationId, setSelectedTranslationId] = useState<string>('');
  const [secondTranslationId, setSecondTranslationId] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<number[]>([]);
  const [lastClickedVerseNumber, setLastClickedVerseNumber] = useState<number | null>(null);
  const [insertMode, setInsertMode] = useState<'single' | 'multiple'>('single');
  const [showSecondTranslation, setShowSecondTranslation] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // 2. Data Queries
  const translations = useLiveQuery(() => db.translations.toArray()) || [];
  const books = useLiveQuery(
    () => db.books.where('translationId').equals(selectedTranslationId || '').toArray(),
    [selectedTranslationId]
  ) || [];

  const sortedBooks = useMemo(() => {
    return [...books].sort((a, b) => {
      const orderA = BOOK_ORDER.find(o => o.id === a.bookId)?.order || 99;
      const orderB = BOOK_ORDER.find(o => o.id === b.bookId)?.order || 99;
      return orderA - orderB;
    });
  }, [books]);

  const versesInChapter = useLiveQuery(async () => {
    if (!selectedTranslationId || !selectedBookId) return [];
    return await db.verses
      .where('[translationId+bookId+chapter]')
      .equals([selectedTranslationId, selectedBookId, selectedChapter])
      .toArray();
  }, [selectedTranslationId, selectedBookId, selectedChapter]) || [];

  const chaptersCount = useMemo(() => {
    const book = sortedBooks.find(b => b.bookId === selectedBookId);
    return book?.chapters?.length || 150;
  }, [sortedBooks, selectedBookId]);

  const selectedVerses = useMemo(() => {
    return versesInChapter
      .filter(v => selectedVerseNumbers.includes(v.verseNumber))
      .sort((a, b) => a.verseNumber - b.verseNumber);
  }, [versesInChapter, selectedVerseNumbers]);

  const secondTranslationVerse = useLiveQuery(async () => {
    if (!secondTranslationId || selectedVerses.length !== 1) return null;
    const primaryVerse = selectedVerses[0];
    if (!primaryVerse) return null;
    return await db.verses
      .where('[translationId+bookId+chapter]')
      .equals([secondTranslationId, primaryVerse.bookId, primaryVerse.chapter])
      .and(v => v.verseNumber === primaryVerse.verseNumber)
      .first();
  }, [secondTranslationId, selectedVerses]) || null;

  const secondTranslationVerses = useLiveQuery(async () => {
    if (!secondTranslationId || selectedVerses.length <= 1) return [];
    const firstVerse = selectedVerses[0];
    if (!firstVerse) return [];
    const allSecondVerses = await db.verses
      .where('[translationId+bookId+chapter]')
      .equals([secondTranslationId, firstVerse.bookId, firstVerse.chapter])
      .filter(v => selectedVerseNumbers.includes(v.verseNumber))
      .toArray();
    return allSecondVerses.sort((a, b) => a.verseNumber - b.verseNumber);
  }, [secondTranslationId, selectedVerses, selectedVerseNumbers]) || [];

  // 3. Lifecycle / Sync
  useEffect(() => {
    if (translations.length > 0 && !selectedTranslationId) {
      setSelectedTranslationId(translations[0].id);
    }
  }, [translations, selectedTranslationId]);

  useEffect(() => {
    if (sortedBooks.length > 0 && !selectedBookId) {
      setSelectedBookId(sortedBooks[0].bookId);
    }
  }, [sortedBooks, selectedBookId]);

  useEffect(() => {
    if (!slideId || !presentation?.slides) return;
    const slide = presentation.slides.find((s: ISlide) => s.id === slideId);
    if (!slide || slide.type !== 'normal') return;

    const canvasSlide = slide as ICanvasSlide;
    const vars = canvasSlide.content.variables;
    if (vars.translationId) setSelectedTranslationId(String(vars.translationId));
    if (vars.bookId) setSelectedBookId(String(vars.bookId));
    if (vars.chapter) setSelectedChapter(Number(vars.chapter));
    if (vars.secondTranslationId) {
      setSecondTranslationId(String(vars.secondTranslationId));
      setShowSecondTranslation(true);
    }
    if (vars.verseStart) {
      const start = Number(vars.verseStart);
      const end = vars.verseEnd ? Number(vars.verseEnd) : start;
      const range: number[] = [];
      for (let i = start; i <= end; i++) range.push(i);
      setSelectedVerseNumbers(range);
    } else if (vars.verses) {
      try {
        setSelectedVerseNumbers(JSON.parse(String(vars.verses)));
      } catch {
        setSelectedVerseNumbers([]);
      }
    }
  }, [slideId, presentation]);

  useEffect(() => {
    setCarouselIndex(0);
  }, [selectedVerseNumbers.length, insertMode]);

  return {
    selectedTranslationId, setSelectedTranslationId,
    secondTranslationId, setSecondTranslationId,
    selectedBookId, setSelectedBookId,
    selectedChapter, setSelectedChapter,
    selectedVerseNumbers, setSelectedVerseNumbers,
    lastClickedVerseNumber, setLastClickedVerseNumber,
    insertMode, setInsertMode,
    showSecondTranslation, setShowSecondTranslation,
    carouselIndex, setCarouselIndex,
    translations,
    sortedBooks,
    versesInChapter,
    chaptersCount,
    selectedVerses,
    secondTranslationVerse,
    secondTranslationVerses
  };
}
