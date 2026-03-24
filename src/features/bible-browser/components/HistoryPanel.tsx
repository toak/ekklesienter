import React from 'react';
import { useTranslation } from 'react-i18next';
import { useHistoryStore } from '@/core/store/historyStore';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { Clock, History as HistoryIcon, Trash2, ChevronRight } from 'lucide-react';
import { getBookName } from '@/core/data/bookData';

const HistoryPanel: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { history, clearHistory } = useHistoryStore();
    const { setActiveVerse } = useBibleStore();
    const lang = i18n.language?.substring(0, 2) || 'en';

    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-stone-600 p-8 text-center italic">
                <Clock className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">{t('no_history', 'No history yet')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-stone-900 border-l border-stone-800">
            <div className="p-3 border-b border-stone-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <HistoryIcon className="w-4 h-4 text-amber-500" />
                    <h2 className="font-semibold text-stone-200 tracking-wide uppercase text-xs">
                        {t('history')}
                    </h2>
                </div>
                <button
                    onClick={clearHistory}
                    className="p-1.5 hover:bg-red-500/10 hover:text-red-400 text-stone-500 rounded-lg transition-all"
                    title={t('clear_history', 'Clear History')}
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {history.map((verse, index) => (
                    <button
                        key={`${verse.id}-${index}`}
                        onClick={() => setActiveVerse(verse)}
                        className="w-full text-left p-3 rounded-xl bg-stone-950/40 border border-white/5 hover:border-amber-500/30 hover:bg-stone-800/60 transition-all group"
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                                {getBookName(verse.bookId, lang)} {verse.chapter}:{verse.verseNumber}
                            </span>
                            <span className="text-[10px] text-stone-600 font-mono">
                                {verse.translationId}
                            </span>
                        </div>
                        <p className="text-xs text-stone-400 line-clamp-2 group-hover:text-stone-200 transition-colors">
                            {verse.text}
                        </p>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default HistoryPanel;
