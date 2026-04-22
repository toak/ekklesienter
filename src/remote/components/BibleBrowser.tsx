import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    BookOpen, Search, ChevronRight, ChevronLeft, Check, Loader2, 
    Layers, Copy, LayoutGrid, CheckCircle2, RotateCcw, 
    Home, Languages, LibraryBig, Hash, ArrowRightLeft
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { useTranslation } from 'react-i18next';

interface IBibleBrowserProps {
    onSelect: (verse: any | any[]) => void;
    onQuery: (type: string, payload: any) => Promise<any[]>;
}

export const BibleBrowser: React.FC<IBibleBrowserProps> = ({ onSelect, onQuery }) => {
    const { t } = useTranslation();
    // Navigation Data
    const [translations, setTranslations] = useState<any[]>([]);
    const [books, setBooks] = useState<any[]>([]);
    const [chapters, setChapters] = useState<number[]>([]);
    const [verses, setVerses] = useState<any[]>([]);
    const [parallelVerses, setParallelVerses] = useState<Record<number, any>>({});
    
    // Selection state
    const [selectedTranslation, setSelectedTranslation] = useState<any>(null);
    const [secondTranslation, setSecondTranslation] = useState<any>(null);
    const [selectedBook, setSelectedBook] = useState<any>(null);
    const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
    
    // UI state
    const [loading, setLoading] = useState(false);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedVerseItems, setSelectedVerseItems] = useState<any[]>([]);
    const [isParallelMode, setIsParallelMode] = useState(false);
    const [isSelectingParallel, setIsSelectingParallel] = useState(false);

    // Scrolling Refs
    const scrollRef = useRef<HTMLDivElement>(null);

    // Reset scroll when data changes (Books, Chapters, or Verses)
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
    }, [books, chapters, verses, translations]);

    // Initial load: Translations
    useEffect(() => {
        loadTranslations();
    }, []);

    const loadTranslations = async () => {
        setLoading(true);
        const results = await onQuery('GET_TRANSLATIONS', {});
        setTranslations(results);
        setLoading(false);
    };

    const handleSelectTranslation = async (trans: any) => {
        if (isSelectingParallel) {
            setSecondTranslation(trans);
            setIsSelectingParallel(false);
            setIsParallelMode(true);
            // If already on a chapter, refresh verses to get parallel text
            if (selectedChapter) handleSelectChapter(selectedChapter, trans);
            return;
        }

        setLoading(true);
        setSelectedTranslation(trans);
        const results = await onQuery('GET_BOOKS', { translationId: trans.id });
        setBooks(results);
        setLoading(false);
    };

    const handleSelectBook = (book: any) => {
        setSelectedBook(book);
        const chapCount = book.chaptersCount || 50;
        setChapters(Array.from({ length: chapCount }, (_, i) => i + 1));
    };

    const handleSelectChapter = async (chap: number, overridenParallel?: any) => {
        setLoading(true);
        setSelectedChapter(chap);
        
        // Fetch primary verses
        const results = await onQuery('GET_VERSES', { 
            translationId: selectedTranslation.id,
            bookId: selectedBook.bookId,
            chapter: chap
        });
        setVerses(results);

        // Fetch parallel verses if mode is active
        const parallelTarget = overridenParallel || secondTranslation;
        if ((isParallelMode || overridenParallel) && parallelTarget) {
            const pResults = await onQuery('GET_VERSES', {
                translationId: parallelTarget.id,
                bookId: selectedBook.bookId,
                chapter: chap
            });
            const pMap: Record<number, any> = {};
            pResults.forEach(v => { pMap[v.verseNumber] = v; });
            setParallelVerses(pMap);
        }

        setLoading(false);
    };

    const toggleVerse = (verse: any) => {
        if (!isSelectMode) {
            onSelect(verse);
            return;
        }

        setSelectedVerseItems(prev => {
            const exists = prev.find(v => v.id === verse.id);
            if (exists) return prev.filter(v => v.id !== verse.id);
            return [...prev, verse].sort((a, b) => a.verseNumber - b.verseNumber);
        });
    };

    const handleProjectSelected = () => {
        if (selectedVerseItems.length > 0) {
            onSelect(selectedVerseItems);
        }
    };

    // Stage Resolver
    const currentStage = useMemo(() => {
        if (isSelectingParallel) return 'SELECT_PARALLEL';
        if (!selectedTranslation) return 'TRANSLATION';
        if (!selectedBook) return 'BOOK';
        if (selectedChapter === null) return 'CHAPTER';
        return 'VERSE';
    }, [selectedTranslation, selectedBook, selectedChapter, isSelectingParallel]);

    // Header / Breadcrumbs component
    const Breadcrumbs = () => (
        <div className="flex flex-col gap-3 mb-6 animate-in fade-in slide-in-from-top-4 duration-500 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                <button 
                    onClick={() => { setSelectedTranslation(null); setSelectedBook(null); setSelectedChapter(null); setVerses([]); setIsSelectingParallel(false); }}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all shrink-0",
                        currentStage === 'TRANSLATION' || isSelectingParallel ? "bg-accent/10 border-accent/30 text-accent font-black" : "bg-stone-900/40 border-white/5 text-stone-500 font-bold"
                    )}
                >
                    <Languages size={14} />
                    <span className="text-[10px] uppercase tracking-widest">{selectedTranslation?.id || t('remote.bible')}</span>
                </button>

                {selectedTranslation && !isSelectingParallel && (
                    <>
                        <ChevronRight size={12} className="text-stone-700 shrink-0" />
                        <button 
                            onClick={() => { setSelectedBook(null); setSelectedChapter(null); setVerses([]); }}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all shrink-0",
                                currentStage === 'BOOK' ? "bg-accent/10 border-accent/30 text-accent font-black" : "bg-stone-900/40 border-white/5 text-stone-500 font-bold"
                            )}
                        >
                            <LibraryBig size={14} />
                            <span className="text-[10px] uppercase tracking-widest truncate max-w-[80px]">{selectedBook?.name || t('remote.books')}</span>
                        </button>
                    </>
                )}

                {selectedBook && !isSelectingParallel && (
                    <>
                        <ChevronRight size={12} className="text-stone-700 shrink-0" />
                        <button 
                            onClick={() => { setSelectedChapter(null); setVerses([]); }}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all shrink-0",
                                currentStage === 'CHAPTER' ? "bg-accent/10 border-accent/30 text-accent font-black" : "bg-stone-900/40 border-white/5 text-stone-500 font-bold"
                            )}
                        >
                            <Hash size={14} />
                            <span className="text-[10px] uppercase tracking-widest">{selectedChapter || t('remote.chapters_short')}</span>
                        </button>
                    </>
                )}
            </div>

            {currentStage === 'VERSE' && (
                <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setIsSelectMode(!isSelectMode)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all",
                                isSelectMode ? "bg-accent text-accent-foreground border-accent font-black shadow-lg" : "bg-stone-900/60 border-white/5 text-stone-400 font-bold"
                            )}
                        >
                            <CheckCircle2 size={16} />
                            <span className="text-[10px] uppercase tracking-widest">{t('remote.select')}</span>
                        </button>
                        <button 
                            onClick={() => {
                                if (!secondTranslation) {
                                    setIsSelectingParallel(true);
                                } else {
                                    const nextVal = !isParallelMode;
                                    setIsParallelMode(nextVal);
                                    if (nextVal && selectedChapter) handleSelectChapter(selectedChapter);
                                }
                            }}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all",
                                isParallelMode ? "bg-accent/20 border-accent/40 text-accent font-black" : "bg-stone-900/60 border-white/5 text-stone-400 font-bold"
                            )}
                        >
                            <Layers size={16} />
                            <span className="text-[10px] uppercase tracking-widest overflow-hidden whitespace-nowrap">
                                {secondTranslation && isParallelMode ? secondTranslation.id : t('remote.parallel')}
                            </span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    // --- RENDERERS ---

    if (currentStage === 'TRANSLATION' || currentStage === 'SELECT_PARALLEL') {
        const title = isSelectingParallel ? t('remote.select_parallel') : t('remote.select_translation');
        return (
            <div className="flex-1 overflow-y-auto w-full flex flex-col pt-2 min-h-0">
                <Breadcrumbs />
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-accent/50 mb-4 px-2">{title}</h2>
                {loading ? (
                    <div className="flex-1 flex items-center justify-center p-20"><Loader2 className="animate-spin text-accent w-10 h-10" /></div>
                ) : (
                    <div ref={scrollRef} className="flex-1 overflow-y-auto grid grid-cols-1 gap-3 pb-20">
                        {translations
                            .filter(t => !isSelectingParallel || t.id !== selectedTranslation?.id)
                            .map((t, idx) => (
                            <button 
                                key={t.id}
                                onClick={() => handleSelectTranslation(t)}
                                className="w-full p-6 bg-stone-900/40 border border-white/5 rounded-[2.5rem] flex items-center justify-between active:bg-accent/10 active:border-accent/30 transition-all active:scale-[0.98] backdrop-blur-3xl animate-in fade-in slide-in-from-bottom-4"
                                style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
                            >
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 bg-stone-950/50 rounded-2xl flex items-center justify-center border border-white/5">
                                        <Languages size={22} className="text-accent" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/60 mb-1">{t.id}</p>
                                        <span className="font-bold text-xl text-stone-100">{t.name}</span>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-stone-700" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (currentStage === 'BOOK') {
        return (
            <div className="flex-1 min-h-0 flex flex-col w-full pt-2">
                <Breadcrumbs />
                <div ref={scrollRef} className="flex-1 overflow-y-auto grid grid-cols-1 gap-3 pb-20 align-top content-start">
                    {books.map((b, idx) => (
                        <button 
                            key={b.id}
                            onClick={() => handleSelectBook(b)}
                            className="w-full p-6 bg-stone-900/40 border border-white/5 rounded-[2.5rem] flex items-center justify-between active:bg-accent/10 active:border-accent/30 transition-all active:scale-[0.98] backdrop-blur-3xl animate-in fade-in slide-in-from-bottom-4 group"
                            style={{ animationDelay: `${(idx % 20) * 15}ms`, animationFillMode: 'both' }}
                        >
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 bg-stone-950/50 rounded-2xl flex items-center justify-center border border-white/5">
                                    <LibraryBig size={22} className="text-stone-400 group-active:text-accent transition-colors" />
                                </div>
                                <div className="text-left">
                                    <span className="font-bold text-xl text-stone-100 uppercase tracking-tight">{b.name}</span>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-600 mt-1">{b.chaptersCount} {t('remote.chapters')}</p>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-stone-700" />
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (currentStage === 'CHAPTER') {
        return (
            <div className="flex-1 min-h-0 flex flex-col w-full pt-2">
                <Breadcrumbs />
                <div ref={scrollRef} className="flex-1 overflow-y-auto grid grid-cols-4 gap-3 pb-20 content-start">
                    {chapters.map((c, idx) => (
                        <button 
                            key={c}
                            onClick={() => handleSelectChapter(c)}
                            className="aspect-square bg-stone-900/40 border border-white/5 rounded-[1.75rem] flex items-center justify-center font-black text-2xl active:bg-accent active:text-accent-foreground active:scale-[0.94] transition-all text-stone-400 backdrop-blur-3xl animate-in fade-in zoom-in-95"
                            style={{ animationDelay: `${(idx % 20) * 15}ms`, animationFillMode: 'both' }}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // VERSE STAGE
    return (
        <div className="flex-1 min-h-0 flex flex-col w-full pt-2 relative">
            <Breadcrumbs />
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-24 pr-1">
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent w-10 h-10" /></div>
                ) : (
                    verses.map((v, idx) => {
                        const isSelected = selectedVerseItems.some(item => item.id === v.id);
                        const parallelVerse = parallelVerses[v.verseNumber];

                        return (
                            <button 
                                key={v.id}
                                onClick={() => toggleVerse(v)}
                                className={cn(
                                    "w-full p-6 border transition-all flex flex-col gap-3 text-left backdrop-blur-3xl active:scale-[0.98] animate-in fade-in slide-in-from-bottom-4 group relative overflow-hidden",
                                    isSelected 
                                        ? "bg-accent/15 border-accent/40 rounded-[2rem]" 
                                        : "bg-stone-900/40 border-white/5 rounded-[2rem]"
                                )}
                                style={{ animationDelay: `${(idx % 12) * 30}ms`, animationFillMode: 'both' }}
                            >
                                <div className="flex items-start gap-4">
                                    <span className={cn(
                                        "font-black text-xs shrink-0 pt-0.5 transition-colors",
                                        isSelected ? "text-accent" : "text-stone-600"
                                    )}>
                                        {v.verseNumber}
                                    </span>
                                    <div className="flex flex-col gap-4 w-full">
                                        <span className={cn(
                                            "leading-relaxed font-bold transition-colors",
                                            isSelected ? "text-white" : "text-stone-200"
                                        )}>
                                            {v.text}
                                        </span>
                                        
                                        {isParallelMode && parallelVerse && (
                                            <div className="pt-3 border-t border-white/5 flex flex-col gap-1.5 translate-y-0.5">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-accent/50">{secondTranslation?.id}</span>
                                                <span className="text-stone-500 font-medium italic leading-relaxed text-sm">
                                                    {parallelVerse.text}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {isSelectMode && isSelected && (
                                    <div className="absolute top-4 right-4 text-accent animate-in zoom-in-50 duration-300">
                                        <CheckCircle2 size={18} fill="currentColor" className="text-accent-foreground" />
                                    </div>
                                )}
                            </button>
                        );
                    })
                )}
            </div>

            {/* Selection Action Bar */}
            {isSelectMode && selectedVerseItems.length > 0 && (
                <div className="absolute bottom-4 left-0 right-0 z-50 px-4 animate-in slide-in-from-bottom-10 duration-500">
                    <button
                        onClick={handleProjectSelected}
                        className="w-full bg-accent text-accent-foreground p-5 rounded-3xl font-black uppercase tracking-[0.2em] text-sm shadow-2xl flex items-center justify-center gap-3 transition-transform active:scale-95"
                    >
                        {selectedVerseItems.length === 1 
                            ? t('remote.project_verse') 
                            : t('remote.project_verses', { count: selectedVerseItems.length })}
                    </button>
                </div>
            )}
        </div>
    );
};
