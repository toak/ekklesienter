import React from 'react';
import { useTranslation } from 'react-i18next';
import { Workflow } from 'lucide-react';
import { AppMode, IServiceFile } from '@/core/types';
import { getBookName } from '@/core/data/bookData';

interface NavigationFooterProps {
  appMode: AppMode;
  currentTranslationId: string;
  currentBookId: string | null;
  currentChapter: number | null;
  activeService: IServiceFile | null;
  onBadgeClick: (element: HTMLElement | null) => void;
  lang: string;
  isRu: boolean;
}

export const NavigationFooter: React.FC<NavigationFooterProps> = ({
  appMode,
  currentTranslationId,
  currentBookId,
  currentChapter,
  activeService,
  onBadgeClick,
  lang,
  isRu
}) => {
  const { t } = useTranslation();
  const footerRef = React.useRef<HTMLButtonElement>(null);

  return (
    <div className="p-3 border-t border-white/5 bg-stone-950/40 relative z-30">
      {appMode === 'scripture' ? (
        <button
          ref={footerRef}
          onClick={() => onBadgeClick(footerRef.current)}
          className="w-full h-[60px] flex items-center gap-3 p-3 rounded-2xl bg-stone-900/40 border border-white/5 hover:border-accent/40 hover:bg-stone-800/60 transition-all group active:scale-95 shadow-xl shadow-black/20"
        >
          <div className="min-w-10 h-8 px-2 rounded-xl bg-accent flex items-center justify-center border border-accent/20 shadow-lg shadow-accent/10 shrink-0 group-hover:shadow-accent/20 transition-all">
            <span className="text-[10px] font-black text-accent-foreground uppercase">{currentTranslationId}</span>
          </div>
          <div className="flex flex-col min-w-0 text-left">
            <span className="text-[10px] font-bold text-stone-300 uppercase leading-none truncate group-hover:text-white transition-colors">
              {currentBookId ? getBookName(currentBookId, lang) : '-'}
            </span>
            <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest mt-0.5 truncate group-hover:text-stone-400">
              {currentChapter ? `${t('chapter')} ${currentChapter}` : '-'}
            </span>
          </div>
        </button>
      ) : (
        <button
          ref={footerRef}
          onClick={() => onBadgeClick(footerRef.current)}
          className="w-full h-[60px] flex items-center gap-3 p-3 rounded-2xl bg-stone-900/40 border border-white/5 hover:border-accent/40 hover:bg-stone-800/60 transition-all group active:scale-95 shadow-xl shadow-black/20"
        >
          <div className="min-w-10 h-8 px-2 rounded-xl bg-accent flex items-center justify-center border border-accent/20 shadow-lg shadow-accent/10 shrink-0 group-hover:shadow-accent/20 transition-all">
            <Workflow className="w-4 h-4 text-accent-foreground" />
          </div>
          <div className="flex flex-col min-w-0 text-left">
            <span className="text-[10px] font-bold text-stone-300 uppercase leading-none truncate group-hover:text-white transition-colors">
              {activeService ? (isRu ? activeService.nameRu : activeService.name) : t('select_service', 'Select Service')}
            </span>
            <span className="text-[8px] font-bold text-stone-600 uppercase tracking-widest mt-1 truncate group-hover:text-stone-400">
              {activeService?.fileHandle ? t('linked', 'Linked') : t('local', 'Local')}
            </span>
          </div>
        </button>
      )}
    </div>
  );
};
