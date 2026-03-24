import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, CornerDownLeft, BookOpen, Clock } from 'lucide-react';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { useHistoryStore } from '@/core/store/historyStore';
import { db } from '@/core/db';
import { getBookName, BOOK_ORDER } from '@/core/data/bookData';
import { cn } from '@/core/utils/cn';

interface QuickSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const QuickSearchModal: React.FC<QuickSearchModalProps> = ({ isOpen, onClose }) => {
    const { t, i18n } = useTranslation();
    const { currentBookId, setBook, setChapter, setActiveVerse, currentTranslationId } = useBibleStore();
    const { history } = useHistoryStore();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const lang = i18n.language?.substring(0, 2) || 'en';

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Parsing logic: "Book Chapter Verse" or "Chapter Verse"
    const parsed = useMemo(() => {
        if (!query.trim()) return null;

        // Regex for: [BookName] [Chapter] [Verse]
        // Group 1: Book (optional), Group 2: Chapter, Group 3: Verse (optional)
        const regex = /^([a-zA-Zа-яА-Я0-9\s]+)?\s*(\d+)(?:[:\s]+(\d+))?$/;
        const match = query.trim().match(regex);

        if (!match) return null;

        return {
            bookPart: match[1]?.trim(),
            chapter: parseInt(match[2]),
            verse: match[3] ? parseInt(match[3]) : 1
        };
    }, [query]);

    useEffect(() => {
        const search = async () => {
            if (!parsed) {
                setResults([]);
                return;
            }

            let targetBookId = currentBookId;

            if (parsed.bookPart) {
                // Find best match for book name
                const searchBookPart = parsed.bookPart.toLowerCase();
                const found = BOOK_ORDER.find(b => {
                    const name = getBookName(b.id, lang).toLowerCase();
                    return name.startsWith(searchBookPart) || b.id.toLowerCase() === searchBookPart;
                });

                if (found) {
                    targetBookId = found.id;
                } else {
                    // If book part specified but not found, results are ambiguous/none
                    setResults([]);
                    return;
                }
            }

            // Try to find the verse in DB
            const verse = await db.verses
                .where('[translationId+bookId+chapter]')
                .equals([currentTranslationId, targetBookId, parsed.chapter])
                .and(v => v.verseNumber === parsed.verse)
                .first();

            if (verse) {
                setResults([{ type: 'verse', data: verse }]);
            } else {
                // Just show book/chapter if verse not found?
                setResults([{ type: 'loc', bookId: targetBookId, chapter: parsed.chapter, verse: parsed.verse }]);
            }
        };

        search();
    }, [parsed, currentTranslationId, currentBookId, lang]);

    const handleSelect = (res: any) => {
        if (res.type === 'verse') {
            setBook(res.data.bookId);
            setChapter(res.data.chapter);
            setActiveVerse(res.data);
        } else if (res.type === 'loc') {
            setBook(res.bookId);
            setChapter(res.chapter);
            // We don't have the verse object here easily without searching again
            // but the UI will update to show that chapter/verse if we use setActiveVerse later
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
            <div
                className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="w-full max-w-2xl bg-stone-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
                <div className="p-4 flex items-center gap-3 border-b border-white/5">
                    <Search className="w-5 h-5 text-stone-500" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && results.length > 0) handleSelect(results[0]);
                            if (e.key === 'Escape') onClose();
                        }}
                        placeholder={t('quick_search_placeholder', 'Search scripture (e.g., "Jn 3:16" or "3:16")')}
                        className="flex-1 bg-transparent border-none text-white focus:ring-0 placeholder:text-stone-600 text-lg"
                    />
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {results.length > 0 ? (
                        results.map((res, i) => (
                            <button
                                key={i}
                                onClick={() => handleSelect(res)}
                                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-stone-800 rounded-lg group-hover:bg-accent/20 transition-colors">
                                        <BookOpen className="w-4 h-4 text-accent" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white">
                                            {res.type === 'verse'
                                                ? `${getBookName(res.data.bookId, lang)} ${res.data.chapter}:${res.data.verseNumber}`
                                                : `${getBookName(res.bookId, lang)} ${res.chapter}:${res.verse}`}
                                        </h4>
                                        {res.type === 'verse' && (
                                            <p className="text-xs text-stone-500 line-clamp-1 truncate max-w-md">
                                                {res.data.text}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <CornerDownLeft className="w-4 h-4 text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))
                    ) : query ? (
                        <div className="py-12 text-center text-stone-600 italic text-sm">
                            {t('no_results', 'No results found')}
                        </div>
                    ) : (
                        <div className="space-y-4 p-4">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                                <Clock className="w-3 h-3" /> {t('recent_history', 'Recent')}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {history.slice(0, 4).map((verse, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSelect({ type: 'verse', data: verse })}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-stone-950/40 border border-white/5 hover:border-white/10 transition-all text-left"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-bold text-stone-300 truncate">
                                                {getBookName(verse.bookId, lang)} {verse.chapter}:{verse.verseNumber}
                                            </h4>
                                            <p className="text-[10px] text-stone-600 truncate">{verse.text}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-3 bg-stone-950/50 border-t border-white/5 flex items-center justify-between">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1.5 text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                            <span className="px-1.5 py-0.5 bg-stone-800 rounded text-stone-400">ESC</span> {t('close', 'Close')}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                            <span className="px-1.5 py-0.5 bg-stone-800 rounded text-stone-400">↵</span> {t('navigate', 'Navigate')}
                        </div>
                    </div>
                    <div className="text-[10px] text-stone-600 italic">
                        {t('search_hint', 'Hint: Try "Jn 3 16"')}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuickSearchModal;
