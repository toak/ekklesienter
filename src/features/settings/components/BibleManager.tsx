import React, { useRef, useState, useMemo } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { Upload, Trash2, CheckCircle, AlertCircle, Loader2, BookOpen, Plus, Search, ChevronDown, ChevronRight, X } from 'lucide-react';
import { BibleData } from '@/core/types';
import ParserWorker from '@/core/workers/parser.worker?worker';
import { cn } from '@/core/utils/cn';

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
                    : part
            )}
        </>
    );
};

interface BibleRowProps {
    translation: any;
    isSelected: boolean;
    searchQuery: string;
    onSelect: () => void;
    onDelete: (tId: string) => Promise<void>;
}

const BibleRow: React.FC<BibleRowProps> = ({ translation, isSelected, searchQuery, onSelect, onDelete }) => {
    const { t } = useTranslation();
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    return (
        <div
            onClick={() => !isConfirmingDelete && onSelect()}
            className={cn(
                "group/row relative w-full h-16 rounded-xl px-4 flex items-center justify-between transition-all duration-300 cursor-pointer border",
                isSelected
                    ? "bg-accent/10 border-accent/40 shadow-[0_0_20px_var(--accent-glow)] ring-1 ring-accent/20"
                    : "bg-stone-900/40 border-white/5 hover:border-white/10 hover:bg-stone-800/60"
            )}
        >
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={cn(
                    "p-2 rounded-lg shrink-0 transition-colors",
                    isSelected ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20" : "bg-stone-950 text-stone-600 group-hover/row:text-stone-400"
                )}>
                    <BookOpen className="w-4 h-4" />
                </div>

                <div className="flex flex-col min-w-0">
                    <h5 className={cn(
                        "text-sm font-bold tracking-tight truncate transition-colors",
                        isSelected ? "text-accent" : "text-stone-200"
                    )}>
                        <SearchHighlight text={translation.name} query={searchQuery} />
                    </h5>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-stone-500 truncate uppercase tracking-widest">
                            <SearchHighlight text={translation.version || t('unknown_version')} query={searchQuery} />
                        </span>
                        {isSelected && (
                            <span className="text-[10px] font-bold text-accent/60 uppercase tracking-widest flex items-center gap-1">
                                <Plus className="w-2.5 h-2.5 rotate-45" /> {t('active')}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-4">
                {isConfirmingDelete ? (
                    <div className="flex items-center gap-1 animate-in slide-in-from-right-2 duration-300" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setIsConfirmingDelete(false)}
                            className="px-2 py-1 text-[10px] font-bold text-stone-500 hover:text-stone-300 transition-colors"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={() => onDelete(translation.id)}
                            className="px-3 py-1 bg-red-500 text-white text-[10px] font-bold rounded-lg shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                        >
                            {t('confirm_delete')}
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(true); }}
                        className="p-2 text-stone-700 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover/row:opacity-100"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
};

const BibleManager: React.FC = () => {
    const { t } = useTranslation();
    const { currentTranslationId, setTranslation } = useBibleStore();
    const translations = useLiveQuery(() => db.translations.toArray()) || [];

    const [searchQuery, setSearchQuery] = useState('');
    const [openLangs, setOpenLangs] = useState<string[]>([]);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number; filename: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Grouping & Filtering Logic
    const groupedData = useMemo(() => {
        const filtered = translations.filter(tr =>
            tr.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (tr.version && tr.version.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        const groups: Record<string, typeof translations> = {};
        filtered.forEach(tr => {
            const lang = tr.language || t('unknown_lang');
            if (!groups[lang]) groups[lang] = [];
            groups[lang].push(tr);
        });

        const sortedLangs = Object.keys(groups).sort();
        return { groups, sortedLangs, totalFound: filtered.length };
    }, [translations, searchQuery]);

    const toggleLang = (lang: string) => {
        setOpenLangs(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setImporting(true);
        setError(null);
        let importedCount = 0;
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setProgress({ current: i + 1, total: files.length, filename: file.name });
                const worker = new ParserWorker();
                const data = await new Promise<BibleData>((resolve, reject) => {
                    worker.onmessage = (e) => {
                        if (e.data.type === 'success') resolve(e.data.data);
                        else if (e.data.type === 'error') reject(new Error(e.data.error));
                        worker.terminate();
                    };
                    worker.onerror = (err) => { reject(err); worker.terminate(); };
                    if (file.name.toLowerCase().endsWith('.xml')) {
                        file.text().then(text => worker.postMessage({ fileType: 'xml', content: text, fileName: file.name }));
                    } else if (file.name.toLowerCase().match(/\.sqlite3?$/)) {
                        file.arrayBuffer().then(buffer => worker.postMessage({ fileType: 'sqlite', content: buffer, fileName: file.name }));
                    } else reject(new Error(t('unsupported_format', 'Unsupported format')));
                });
                await db.transaction('rw', db.translations, db.books, db.verses, async () => {
                    await db.translations.put(data.translation);
                    await db.books.bulkPut(data.books);
                    await db.verses.bulkPut(data.verses);
                });
                importedCount++;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('import_failed', 'Import failed'));
        } finally {
            setImporting(false);
            setProgress(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (tId: string) => {
        await db.transaction('rw', db.translations, db.books, db.verses, async () => {
            await db.translations.delete(tId);
            await db.books.where('translationId').equals(tId).delete();
            await db.verses.where('translationId').equals(tId).delete();
        });
        if (currentTranslationId === tId) {
            const others = await db.translations.toArray();
            if (others.length > 0) setTranslation(others[0].id);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header / Search / Import Row */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 group-focus-within:text-accent transition-colors" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={t('search_bibles_placeholder')}
                            className="w-full bg-stone-900/60 border border-white/5 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30 transition-all"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-600 hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing}
                        className="px-6 py-3 bg-accent hover:bg-accent text-accent-foreground rounded-2xl flex items-center gap-2 text-sm font-bold transition-all shadow-lg shadow-accent/40 active:scale-95 disabled:opacity-50"
                    >
                        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {importing ? t('importing') : t('import_bibles')}
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleImport} multiple accept=".xml,.sqlite,.sqlite3" />
                    </button>
                </div>

                {importing && progress && (
                    <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-accent animate-pulse">
                        <span>{t('importing_filename', { filename: progress.filename })}</span>
                        <span>{progress.current} / {progress.total}</span>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Bible List Accordions */}
            <div className="space-y-4">
                {groupedData.sortedLangs.map(lang => (
                    <div key={lang} className="space-y-2">
                        <button
                            onClick={() => toggleLang(lang)}
                            className="w-full flex items-center justify-between px-2 py-1 group/header"
                        >
                            <div className="flex items-center gap-2">
                                {openLangs.includes(lang) ? <ChevronDown className="w-4 h-4 text-stone-500" /> : <ChevronRight className="w-4 h-4 text-stone-500" />}
                                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-[0.2em] group-hover/header:text-stone-300 transition-colors">
                                    {lang}
                                    <span className="ml-2 opacity-50 font-mono">({groupedData.groups[lang].length})</span>
                                </span>
                            </div>
                            <div className="h-px flex-1 bg-white/5 ml-4" />
                        </button>

                        {(openLangs.includes(lang) || searchQuery) && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                {groupedData.groups[lang].map(tr => (
                                    <BibleRow
                                        key={tr.id}
                                        translation={tr}
                                        isSelected={currentTranslationId === tr.id}
                                        searchQuery={searchQuery}
                                        onSelect={() => setTranslation(tr.id)}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {translations.length > 0 && groupedData.totalFound === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-stone-600 italic">
                        <Search className="w-8 h-8 opacity-20" />
                        <p className="text-sm font-medium">{t('no_versions_found', { query: searchQuery })}</p>
                    </div>
                )}

                {translations.length === 0 && (
                    <div className="text-center py-12 px-6 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center gap-4">
                        <BookOpen className="w-10 h-10 text-stone-800" />
                        <p className="text-sm text-stone-600 font-medium max-w-[200px] leading-relaxed">
                            {t('no_bibles')}
                        </p>
                    </div>
                )}
            </div>

            {searchQuery && groupedData.totalFound > 0 && (
                <div className="text-[10px] font-bold text-accent/40 uppercase tracking-widest text-center">
                    {t('search_results_found', { count: groupedData.totalFound })}
                </div>
            )}
        </div>
    );
};

export default BibleManager;
