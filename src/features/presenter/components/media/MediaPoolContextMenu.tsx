import React from 'react';
import { useTranslation } from 'react-i18next';
import { Edit2, Trash2 } from 'lucide-react';
import { db } from '@/core/db';
import { IMediaItem, IMediaBin } from '@/core/types';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useShallow } from 'zustand/react/shallow';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';

export interface IMediaContextMenu {
  x: number;
  y: number;
  kind: 'item';
  item: IMediaItem;
}

export interface IBinContextMenu {
  x: number;
  y: number;
  kind: 'bin';
  bin: IMediaBin;
}

export type ContextMenuState = IMediaContextMenu | IBinContextMenu | null;

interface MediaPoolContextMenuProps {
  contextMenu: ContextMenuState;
  onClose: () => void;
  selectedIds: Set<string>;
  handleBulkDelete: () => void;
  activeBinId: string | null;
  setActiveBinId: (id: string | null) => void;
}

export const MediaPoolContextMenu: React.FC<MediaPoolContextMenuProps> = ({
  contextMenu,
  onClose,
  selectedIds,
  handleBulkDelete,
  activeBinId,
  setActiveBinId
}) => {
  const { t } = useTranslation();
  const { openModal } = useModalStore(useShallow(s => ({ openModal: s.openModal })));

  if (!contextMenu) return null;

  return (
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      onClose={onClose}
    >
      {contextMenu.kind === 'item' && (
        <>
          <ContextMenuItem
            icon={<Edit2 className="w-3 h-3" />}
            label={t('media_pool.rename', 'Rename')}
            onClick={() => {
              openModal(ModalType.PROMPT, {
                title: t('media_pool.rename', 'Rename Asset'),
                defaultValue: contextMenu.item.name,
                onSelection: (name: string | null) => {
                  if (name) db.mediaPool.update(contextMenu.item.id, { name });
                }
              });
              onClose();
            }}
          />
          <ContextMenuItem
            icon={<Trash2 className="w-3 h-3" />}
            label={selectedIds.size > 1 && selectedIds.has(contextMenu.item.id) 
              ? t('media_pool.delete_multiple', 'Delete Selected') 
              : t('media_pool.delete', 'Delete')}
            danger
            onClick={() => {
              if (selectedIds.size > 1 && selectedIds.has(contextMenu.item.id)) {
                handleBulkDelete();
              } else {
                openModal(ModalType.CONFIRM, {
                  title: t('media_pool.delete', 'Delete Asset'),
                  message: t('media_pool.confirm_delete', 'Delete this asset?'),
                  onSelection: (confirmed: boolean) => {
                    if (confirmed) db.mediaPool.delete(contextMenu.item.id);
                  }
                });
              }
              onClose();
            }}
          />
        </>
      )}
      {contextMenu.kind === 'bin' && (
        <>
          <ContextMenuItem
            icon={<Edit2 className="w-3 h-3" />}
            label={t('media_pool.rename_bin', 'Rename Bin')}
            onClick={() => {
              openModal(ModalType.PROMPT, {
                title: t('media_pool.rename_bin', 'Rename Bin'),
                defaultValue: contextMenu.bin.name,
                onSelection: (name: string | null) => {
                  if (name) db.mediaBins.update(contextMenu.bin.id, { name });
                }
              });
              onClose();
            }}
          />
          <ContextMenuItem
            icon={<Trash2 className="w-3 h-3" />}
            label={t('media_pool.delete_bin', 'Delete Bin')}
            danger
            onClick={() => {
              openModal(ModalType.CONFIRM, {
                title: t('media_pool.delete_bin', 'Delete Bin'),
                message: t('media_pool.confirm_delete_bin', 'Delete this bin and move items to root?'),
                onSelection: async (confirmed: boolean) => {
                  if (confirmed) {
                    await db.mediaPool.where('binId').equals(contextMenu.bin.id).modify({ binId: undefined });
                    await db.mediaBins.delete(contextMenu.bin.id);
                    if (activeBinId === contextMenu.bin.id) setActiveBinId(null);
                  }
                }
              });
              onClose();
            }}
          />
        </>
      )}
    </ContextMenu>
  );
};
