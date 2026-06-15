import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { Search, CornerDownLeft, BookOpen, Clock, ChevronDown, ChevronRight, Hash, Sparkles, Wand2, ArrowRight } from 'lucide-react';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { useHistoryStore } from '@/core/store/historyStore';
import { db } from '@/core/db';
import { getBookName } from '@/core/data/bookData';
import { cn } from '@/core/utils/cn';
import { parseSearchQuery, ParseResult, ParsedItem } from '../utils/searchParser';
import { SearchResult, searchVerses as performKeywordSearch } from '../services/globalSearchService';
import { Verse } from '@/core/types';

interface QuickSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface GroupedResults {
    references: ParsedItem[];
    topics: ParsedItem[];
    keywords: SearchResult[];
}

const QuickSearchModal: React.FC<QuickSearchModalProps> = ({ isOpen, onClose }) => {
    const { t, i18n } = useTranslation();
    const { 
        currentBookId, 
        setBook, 
        setChapter, 
        setActiveVerse, 
        setSelectedVerses,
        commitToProjector,
        currentTranslationId 
    } = useBibleStore(useShallow(state => ({
        currentBookId: state.currentBookId,
        setBook: state.setBook,
        setChapter: state.setChapter,
        setActiveVerse: state.setActiveVerse,
        setSelectedVerses: state.setSelectedVerses,
        commitToProjector: state.commitToProjector,
        currentTranslationId: state.currentTranslationId
    })));
    const history = useHistoryStore(state => state.history);
    
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<GroupedResults>({ references: [], topics: [], keywords: [] });
    
    // Accordion state persisted in localStorage
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('search_expanded_sections');
        return saved ? JSON.parse(saved) : { references: true, topics: true, keywords: true };
    });

    const toggleSection = useCallback((id: string) => {
        setExpandedSections(prev => {
            const next = { ...prev, [id]: !prev[id] };
            localStorage.setItem('search_expanded_sections', JSON.stringify(next));
            return next;
        });
    }, []);

    const inputRef = useRef<HTMLInputElement>(null);
    const lang = i18n.language?.substring(0, 2) || 'en';

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults({ references: [], topics: [], keywords: [] });
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSearch = useCallback(async (currentQuery: string) => {
        if (!currentQuery.trim()) {
            setResults({ references: [], topics: [], keywords: [] });
            return;
        }

        setIsLoading(true);
        const parsed = parseSearchQuery(currentQuery, lang);
        
        const references: ParsedItem[] = [];
        const topics: ParsedItem[] = [];
        let keywords: SearchResult[] = [];

        for (const item of parsed.items) {
            if (item.type === 'reference') {
                references.push(item);
            } else if (item.type === 'topic') {
                topics.push(item);
            }
        }

        // If it's primarily a keyword search or has keywords, perform the heavy DB search
        const keywordItems = parsed.items.filter(i => i.type === 'keyword');
        if (keywordItems.length > 0) {
            const keywordQuery = keywordItems.map(i => i.query).join(' ');
            keywords = await performKeywordSearch(keywordQuery, currentTranslationId);
        }

        setResults({ references, topics, keywords });
        setIsLoading(false);
    }, [lang, currentTranslationId]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            handleSearch(query);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, handleSearch]);

    const handleSelectReference = async (ref: ParsedItem) => {
        const bookId = ref.bookId || currentBookId;
        const chapter = ref.chapter || 1;
        
        if (ref.verse && !ref.verseEnd) {
            // Single verse
            const verse = await db.verses
                .where('[translationId+bookId+chapter]')
                .equals([currentTranslationId, bookId, chapter])
                .and(v => v.verseNumber === ref.verse)
                .first();
            
            if (verse) {
                setActiveVerse(verse);
            } else {
                // Fallback to navigating to book/chapter
                setBook(bookId);
                setChapter(chapter);
            }
        } else if (ref.verse && ref.verseEnd) {
            // Range
            const verses = await db.verses
                .where('[translationId+bookId+chapter]')
                .equals([currentTranslationId, bookId, chapter])
                .and(v => v.verseNumber >= ref.verse! && v.verseNumber <= ref.verseEnd!)
                .toArray();
            
            if (verses.length > 0) {
                setSelectedVerses(verses);
                commitToProjector();
            } else {
                setBook(bookId);
                setChapter(chapter);
            }
        } else {
            // Just chapter
            setBook(bookId);
            setChapter(chapter);
        }
        onClose();
    };

    const handleSelectTopic = async (topic: ParsedItem) => {
        // For simplicity, we navigate to the first reference in the topic
        if (topic.refs && topic.refs.length > 0) {
            const firstRef = topic.refs[0];
            setQuery(firstRef); // This will trigger a re-parse and show the ref correctly
        }
    };

    const handleSelectKeyword = (res: SearchResult) => {
        setActiveVerse(res.verse);
        onClose();
    };

    const handleUndoCorrection = useCallback(() => {
        setQuery(q => q + ' ');
    }, []);

    if (!isOpen) return null;

    const hasAnyResults = results.references.length > 0 || results.topics.length > 0 || results.keywords.length > 0;
    const isCorrectedResult = results.references.some(r => r.isCorrected);

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 pointer-events-none">
            <div
                className="fixed inset-0 bg-stone-950/40 backdrop-blur-md pointer-events-auto"
                onClick={onClose}
            />

            <div className="w-full max-w-2xl bg-stone-900/90 border border-white/10 rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden relative animate-in zoom-in-95 duration-200 pointer-events-auto flex flex-col max-h-[80vh]">
                {/* Search Header */}
                <div className="p-5 flex items-center gap-4 border-b border-white/5 bg-stone-900/50">
                    <div className={cn(
                        "p-2 rounded-xl transition-all duration-300 shrink-0",
                        isLoading ? "bg-accent/20 animate-pulse" : "bg-stone-800"
                    )}>
                        <Search className={cn("w-5 h-5", isLoading ? "text-accent" : "text-stone-400")} />
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') onClose();
                            if (e.key === 'Enter' && results.references.length > 0) handleSelectReference(results.references[0]);
                        }}
                        placeholder={t('search.placeholder', 'Search Bible, topics or phrases...')}
                        className="flex-1 bg-transparent border-none text-white focus:ring-0 placeholder:text-stone-600 text-xl font-medium min-w-0"
                    />
                </div>

                {/* Correction Banner */}
                {isCorrectedResult && (
                    <div className="px-5 py-2 bg-accent/10 border-b border-accent/20 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-accent/80 font-medium">
                            <Sparkles className="w-3 h-3" />
                            <span>{t('search.auto_corrected', 'Auto-resolved reference:')}</span>
                            <span className="text-accent underline font-bold">
                                {results.references.find(r => r.isCorrected)?.bookName}
                            </span>
                        </div>
                        <button 
                            onClick={handleUndoCorrection}
                            className="text-[10px] text-stone-500 hover:text-white uppercase tracking-wider font-bold"
                        >
                            {t('search.undo', 'Original query')}
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {hasAnyResults ? (
                        <>
                            {/* References Section */}
                            {results.references.length > 0 && (
                                <SearchSection 
                                    id="references"
                                    title={t('search.sections.references', 'References')}
                                    icon={<BookOpen className="w-4 h-4" />}
                                    isExpanded={expandedSections.references}
                                    onToggle={() => toggleSection('references')}
                                >
                                    {results.references.map((ref, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSelectReference(ref)}
                                            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="p-2 bg-stone-800 rounded-xl group-hover:bg-accent/20 transition-colors shrink-0">
                                                    <BookOpen className="w-4 h-4 text-accent" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-sm font-bold text-white truncate">
                                                        {ref.bookName || getBookName(currentBookId, lang)} {ref.chapter}
                                                        {ref.verse && `:${ref.verse}`}
                                                        {ref.verseEnd && `-${ref.verseEnd}`}
                                                    </h4>
                                                    <p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold truncate">
                                                        {ref.verseEnd ? t('search.range', 'Passage Range') : t('search.direct_jump', 'Direct Jump')}
                                                    </p>
                                                </div>
                                            </div>
                                            <CornerDownLeft className="w-4 h-4 text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                        </button>
                                    ))}
                                </SearchSection>
                            )}

                            {/* Topics Section */}
                            {results.topics.length > 0 && (
                                <SearchSection 
                                    id="topics"
                                    title={t('search.sections.topics', 'Topics & Themes')}
                                    icon={<Wand2 className="w-4 h-4" />}
                                    isExpanded={expandedSections.topics}
                                    onToggle={() => toggleSection('topics')}
                                >
                                    {results.topics.map((topic, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSelectTopic(topic)}
                                            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-stone-800 rounded-xl group-hover:bg-purple-500/20 transition-colors">
                                                    <Sparkles className="w-4 h-4 text-purple-400" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-white capitalize">{topic.query}</h4>
                                                    <p className="text-[10px] text-stone-500">
                                                        {t('search.passages_count', { count: topic.refs?.length || 0, defaultValue: '{{count}} scripture passages' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))}
                                </SearchSection>
                            )}

                            {/* Keywords Section */}
                            {results.keywords.length > 0 && (
                                <SearchSection 
                                    id="keywords"
                                    title={t('search.sections.keywords', 'Keyword Matches')}
                                    icon={<Hash className="w-4 h-4" />}
                                    isExpanded={expandedSections.keywords}
                                    onToggle={() => toggleSection('keywords')}
                                >
                                    {results.keywords.map((res, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSelectKeyword(res)}
                                            className="w-full p-4 rounded-xl hover:bg-white/5 transition-all text-left group border border-transparent hover:border-white/5"
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="text-xs font-bold text-accent">
                                                    {getBookName(res.verse.bookId, lang)} {res.verse.chapter}:{res.verse.verseNumber}
                                                </h4>
                                                {res.isDiscovery && (
                                                    <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold uppercase">
                                                        {t('search.found_in', 'Matched in')} {res.sourceTranslationId}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-stone-300 leading-relaxed" 
                                               dangerouslySetInnerHTML={{ __html: res.highlightedText }} />
                                        </button>
                                    ))}
                                </SearchSection>
                            )}
                        </>
                    ) : query ? (
                        <div className="py-20 text-center space-y-4">
                            <div className="inline-flex p-4 bg-stone-800 rounded-full animate-pulse">
                                <Search className="w-8 h-8 text-stone-600" />
                            </div>
                            <p className="text-stone-500 italic text-sm">
                                {isLoading ? t('search.searching', 'Searching...') : t('search.no_results', 'No matches found in this translation')}
                            </p>
                        </div>
                    ) : (
                        /* History / Recent State */
                        <div className="p-4 space-y-6">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-stone-600 uppercase tracking-[0.2em] px-2">
                                    <Clock className="w-3 h-3" /> {t('search.recent', 'Recent Activity')}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {history.slice(0, 6).map((verse, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setActiveVerse(verse);
                                                onClose();
                                            }}
                                            className="flex flex-col gap-1 p-3 rounded-xl bg-stone-800/20 border border-white/5 hover:border-accent/30 hover:bg-accent/5 transition-all text-left group"
                                        >
                                            <h4 className="text-xs font-bold text-stone-300 group-hover:text-accent transition-colors">
                                                {getBookName(verse.bookId, lang)} {verse.chapter}:{verse.verseNumber}
                                            </h4>
                                            <p className="text-[10px] text-stone-600 truncate">{verse.text}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-5 bg-gradient-to-br from-accent/5 to-transparent rounded-2xl border border-white/5 space-y-2">
                                <h5 className="text-xs font-bold text-stone-300 flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                                    {t('search.smart_tips.title', 'Smart Bible Intelligence')}
                                </h5>
                                <ul className="text-[10px] text-stone-500 space-y-2 leading-relaxed">
                                    <li>• <strong className="text-stone-400">Wise Parsing:</strong> {t('search.tips.shorthand', 'Type "J316" for John 3:16 or "1 J 3 1"')}</li>
                                    <li>• <strong className="text-stone-400">Ranges:</strong> {t('search.tips.ranges', 'Type "Rom 8:28-39" to select a whole passage')}</li>
                                    <li>• <strong className="text-stone-400">Batching:</strong> {t('search.tips.batch', 'Use commas: "Ps 23, Ps 91" to find multi-results')}</li>
                                    <li>• <strong className="text-stone-400">Discovery:</strong> {t('search.tips.discovery', 'Finding words in other translations works automatically!')}</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-3 bg-stone-950/80 border-t border-white/5 flex items-center justify-between backdrop-blur-sm">
                    <div className="flex gap-4">
                        <kbd className="flex items-center gap-1.5 px-2 py-1 bg-stone-800 rounded border border-white/5 text-[9px] text-stone-400 font-bold uppercase tracking-wider">
                            ESC <span className="text-stone-600">to</span> {t('search.close', 'Close')}
                        </kbd>
                        <kbd className="flex items-center gap-1.5 px-2 py-1 bg-stone-800 rounded border border-white/5 text-[9px] text-stone-400 font-bold uppercase tracking-wider">
                            ENTER <span className="text-stone-600">to</span> {t('search.navigate', 'Navigate')}
                        </kbd>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-stone-600 font-medium">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        {currentTranslationId} {t('search.active', 'Active')}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface SearchSectionProps {
    id: string;
    title: string;
    icon: React.ReactNode;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

const SearchSection: React.FC<SearchSectionProps> = ({ title, icon, isExpanded, onToggle, children }) => {
    return (
        <div className="space-y-1">
            <button 
                onClick={onToggle}
                className="w-full flex items-center justify-between px-3 py-2 text-stone-500 hover:text-stone-300 transition-colors"
            >
                <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em]">
                        {icon} {title}
                    </div>
                </div>
            </button>
            {isExpanded && (
                <div className="space-y-1 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};

export default QuickSearchModal;
