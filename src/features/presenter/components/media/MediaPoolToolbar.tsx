import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, FolderPlus } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { MediaType } from '@/core/types';

interface MediaPoolToolbarProps {
  filter: MediaType | 'all';
  setFilter: (filter: MediaType | 'all') => void;
  handleImportMedia: () => void;
  handleCreateBin: () => void;
}

export const MediaPoolToolbar: React.FC<MediaPoolToolbarProps> = ({
  filter,
  setFilter,
  handleImportMedia,
  handleCreateBin
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1.5 mb-1.5 shrink-0">
      <button
        type="button"
        onClick={handleImportMedia}
        className="flex items-center gap-1.5 px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-[10px] font-semibold transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>{t('media_pool.import', 'Import')}</span>
      </button>

      <button
        type="button"
        onClick={handleCreateBin}
        className="flex items-center gap-1.5 px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-[10px] font-semibold transition-colors cursor-pointer"
      >
        <FolderPlus className="w-3.5 h-3.5" />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-0.5">
        {(['all', 'image', 'video', 'audio'] as const).map(f => (
          <button
            type="button"
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer",
              filter === f
                ? "bg-accent/15 text-accent"
                : "text-stone-500 hover:text-stone-300 hover:bg-stone-800"
            )}
          >
            {f === 'all' ? t('media_pool.all', 'All') : t(`media_pool.${f}`, f.charAt(0).toUpperCase() + f.slice(1))}
          </button>
        ))}
      </div>
    </div>
  );
};
