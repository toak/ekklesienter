import React from 'react';
import { useTranslation } from 'react-i18next';
import { Hash, BookOpen } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { getSectionColors } from '@/core/data/bookData';
import { Book } from '@/core/types';

interface ChapterGridProps {
  currentBook: Book | null;
  currentChapter: number;
  onChapterSelect: (chapter: number) => void;
}

export const ChapterGrid: React.FC<ChapterGridProps> = ({
  currentBook,
  currentChapter,
  onChapterSelect
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
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
                  onClick={() => onChapterSelect(chap)}
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
    </div>
  );
};
