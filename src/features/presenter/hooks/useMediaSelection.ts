import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '@/core/db';
import { IMediaItem } from '@/core/types';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useShallow } from 'zustand/react/shallow';

export interface UseMediaSelectionReturn {
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleItemClick: (itemId: string, e: React.MouseEvent) => void;
  handleBulkDelete: () => void;
}

/**
 * Hook to manage media selection, bulk actions, and keyboard shortcuts.
 */
export function useMediaSelection(visibleItems: IMediaItem[]): UseMediaSelectionReturn {
  const { t } = useTranslation();
  const { openModal } = useModalStore(useShallow(s => ({ openModal: s.openModal })));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const handleItemClick = (itemId: string, e: React.MouseEvent) => {
    const newSelection = new Set(selectedIds);
    
    if (e.shiftKey && lastSelectedId) {
      const currentIndex = visibleItems.findIndex(i => i.id === itemId);
      const lastIndex = visibleItems.findIndex(i => i.id === lastSelectedId);
      
      if (currentIndex !== -1 && lastIndex !== -1) {
        const start = Math.min(currentIndex, lastIndex);
        const end = Math.max(currentIndex, lastIndex);
        const rangeIds = visibleItems.slice(start, end + 1).map(i => i.id);
        
        if (!e.metaKey && !e.ctrlKey) newSelection.clear();
        rangeIds.forEach(id => newSelection.add(id));
      }
    } else if (e.metaKey || e.ctrlKey) {
      if (newSelection.has(itemId)) {
        newSelection.delete(itemId);
      } else {
        newSelection.add(itemId);
      }
      setLastSelectedId(itemId);
    } else {
      newSelection.clear();
      newSelection.add(itemId);
      setLastSelectedId(itemId);
    }
    
    setSelectedIds(newSelection);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    
    const count = selectedIds.size;
    openModal(ModalType.CONFIRM, {
      title: t('media_pool.delete', 'Delete Assets'),
      message: count === 1 
        ? t('media_pool.confirm_delete', 'Delete this asset?')
        : t('media_pool.confirm_delete_multiple', 'Delete {{count}} assets?', { count }),
      onSelection: (confirmed: boolean) => {
        if (confirmed) {
          db.mediaPool.bulkDelete(Array.from(selectedIds));
          setSelectedIds(new Set());
        }
      }
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) handleBulkDelete();
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(visibleItems.map(i => i.id)));
      }
      
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, visibleItems]);

  return {
    selectedIds,
    setSelectedIds,
    handleItemClick,
    handleBulkDelete
  };
}
