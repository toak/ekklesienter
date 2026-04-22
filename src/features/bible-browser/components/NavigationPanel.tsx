import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { getBookName, getBookSection, BOOK_ORDER } from '@/core/data/bookData';
import { useTranslation } from 'react-i18next';
import { Music } from 'lucide-react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { MediaPoolPanel } from '@/features/presenter/components/media/MediaPoolPanel';

// Components
import { NavigationHeader } from './navigation/NavigationHeader';
import { SearchOverlay } from './navigation/SearchOverlay';
import { BookList } from './navigation/BookList';
import { ChapterGrid } from './navigation/ChapterGrid';
import { GraceLibPanel } from './navigation/GraceLibPanel';
import { NavigationFooter } from './navigation/NavigationFooter';
import ModePicker from './navigation/ModePicker';
import ServicePicker from '@/features/presenter/components/library/ServicePicker';
import TranslationPicker from '@/shared/ui/TranslationPicker';

// Hooks
import { useNavigationSearch } from '../hooks/useNavigationSearch';
import { useNavigationState } from '../hooks/useNavigationState';
import { useVerticalResize } from '../hooks/useVerticalResize';

interface NavigationPanelProps {
  onOpenSettings?: () => void;
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({ onOpenSettings = () => {} }) => {
  const { i18n } = useTranslation();
  const lang = i18n.language?.substring(0, 2) || 'en';
  const isRu = lang === 'ru';
  
  const { 
    currentBookId, 
    currentChapter, 
    setBook, 
    setChapter, 
    setActiveVerse, 
    currentTranslationId 
  } = useBibleStore();

  const activeService = usePresentationStore(s => s.activeService);
  const activeServiceId = usePresentationStore(s => s.activeServiceId);
  const graceLibSection = usePresentationStore(s => s.graceLibSection);
  const setGraceLibSection = usePresentationStore(s => s.setGraceLibSection);

  // 1. Logic Hooks
  const { 
    searchQuery, 
    setSearchQuery, 
    searchResults, 
    isSearching, 
    parseResult 
  } = useNavigationSearch(lang, currentTranslationId);

  const {
    appMode,
    setAppMode,
    isModePickerOpen,
    toggleModePicker,
    closeModePicker,
    isPickerOpen,
    setIsPickerOpen,
    triggerRect,
    handleTranslationBadgeClick
  } = useNavigationState();

  const resizer = useVerticalResize('books-chapters-split', 55, 20, 80);

  // 2. Data Fetching (Books)
  const books = useLiveQuery(
    async () => await db.books.where('translationId').equals(currentTranslationId).toArray(),
    [currentTranslationId]
  ) || [];

  const sortedBooks = useMemo(() => {
    const booksMap = new Map();
    books.forEach(b => booksMap.set(b.bookId, b));
    
    const ordered: any[] = [];
    const usedIds = new Set();

    BOOK_ORDER.forEach((info) => {
      const book = booksMap.get(info.id);
      if (book) {
        ordered.push(book);
        usedIds.add(info.id);
      }
    });

    books.forEach(b => {
      if (!usedIds.has(b.bookId)) ordered.push(b);
    });

    return ordered;
  }, [books]);

  const filteredBooks = useMemo(() => {
    if (!searchQuery.trim() || parseResult.type === 'keyword') return sortedBooks;

    const query = searchQuery.toLowerCase();
    const primaryItem = parseResult.items[0];
    const bookSearchPart = primaryItem?.bookId || parseResult.originalQuery.split(/\d/)[0].trim().toLowerCase();

    return sortedBooks.filter(book => {
      const bName = getBookName(book.bookId, lang).toLowerCase();
      const bId = book.bookId.toLowerCase();
      return bName.includes(bookSearchPart) || bId.includes(bookSearchPart);
    });
  }, [sortedBooks, searchQuery, parseResult, lang]);

  const currentBook = useMemo(() => books.find(b => b.bookId === currentBookId), [books, currentBookId]);

  // 3. Callbacks
  const handleBookSelect = (bookId: string) => {
    setBook(bookId);
    const primaryItem = parseResult.items[0];
    if (primaryItem?.type === 'reference' && primaryItem.bookId === bookId && primaryItem.chapter) {
      setChapter(primaryItem.chapter);
      if (primaryItem.verse) {
        db.verses.where('[translationId+bookId+chapter]')
          .equals([currentTranslationId, bookId, primaryItem.chapter])
          .and(v => v.verseNumber === primaryItem.verse)
          .first()
          .then(v => v && setActiveVerse(v));
      }
    }
  };

  return (
    <div ref={resizer.containerRef} className="flex flex-col h-full bg-stone-900/80 backdrop-blur-xl border-r border-white/5 relative z-20 @container">
      <NavigationHeader
        appMode={appMode}
        isModePickerOpen={isModePickerOpen}
        onToggleModePicker={toggleModePicker}
        onCloseModePicker={closeModePicker}
        onSetAppMode={setAppMode}
        onOpenSettings={onOpenSettings}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Search Results Overlay */}
        {parseResult.type === 'keyword' && parseResult.originalQuery.length >= 2 && (
          <SearchOverlay
            isSearching={isSearching}
            searchResults={searchResults}
            onResultClick={(res) => {
              setBook(res.verse.bookId);
              setChapter(res.verse.chapter);
              setActiveVerse(res.verse);
              setSearchQuery('');
            }}
            lang={lang}
          />
        )}

        {/* Top Area: Book List or GraceLib Panel */}
        <div style={{ height: `${resizer.percent}%` }} className="flex flex-col shrink-0 min-h-0">
          {appMode === 'scripture' ? (
            <BookList
              books={filteredBooks}
              currentBookId={currentBookId}
              onBookSelect={handleBookSelect}
              searchQuery={searchQuery}
              lang={lang}
            />
          ) : (
            <GraceLibPanel
              graceLibSection={graceLibSection}
              onSetGraceLibSection={setGraceLibSection}
            />
          )}
        </div>

        {/* Vertical Resizer */}
        <div
          onMouseDown={resizer.handleMouseDown}
          className="h-1 bg-white/5 hover:bg-accent/40 active:bg-accent transition-all cursor-row-resize shrink-0 flex items-center justify-center relative z-10"
        >
          <div className="absolute inset-0 -top-2 -bottom-2" />
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-stone-950/20">
          {appMode === 'scripture' ? (
            <ChapterGrid
              currentBook={currentBook || null}
              currentChapter={currentChapter}
              onChapterSelect={setChapter}
            />
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar px-3 py-4">
              <div className="px-1 mb-3 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Music className="w-3 h-3" />
                  Media Pool
                </span>
              </div>
              <MediaPoolPanel />
            </div>
          )}
        </div>
      </div>

      <NavigationFooter
        appMode={appMode}
        currentTranslationId={currentTranslationId}
        currentBookId={currentBookId}
        currentChapter={currentChapter}
        activeService={activeService}
        onBadgeClick={handleTranslationBadgeClick}
        lang={lang}
        isRu={isRu}
      />

      {isPickerOpen && appMode === 'presentation' && (
        <ServicePicker
          currentServiceId={activeServiceId}
          onSelect={(id) => usePresentationStore.getState().setActiveService(id)}
          onClose={() => setIsPickerOpen(false)}
          triggerRect={triggerRect}
        />
      )}

      {isModePickerOpen && (
        <ModePicker
          appMode={appMode}
          onSetAppMode={setAppMode}
          onClose={closeModePicker}
          triggerRect={triggerRect}
        />
      )}

      {isPickerOpen && appMode === 'scripture' && (
        <TranslationPicker
          currentTranslationId={currentTranslationId}
          onSelect={(id) => useBibleStore.getState().setTranslation(id)}
          onClose={() => setIsPickerOpen(false)}
          triggerRect={triggerRect}
        />
      )}
    </div>
  );
};

export default NavigationPanel;