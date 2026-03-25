import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { Verse } from '@/core/types';

interface BibleSelectionVerseListProps {
  versesInChapter: Verse[];
  selectedVerseNumbers: number[];
  handleVerseClick: (v: Verse, e: React.MouseEvent) => void;
}

export const BibleSelectionVerseList: React.FC<BibleSelectionVerseListProps> = ({
  versesInChapter,
  selectedVerseNumbers,
  handleVerseClick
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-1.5 px-1 shrink-0">
        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
          {t('verses', 'Verses')}
        </label>
        {selectedVerseNumbers.length > 0 && (
          <span className="text-[10px] font-bold text-amber-500/70">
            {selectedVerseNumbers.length} {t('selected', 'selected')}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar bg-stone-950/50 border border-white/5 rounded-2xl p-2 space-y-1">
        {versesInChapter.map(v => (
          <button
            type="button"
            key={v.id}
            onClick={(e) => handleVerseClick(v, e)}
            className={cn(
              "w-full p-2.5 rounded-xl text-left transition-all border cursor-pointer group relative overflow-hidden",
              selectedVerseNumbers.includes(v.verseNumber)
                ? "bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20"
                : "bg-stone-900/50 border-white/5 hover:border-white/10"
            )}
          >
            <div className="flex gap-2.5">
              <span className={cn(
                "text-[10px] font-black mt-0.5 shrink-0 w-5 text-right",
                selectedVerseNumbers.includes(v.verseNumber)
                  ? "text-amber-500" : "text-stone-600"
              )}>
                {v.verseNumber}
              </span>
              <p className={cn(
                "text-[11px] leading-relaxed transition-colors line-clamp-2 min-w-0",
                selectedVerseNumbers.includes(v.verseNumber)
                  ? "text-stone-100" : "text-stone-400 group-hover:text-stone-300"
              )}>
                {v.text}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
