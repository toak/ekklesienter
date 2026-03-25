import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';

interface BibleSelectionChaptersProps {
  chaptersCount: number;
  selectedChapter: number;
  setSelectedChapter: (chapter: number) => void;
  setSelectedVerseNumbers: (verses: number[]) => void;
}

export const BibleSelectionChapters: React.FC<BibleSelectionChaptersProps> = ({
  chaptersCount,
  selectedChapter,
  setSelectedChapter,
  setSelectedVerseNumbers
}) => {
  const { t } = useTranslation();

  return (
    <div className="shrink-0">
      <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 block px-1">
        {t('chapter', 'Chapter')}
      </label>
      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto no-scrollbar p-0.5">
        {Array.from({ length: chaptersCount }, (_, i) => i + 1).map(ch => (
          <button
            type="button"
            key={ch}
            onClick={() => {
              setSelectedChapter(ch);
              setSelectedVerseNumbers([]);
            }}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black transition-all border cursor-pointer",
              selectedChapter === ch
                ? "bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20"
                : "bg-stone-950/50 text-stone-400 border-white/5 hover:border-white/20 hover:text-white"
            )}
          >
            {ch}
          </button>
        ))}
      </div>
    </div>
  );
};
