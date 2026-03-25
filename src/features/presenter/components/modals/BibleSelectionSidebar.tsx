import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { getBookName } from '@/core/data/bookData';

interface BibleSelectionSidebarProps {
  translations: any[];
  sortedBooks: any[];
  selectedTranslationId: string;
  selectedBookId: string;
  setSelectedTranslationId: (id: string) => void;
  setSelectedBookId: (id: string) => void;
  setSelectedChapter: (chapter: number) => void;
  setSelectedVerseNumbers: (verses: number[]) => void;
  lang: string;
}

export const BibleSelectionSidebar: React.FC<BibleSelectionSidebarProps> = ({
  translations,
  sortedBooks,
  selectedTranslationId,
  selectedBookId,
  setSelectedTranslationId,
  setSelectedBookId,
  setSelectedChapter,
  setSelectedVerseNumbers,
  lang
}) => {
  const { t } = useTranslation();

  return (
    <div className="w-[160px] shrink-0 flex flex-col gap-3 min-w-0">
      {/* Translation selector */}
      <div className="shrink-0">
        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 block px-1">
          {t('translation', 'Translation')}
        </label>
        <div className="bg-stone-950/50 border border-white/5 rounded-2xl p-1 max-h-28 overflow-y-auto no-scrollbar">
          {translations.map(tr => (
            <button
              type="button"
              key={tr.id}
              onClick={() => {
                setSelectedTranslationId(tr.id);
                setSelectedBookId('');
                setSelectedChapter(1);
                setSelectedVerseNumbers([]);
              }}
              className={cn(
                "w-full px-3 py-1.5 rounded-xl text-left text-[11px] font-bold transition-all flex items-center justify-between cursor-pointer",
                selectedTranslationId === tr.id
                  ? "bg-amber-500 text-black"
                  : "text-stone-400 hover:bg-white/5 hover:text-stone-200"
              )}
            >
              <span className="truncate">{tr.name}</span>
              {selectedTranslationId === tr.id && <Check className="w-3 h-3 shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Books */}
      <div className="flex-1 flex flex-col min-h-0">
        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 block px-1 shrink-0">
          {t('book', 'Book')}
        </label>
        <div className="flex-1 overflow-y-auto no-scrollbar bg-stone-950/50 border border-white/5 rounded-2xl p-1 space-y-0.5">
          {sortedBooks.map(book => (
            <button
              type="button"
              key={book.id}
              onClick={() => {
                setSelectedBookId(book.bookId);
                setSelectedChapter(1);
                setSelectedVerseNumbers([]);
              }}
              className={cn(
                "w-full px-3 py-2 rounded-xl text-left text-[11px] font-bold transition-all cursor-pointer",
                selectedBookId === book.bookId
                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                  : "text-stone-400 hover:bg-white/5 hover:text-stone-200 border border-transparent"
              )}
            >
              {getBookName(book.bookId, lang)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
