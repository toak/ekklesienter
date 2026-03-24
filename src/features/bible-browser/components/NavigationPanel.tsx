import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { getBookOrder, getSectionColors, getBookSection, getBookName, SECTION_NAMES, BibleSection, BOOK_ORDER } from '@/core/data/bookData';
import { Book, BookOpen, Layers, Settings, GripHorizontal, Search, X, Hash, ChevronRight, Clock, Plus, Presentation, ChevronDown, List, Layout, Workflow, Monitor, Music, Coins, Baby, Mic2, Megaphone, Save, Check, LayoutTemplate } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { parseSearchQuery } from '@/features/search/utils/searchParser';
import { searchVerses, SearchResult } from '@/features/search/services/globalSearchService';
import { cn } from '@/core/utils/cn';
import TranslationPicker from '@/shared/ui/TranslationPicker';
import ServicePicker from '@/features/presenter/components/library/ServicePicker';
import { useAtom } from 'jotai';
import { appModeAtom } from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { MediaPoolPanel } from '@/features/presenter/components/media/MediaPoolPanel';
import { ISlide } from '@/core/types';
import { GraceLibBin } from '@/features/presenter/components/library/GraceLibBin';


/**
 * Helper to highlight search matches
 */
const SearchHighlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-accent/30 text-accent px-0.5 rounded-sm ring-1 ring-accent/20">{part}</mark>
          : <React.Fragment key={i}>{part}</React.Fragment>
      )}
    </>
  );
};

interface NavigationPanelProps {
  onOpenSettings?: () => void;
}

