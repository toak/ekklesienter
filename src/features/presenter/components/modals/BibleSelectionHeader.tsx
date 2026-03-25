import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, X } from 'lucide-react';

interface BibleSelectionHeaderProps {
  slideId?: string;
  onClose: () => void;
}

export const BibleSelectionHeader: React.FC<BibleSelectionHeaderProps> = ({ slideId, onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-stone-900/50 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
          <BookOpen className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h2 className="text-lg font-black text-white tracking-tight uppercase">
            {slideId ? t('edit_verse', 'Edit Verse') : t('select_verse', 'Select Verse')}
          </h2>
          <p className="text-[10px] text-stone-500 font-bold uppercase tracking-[0.2em] mt-0.5">
            {t('bible_browser', 'Bible Browser')}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-stone-400 hover:text-white transition-all border border-white/5 cursor-pointer"
        aria-label={t('close', 'Close')}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};
