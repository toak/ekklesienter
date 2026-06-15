import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Presentation, ChevronDown, Settings, Search, X } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { AppMode } from '@/core/types';

interface NavigationHeaderProps {
  appMode: AppMode;
  isModePickerOpen: boolean;
  onToggleModePicker: (element: HTMLElement | null) => void;
  onCloseModePicker: () => void;
  onSetAppMode: (mode: AppMode) => void;
  onOpenSettings: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const NavigationHeader: React.FC<NavigationHeaderProps> = React.memo(({
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
  const modeLabel = appMode === 'scripture' ? t('scripture') : t('presentation', 'Presentation');

  return (
    <div className="p-4 border-b border-white/5 space-y-3 shrink-0">
      <div className="flex items-center justify-between">
        <div className="relative">
          <button
            onClick={(e) => onToggleModePicker(e.currentTarget)}
            aria-label={modeLabel}
            className="group flex items-center gap-2 px-2 py-1.5 -ml-2 rounded-xl hover:bg-white/5 transition-all text-left"
          >
            <div className="p-1.5 bg-accent/20 rounded-xl group-hover:bg-accent/30 transition-colors">
              {appMode === 'scripture' ? (
                <BookOpen className="w-4 h-4 text-accent" />
              ) : (
                <Presentation className="w-4 h-4 text-accent" />
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <h2 className="font-bold text-stone-200 tracking-tight text-xs uppercase hidden @[200px]:block">
                  {modeLabel}
                </h2>
                <ChevronDown className={cn("w-3 h-3 text-stone-500 transition-transform", isModePickerOpen && "rotate-180")} />
              </div>
            </div>
          </button>
        </div>
        <button
          onClick={onOpenSettings}
          className="p-1.5 text-stone-500 hover:text-stone-200 hover:bg-white/5 rounded-xl transition-all"
          title={t('settings')}
          aria-label={t('settings')}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 group-focus-within:text-accent transition-colors" />
        <input
          type="text"
          placeholder={t('search.placeholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-stone-950/40 border border-white/5 rounded-xl py-2 pl-10 pr-10 text-sm text-stone-200 focus:outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all placeholder:text-stone-700"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-600 hover:text-stone-300 transition-colors"
            title={t('search.clear', 'Clear Search')}
            aria-label={t('search.clear', 'Clear Search')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
});

NavigationHeader.displayName = 'NavigationHeader';
