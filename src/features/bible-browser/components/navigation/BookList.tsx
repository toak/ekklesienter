import React from 'react';
import { useTranslation } from 'react-i18next';
import { Book as BookIcon, ChevronRight } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { getBookSection, getSectionColors, getBookName, SECTION_NAMES, BibleSection } from '@/core/data/bookData';
import { Book } from '@/core/types';

interface BookListProps {
  books: Book[];
  currentBookId: string;
  onBookSelect: (bookId: string) => void;
  searchQuery: string;
  lang: string;
}

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

export const BookList: React.FC<BookListProps> = ({
  books,
  currentBookId,
  onBookSelect,
  searchQuery,
  lang
}) => {
  const { t } = useTranslation();

  const getSectionName = (section: BibleSection): string => {
    return SECTION_NAMES[lang]?.[section] || SECTION_NAMES.en[section];
  };

  let lastSection: BibleSection | null = null;

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-3 pb-4 space-y-0.5 min-h-0">
      {books.map((book) => {
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
              onClick={() => onBookSelect(book.bookId)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-300 flex items-center gap-3 border shadow-sm",
                currentBookId === book.bookId
                  ? `${colors.bg} ${colors.border} ${colors.icon} font-bold shadow-[0_4px_12px_rgba(0,0,0,0.1)]`
                  : "bg-white/2 border-transparent text-stone-400 hover:bg-white/5 hover:text-stone-200"
              )}
            >
              <BookIcon className={cn("w-4 h-4 shrink-0 transition-transform duration-300", currentBookId === book.bookId ? "scale-110" : "opacity-40")} />
              <span className="truncate flex-1">
                <SearchHighlight text={getBookName(book.bookId, lang)} query={searchQuery} />
              </span>
              {currentBookId === book.bookId && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};