// Custom resizable hook for vertical split
function useVerticalResize(storageKey: string, defaultPercent: number, minPercent: number, maxPercent: number) {
  const [percent, setPercent] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? Number(saved) : defaultPercent;
  });
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const newPercent = Math.min(maxPercent, Math.max(minPercent, (relativeY / rect.height) * 100));
      setPercent(newPercent);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem(storageKey, String(percent));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [storageKey, percent, minPercent, maxPercent]);

  return { percent, handleMouseDown, containerRef };
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({ onOpenSettings }) => {
  const { t, i18n } = useTranslation();
  const { currentBookId, currentChapter, setBook, setChapter, setActiveVerse, currentTranslationId, setTranslation } = useBibleStore();
  const [appMode, setAppMode] = useAtom(appModeAtom);
  const [isModePickerOpen, setIsModePickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);
  const modeTriggerRef = useRef<HTMLButtonElement>(null);
  const { openModal } = useModalStore();
  const activeServiceId = usePresentationStore(s => s.activeServiceId);
  const setActiveService = usePresentationStore(s => s.setActiveService);
  const activeService = usePresentationStore(s => s.activeService);
  const activePresentationId = usePresentationStore(s => s.activePresentationId);
  const graceLibSection = usePresentationStore(s => s.graceLibSection);
  const setGraceLibSection = usePresentationStore(s => s.setGraceLibSection);

  const resizer = useVerticalResize('books-chapters-split', 55, 20, 80);

  const blocks = useLiveQuery(() => db.blocks.toArray()) || [];

  const books = useLiveQuery(
    async () => {
      return await db.books.where('translationId').equals(currentTranslationId).toArray();
    },
    [currentTranslationId]
  ) || [];

  const translations = useLiveQuery(() => db.translations.toArray()) || [];

  const booksMap = useMemo(() => {
    const map = new Map();
    books.forEach(b => map.set(b.bookId, b));
    return map;
  }, [books]);

  const sortedBooks = useMemo(() => {
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
      if (!usedIds.has(b.bookId)) {
        ordered.push(b);
      }
    });

    return ordered;
  }, [booksMap, books]);

  const currentBook = booksMap.get(currentBookId);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);


  const lang = i18n.language?.substring(0, 2) || 'en';
  const isRu = lang === 'ru';

  const parseResult = useMemo(() => parseSearchQuery(searchQuery, lang), [searchQuery, lang]);

  const filteredBooks = useMemo(() => {
    if (!searchQuery.trim() || parseResult.type === 'keyword') return sortedBooks;

    const query = searchQuery.toLowerCase();
    const bookSearchPart = parseResult.bookId || parseResult.query.split(/\d/)[0].trim().toLowerCase();

    return sortedBooks.filter(book => {
      const bName = getBookName(book.bookId, lang).toLowerCase();
      const bId = book.bookId.toLowerCase();
      return bName.includes(bookSearchPart) || bId.includes(bookSearchPart);
    });
  }, [sortedBooks, searchQuery, parseResult, lang]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (parseResult.type === 'keyword' && parseResult.query.length >= 2) {
        setIsSearching(true);
        const results = await searchVerses(parseResult.query, currentTranslationId);
        setSearchResults(results);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [parseResult, currentTranslationId]);

  const handleSearchResultClick = (result: SearchResult) => {
    setBook(result.verse.bookId);
    setChapter(result.verse.chapter);
    setActiveVerse(result.verse);
    setSearchQuery('');
  };

  // Multi-click logic for translation switching
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cycleTranslation = (direction: number) => {
    if (translations.length <= 1) return;
    const currentIndex = translations.findIndex(tr => tr.id === currentTranslationId);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + direction + translations.length) % translations.length;
    setTranslation(translations[nextIndex].id);
  };

  const handleTranslationBadgeClick = () => {
    clickCountRef.current++;

    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);

    clickTimeoutRef.current = setTimeout(() => {
      if (clickCountRef.current === 1) {
        if (pickerTriggerRef.current) {
          setTriggerRect(pickerTriggerRef.current.getBoundingClientRect());
        }
        setIsPickerOpen(true);
      } else if (clickCountRef.current === 2) {
        // Double Click -> Next
        cycleTranslation(1);
      } else if (clickCountRef.current >= 3) {
        // Triple Click -> Prev
        cycleTranslation(-1);
      }
      clickCountRef.current = 0;
    }, 250);
  };

  const getSectionName = (section: BibleSection): string => {
    return SECTION_NAMES[lang]?.[section] || SECTION_NAMES.en[section];
  };

  let lastSection: BibleSection | null = null;

  return (
    <div ref={resizer.containerRef} className="flex flex-col h-full bg-stone-900/80 backdrop-blur-xl border-r border-white/5 relative">

      {/* Mode Switcher Header */}
      <div className="p-4 border-b border-white/5 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="relative">
            <button
              ref={modeTriggerRef}
              onClick={() => setIsModePickerOpen(!isModePickerOpen)}
              className="group flex items-center gap-2 px-2 py-1.5 -ml-2 rounded-lg hover:bg-white/5 transition-all text-left"
            >
              <div className="p-1.5 bg-accent/20 rounded-lg group-hover:bg-accent/30 transition-colors">
                {appMode === 'scripture' ? (
                  <BookOpen className="w-4 h-4 text-accent" />
                ) : (
                  <Presentation className="w-4 h-4 text-accent" />
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-bold text-stone-200 tracking-tight text-xs uppercase">
                    {appMode === 'scripture' ? t('scripture') : t('presentation', 'Presentation')}
                  </h2>
                  <ChevronDown className={cn("w-3 h-3 text-stone-500 transition-transform", isModePickerOpen && "rotate-180")} />
                </div>
              </div>
            </button>

            {/* Mode Picker Dropdown */}
            {isModePickerOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsModePickerOpen(false)}
                />
                <div className="absolute top-full left-0 mt-1 w-48 bg-stone-900 border border-white/10 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                  <button
                    onClick={() => {
                      setAppMode('scripture');
                      setIsModePickerOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                      appMode === 'scripture' ? "bg-accent/10 text-accent font-bold" : "text-stone-400 hover:bg-white/5 hover:text-stone-200"
                    )}
                  >
                    <BookOpen className="w-4 h-4" />
                    {t('scripture')}
                  </button>
                  <button
                    onClick={() => {
                      setAppMode('presentation');
                      setIsModePickerOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                      appMode === 'presentation' ? "bg-accent/10 text-accent font-bold" : "text-stone-400 hover:bg-white/5 hover:text-stone-200"
                    )}
                  >
                    <Presentation className="w-4 h-4" />
                    {t('presentation', 'Presentation')}
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={onOpenSettings}
            className="p-1.5 text-stone-500 hover:text-stone-200 hover:bg-white/5 rounded-lg transition-all"
            title={t('settings')}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 group-focus-within:text-accent transition-colors" />
          <input
            type="text"
            placeholder={t('search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-950/40 border border-white/5 rounded-xl py-2 pl-10 pr-10 text-sm text-stone-200 focus:outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all placeholder:text-stone-700"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-600 hover:text-stone-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Global Search Results Layer */}
        {parseResult.type === 'keyword' && parseResult.query.length >= 2 && (
          <div className="absolute inset-0 z-20 bg-stone-900 overflow-y-auto no-scrollbar animate-in fade-in duration-200">
            <div className="p-3 border-b border-white/5 sticky top-0 bg-stone-900/95 backdrop-blur-sm flex items-center justify-between">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                {isSearching ? t('searching', 'Searching...') : t('found_verses', 'Found Verses')}
              </span>
              {!isSearching && (
                <span className="text-[10px] text-accent font-medium">{searchResults.length}</span>
              )}
            </div>

            <div className="p-2 space-y-1">
              {searchResults.map((res, i) => (
                <button
                  key={`${res.verse.bookId}-${res.verse.chapter}-${res.verse.verseNumber}-${i}`}
                  onClick={() => handleSearchResultClick(res)}
                  className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-all group flex flex-col gap-1 border border-transparent hover:border-white/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-300 group-hover:text-accent transition-colors">
                      {getBookName(res.verse.bookId, lang)} {res.verse.chapter}:{res.verse.verseNumber}
                    </span>
                    <ChevronRight className="w-3 h-3 text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p
                    className="text-xs text-stone-500 line-clamp-2 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: res.highlightedText }}
                  />
                </button>
              ))}

              {!isSearching && searchResults.length === 0 && (
                <div className="py-20 text-center space-y-3">
                  <Search className="w-10 h-10 text-stone-800 mx-auto" strokeWidth={1} />
                  <p className="text-sm text-stone-600 italic">{t('no_results_found', 'No verses found')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation View (Conditional) */}
        {/* Symmetric Top Area */}
        <div style={{ height: `${resizer.percent}%` }} className="flex flex-col shrink-0 min-h-0">
          {appMode === 'scripture' ? (
            <>
              <div className="px-4 py-2 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                  {t('books')}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-3 pb-4 space-y-0.5 min-h-0">
                {filteredBooks.map((book) => {
                  const section = getBookSection(book.bookId);
                  const colors = getSectionColors(book.bookId);
                  const showHeader = section !== lastSection;
                  lastSection = section;

                  return (
                    <React.Fragment key={book.bookId}>
                      {showHeader && (
                        <div className={cn(
                          "px-3 py-2 mt-4 first:mt-0 text-[10px] font-bold uppercase tracking-wider opacity-60",
                          colors.icon
                        )}>
                          {getSectionName(section)}
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setBook(book.bookId);
                          if (parseResult.type === 'reference' && parseResult.bookId === book.bookId && parseResult.chapter) {
                            setChapter(parseResult.chapter);
                            if (parseResult.verse) {
                              db.verses.where('[translationId+bookId+chapter]')
                                .equals([currentTranslationId, book.bookId, parseResult.chapter])
                                .and(v => v.verseNumber === parseResult.verse)
                                .first()
                                .then(v => v && setActiveVerse(v));
                            }
                          }
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-300 flex items-center gap-3 border shadow-sm",
                          currentBookId === book.bookId
                            ? `${colors.bg} ${colors.border} ${colors.icon} font-bold shadow-[0_4px_12px_rgba(0,0,0,0.1)]`
                            : "bg-white/2 border-transparent text-stone-400 hover:bg-white/5 hover:text-stone-200"
                        )}
                      >
                        <Book className={cn("w-4 h-4 shrink-0 transition-transform duration-300", currentBookId === book.bookId ? "scale-110" : "opacity-40")} />
                        <span className="truncate flex-1">
                          <SearchHighlight text={getBookName(book.bookId, lang)} query={searchQuery} />
                        </span>
                        {currentBookId === book.bookId && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar px-3 py-4 space-y-4">
              <div className="px-1 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Layout className="w-3 h-3" />
                  GraceLib
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 shrink-0">
                <GraceLibBin
                  id="templates"
                  name={t('templates', 'Templates')}
                  icon={LayoutTemplate}
                  isActive={graceLibSection === 'templates'}
                  onClick={() => setGraceLibSection('templates')}
                  description={t('templates_desc', 'Reusable Slide Layouts')}
                />
                <GraceLibBin
                  id="presentations"
                  name={t('presentations', 'Presentations')}
                  icon={Presentation}
                  isActive={graceLibSection === 'presentations'}
                  onClick={() => setGraceLibSection('presentations')}
                  description={t('presentations_desc', 'Global .ekt Library')}
                />
                <GraceLibBin
                  id="media"
                  name={t('media', 'Media')}
                  icon={Music}
                  isActive={graceLibSection === 'media'}
                  onClick={() => setGraceLibSection('media')}
                  description={t('media_desc', 'Local Assets & Bins')}
                />
              </div>
            </div>
          )}
        </div>

        {/* Persistent Resizer */}
        <div
          onMouseDown={resizer.handleMouseDown}
          className="h-1 bg-white/5 hover:bg-accent/40 active:bg-accent transition-all cursor-row-resize shrink-0 flex items-center justify-center relative z-10"
        >
          <div className="absolute inset-0 -top-2 -bottom-2" />
        </div>

        {/* Symmetric Bottom Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-stone-950/20">
          {appMode === 'scripture' ? (
            <>
              <div className="px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-stone-600" />
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                    {t('chapters')}
                  </span>
                </div>
                {currentBook && (
                  <span className="text-[10px] font-bold text-stone-600 px-2 py-0.5 bg-white/5 rounded-full">
                    {currentBook.chapters.length}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4 min-h-0">
                {currentBook ? (
                  <div className="grid grid-cols-5 gap-2">
                    {currentBook.chapters.map((chap) => {
                      const colors = getSectionColors(currentBook.bookId);
                      const isSelected = currentChapter === chap;
                      return (
                        <button
                          key={chap}
                          onClick={() => setChapter(chap)}
                          className={cn(
                            "aspect-square rounded-xl text-xs font-bold transition-all duration-300 shadow-sm",
                            isSelected
                              ? `${colors.bg} ${colors.icon} ${colors.border} border-2 scale-105 shadow-[0_4px_12px_rgba(0,0,0,0.2)]`
                              : "bg-white/3 text-stone-500 hover:bg-white/8 hover:text-stone-200 border border-transparent"
                          )}
                        >
                          {chap}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-stone-700 italic gap-2 opacity-50">
                    <BookOpen className="w-8 h-8 opacity-20" />
                    <span className="text-xs">{t('select_book_hint', 'Select a book to view chapters')}</span>
                  </div>
                )}
              </div>
            </>
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

      {/* Footer / Context Info */}
      <div className="p-3 border-t border-white/5 bg-stone-950/40 relative z-30">
        {appMode === 'scripture' ? (
          <button
            ref={pickerTriggerRef}
            onClick={handleTranslationBadgeClick}
            className="w-full h-[60px] flex items-center gap-3 p-3 rounded-2xl bg-stone-900/40 border border-white/5 hover:border-accent/40 hover:bg-stone-800/60 transition-all group active:scale-95 shadow-xl shadow-black/20"
          >
            <div className="min-w-10 h-8 px-2 rounded-xl bg-accent flex items-center justify-center border border-accent/20 shadow-lg shadow-accent/10 shrink-0 group-hover:shadow-accent/20 transition-all">
              <span className="text-[10px] font-black text-accent-foreground uppercase">{currentTranslationId}</span>
            </div>
            <div className="flex flex-col min-w-0 text-left">
              <span className="text-[10px] font-bold text-stone-300 uppercase leading-none truncate group-hover:text-white transition-colors">
                {currentBook ? getBookName(currentBook.bookId, lang) : '-'}
              </span>
              <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest mt-0.5 truncate group-hover:text-stone-400">
                {currentChapter ? `${t('chapter')} ${currentChapter}` : '-'}
              </span>
            </div>
          </button>
        ) : (
          <button
            ref={pickerTriggerRef}
            onClick={() => {
              if (pickerTriggerRef.current) {
                setTriggerRect(pickerTriggerRef.current.getBoundingClientRect());
              }
              setIsPickerOpen(true);
            }}
            className="w-full h-[60px] flex items-center gap-3 p-3 rounded-2xl bg-stone-900/40 border border-white/5 hover:border-accent/40 hover:bg-stone-800/60 transition-all group active:scale-95 shadow-xl shadow-black/20"
          >
            <div className="min-w-10 h-8 px-2 rounded-xl bg-accent flex items-center justify-center border border-accent/20 shadow-lg shadow-accent/10 shrink-0 group-hover:shadow-accent/20 transition-all">
              <Workflow className="w-4 h-4 text-accent-foreground" />
            </div>
            <div className="flex flex-col min-w-0 text-left">
              <span className="text-[10px] font-bold text-stone-300 uppercase leading-none truncate group-hover:text-white transition-colors">
                {activeService ? (isRu ? activeService.nameRu : activeService.name) : t('select_service', 'Select Service')}
              </span>
              <span className="text-[8px] font-bold text-stone-600 uppercase tracking-widest mt-1 truncate group-hover:text-stone-400">
                {activeService?.fileHandle ? t('linked', 'Linked') : t('local', 'Local')}
              </span>
            </div>
          </button>
        )}

        {/* Picker Overlays */}
        {isPickerOpen && (
          appMode === 'scripture' ? (
            <TranslationPicker
              currentTranslationId={currentTranslationId}
              onSelect={setTranslation}
              onClose={() => setIsPickerOpen(false)}
              triggerRect={triggerRect}
            />
          ) : (
            <ServicePicker
              currentServiceId={activeServiceId}
              onSelect={setActiveService}
              onClose={() => setIsPickerOpen(false)}
              triggerRect={triggerRect}
              onServiceCreated={(id) => {
                setActiveService(id);
                setIsPickerOpen(false);
              }}
            />
          )
        )}
      </div>
    </div>
  );
};

export default NavigationPanel;