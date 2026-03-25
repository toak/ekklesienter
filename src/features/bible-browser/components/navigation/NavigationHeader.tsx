import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Presentation, ChevronDown, Settings, Search, X } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { AppMode } from '@/core/types';

interface NavigationHeaderProps {
  appMode: AppMode;
  isModePickerOpen: boolean;
  onToggleModePicker: () => void;
  onCloseModePicker: () => void;
  onSetAppMode: (mode: AppMode) => void;
  onOpenSettings: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  appMode,
  isModePickerOpen,
  onToggleModePicker,
  onCloseModePicker,
  onSetAppMode,
  onOpenSettings,
  searchQuery,
  onSearchChange
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-4 border-b border-white/5 space-y-3 shrink-0">
      <div className="flex items-center justify-between">
        <div className="relative">
          <button
            onClick={onToggleModePicker}
            className="group flex items-center gap-2 px-2 py-1.5 -ml-2 rounded-lg hover:bg-white/5 transition-all text-left"
          >
            <div className="p-1.5 bg-accent/20 rounded-lg group-hover:bg-accent/30 transition-colors">
              {appMode === 'scripture' ? (
                <BookOpen className="w-4 h-4 text-accent" />
              ) : (
                <Presentation className="w-4 h-4 text-accent" />
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <h2 className="font-bold text-stone-200 tracking-tight text-xs uppercase">
                  {appMode === 'scripture' ? t('scripture') : t('presentation', 'Presentation')}
                </h2>
                <ChevronDown className={cn("w-3 h-3 text-stone-500 transition-transform", isModePickerOpen && "rotate-180")} />
              </div>
            </div>
          </button>

          {isModePickerOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={onCloseModePicker} />
              <div className="absolute top-full left-0 mt-1 w-48 bg-stone-900 border border-white/10 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                <button
                  onClick={() => { onSetAppMode('scripture'); onCloseModePicker(); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                    appMode === 'scripture' ? "bg-accent/10 text-accent font-bold" : "text-stone-400 hover:bg-white/5 hover:text-stone-200"
                  )}
                >
                  <BookOpen className="w-4 h-4" />
                  {t('scripture')}
                </button>
                <button
                  onClick={() => { onSetAppMode('presentation'); onCloseModePicker(); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                    appMode === 'presentation' ? "bg-accent/10 text-accent font-bold" : "text-stone-400 hover:bg-white/5 hover:text-stone-200"
                  )}
                >
                  <Presentation className="w-4 h-4" />
                  {t('presentation', 'Presentation')}
                </button>
              </div>
            </>
          )}
        </div>
        <button
          onClick={onOpenSettings}
          className="p-1.5 text-stone-500 hover:text-stone-200 hover:bg-white/5 rounded-lg transition-all"
          title={t('settings')}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 group-focus-within:text-accent transition-colors" />
        <input
          type="text"
          placeholder={t('search_placeholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-stone-950/40 border border-white/5 rounded-xl py-2 pl-10 pr-10 text-sm text-stone-200 focus:outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all placeholder:text-stone-700"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-600 hover:text-stone-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
