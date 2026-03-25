import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { IMediaBin } from '@/core/types';

interface MediaPoolBreadcrumbProps {
  activeBinId: string | null;
  activeBin: IMediaBin | null | undefined;
  draggingOverId: string | null;
  setActiveBinId: (id: string | null) => void;
  setDraggingOverId: (id: string | null) => void;
  handleBinDrop: (e: React.DragEvent, binId: string | undefined) => void;
}

export const MediaPoolBreadcrumb: React.FC<MediaPoolBreadcrumbProps> = ({
  activeBinId,
  activeBin,
  draggingOverId,
  setActiveBinId,
  setDraggingOverId,
  handleBinDrop
}) => {
  const { t } = useTranslation();

  if (!activeBinId) return null;

  return (
    <div className="flex items-center gap-1 mb-1.5 shrink-0 text-[10px]">
      <button
        type="button"
        onClick={() => setActiveBinId(null)}
        onDragOver={(e) => { e.preventDefault(); setDraggingOverId('root'); }}
        onDrop={(e) => handleBinDrop(e, undefined)}
        className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer",
          draggingOverId === 'root' ? "bg-accent/20 text-accent" : "text-stone-500 hover:text-stone-300"
        )}
      >
        <ChevronLeft className="w-3 h-3" />
        <span>{t('media_pool.root', 'Media Pool')}</span>
      </button>
      <ArrowRight className="w-2.5 h-2.5 text-stone-600" />
      <span className="text-stone-300 font-semibold truncate">{activeBin?.name}</span>
    </div>
  );
};
