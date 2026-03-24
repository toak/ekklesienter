import React from 'react';
import { Edit2, Download, Trash2, RefreshCw } from 'lucide-react';
import { TFunction } from 'i18next';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { ModalType } from '@/core/store/modalStore';
import { GraceLibExportService } from '@/features/presenter/services/GraceLibExportService';
import { db } from '@/core/db';
import { ITemplateNav } from './LibraryTemplatesSection';
import { ITemplate, ITemplateSlide, IPresentationBin, IPresentationFile } from '@/core/types';

interface LibraryContextMenuProps {
    contextMenu: {
        x: number;
        y: number;
        item: any;
        type: 'template' | 'media-bin' | 'template-slide' | 'presentation-bin' | 'presentation';
    } | null;
    onClose: () => void;
    t: TFunction;
    isRu: boolean;
    devMode: boolean;
    openGlobalModal: (type: ModalType, props?: Record<string, unknown>) => void;
    updateTemplate: (id: string, data: Partial<ITemplate>, devMode: boolean) => void;
    renamePresentationBin: (id: string, name: string) => void;
    updateMediaBin: (id: string, data: Partial<{ name: string; mediaIds: string[] }>) => void;
    removeTemplate: (id: string, devMode: boolean) => Promise<void>;
    templateNavPath: ITemplateNav[];
    setTemplateNavPath: (path: ITemplateNav[]) => void;
    removePresentationBin: (id: string) => Promise<void>;
    presentationBinNavPath: string[];
    setPresentationBinNavPath: (path: string[]) => void;
    removeMediaBin: (id: string) => void;
    renameTemplateSlide: (templateId: string, slideId: string, name: string, devMode: boolean) => void;
    removeTemplateSlide: (templateId: string, slideId: string, devMode: boolean) => void;
    handleOverrideTemplateSlide: (template: ITemplate | { id: string }, slideId: string) => void;
}

export const LibraryContextMenu: React.FC<LibraryContextMenuProps> = ({
    contextMenu,
    onClose,
    t,
    isRu,
    devMode,
    openGlobalModal,
    updateTemplate,
    renamePresentationBin,
    updateMediaBin,
    removeTemplate,
    templateNavPath,
    setTemplateNavPath,
    removePresentationBin,
    presentationBinNavPath,
    setPresentationBinNavPath,
    removeMediaBin,
    renameTemplateSlide,
    removeTemplateSlide,
    handleOverrideTemplateSlide
}) => {
    if (!contextMenu) return null;

    return (
        <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={onClose}
        >
            {contextMenu.type === 'template' || contextMenu.type === 'media-bin' || contextMenu.type === 'presentation-bin' ? (
                <>
                    <ContextMenuItem
                        icon={<Edit2 className="w-3 h-3" />}
                        label={t('rename', 'Rename')}
                        onClick={() => {
                            openGlobalModal(ModalType.PROMPT, {
                                title: t('rename_item', 'New name:'),
                                defaultValue: isRu ? contextMenu.item.nameRu || contextMenu.item.name : contextMenu.item.name,
                                onSelection: (newName: string | null) => {
                                    if (newName && newName !== (isRu ? contextMenu.item.nameRu : contextMenu.item.name)) {
                                        if (contextMenu.type === 'template') {
                                            updateTemplate(contextMenu.item.id, isRu ? { nameRu: newName } : { name: newName }, devMode);
                                        } else if (contextMenu.type === 'presentation-bin') {
                                            renamePresentationBin(contextMenu.item.id, newName);
                                        } else {
                                            updateMediaBin(contextMenu.item.id, { name: newName });
                                        }
                                    }
                                }
                            });
                            onClose();
                        }}
                    />
                    <ContextMenuItem
                        icon={<Download className="w-3 h-3" />}
                        label={t('export', 'Export')}
                        onClick={() => {
                            GraceLibExportService.exportItem(contextMenu.item.id, contextMenu.type === 'template' ? 'template' : 'presentation', contextMenu.item.name);
                            onClose();
                        }}
                    />
                    <div className="h-px bg-white/5 my-1 mx-2" />
                    <ContextMenuItem
                        icon={<Trash2 className="w-3 h-3" />}
                        label={t('delete', 'Delete')}
                        danger
                        onClick={() => {
                            openGlobalModal(ModalType.CONFIRM, {
                                title: t('confirm_delete', 'Confirm Delete'),
                                message: t('confirm_remove_item', 'Remove this item?'),
                                variant: 'danger',
                                onSelection: (confirmed: boolean) => {
                                    if (confirmed) {
                                        if (contextMenu.type === 'template') {
                                            removeTemplate(contextMenu.item.id, devMode).then(() => {
                                                if (templateNavPath.some(path => path.id === contextMenu.item.id)) {
                                                    setTemplateNavPath(templateNavPath.filter(path => path.id !== contextMenu.item.id));
                                                }
                                            });
                                        } else if (contextMenu.type === 'presentation-bin') {
                                            removePresentationBin(contextMenu.item.id).then(() => {
                                                if (presentationBinNavPath.includes(contextMenu.item.id)) {
                                                    setPresentationBinNavPath(presentationBinNavPath.slice(0, presentationBinNavPath.indexOf(contextMenu.item.id)));
                                                }
                                            });
                                        } else {
                                            removeMediaBin(contextMenu.item.id);
                                        }
                                    }
                                }
                            });
                            onClose();
                        }}
                    />
                </>
            ) : contextMenu.type === 'presentation' ? (
                <>
                    <ContextMenuItem
                        icon={<Edit2 className="w-3 h-3" />}
                        label={t('rename', 'Rename')}
                        onClick={() => {
                            openGlobalModal(ModalType.PROMPT, {
                                title: t('rename_presentation', 'New name:'),
                                defaultValue: contextMenu.item.name,
                                onSelection: (newName: string | null) => {
                                    if (newName) {
                                        db.presentationFiles.update(contextMenu.item.id, { name: newName });
                                    }
                                }
                            });
                            onClose();
                        }}
                    />
                    <ContextMenuItem
                        icon={<Download className="w-3 h-3" />}
                        label={t('export', 'Export')}
                        onClick={() => {
                            GraceLibExportService.exportItem(contextMenu.item.id, 'presentation', contextMenu.item.name);
                            onClose();
                        }}
                    />
                    <div className="h-px bg-white/5 my-1 mx-2" />
                    <ContextMenuItem
                        icon={<Trash2 className="w-3 h-3" />}
                        label={t('delete', 'Delete')}
                        danger
                        onClick={() => {
                            openGlobalModal(ModalType.CONFIRM, {
                                title: t('confirm_delete', 'Confirm Delete'),
                                message: t('confirm_remove_presentation', 'Remove this presentation from library?'),
                                variant: 'danger',
                                onSelection: (confirmed: boolean) => {
                                    if (confirmed) {
                                        db.presentationFiles.delete(contextMenu.item.id);
                                    }
                                }
                            });
                            onClose();
                        }}
                    />
                </>
            ) : contextMenu.type === 'template-slide' ? (
                <>
                    <ContextMenuItem
                        icon={<RefreshCw className="w-3 h-3" />}
                        label={t('override_template_slide', "Override template's slide")}
                        onClick={() => {
                            if (contextMenu.item.slide) {
                                handleOverrideTemplateSlide({ id: contextMenu.item.templateId } as any, contextMenu.item.slide.id);
                            }
                            onClose();
                        }}
                    />
                    <div className="h-px bg-white/5 my-1 mx-2" />
                    <ContextMenuItem
                        icon={<Edit2 className="w-3 h-3" />}
                        label={t('rename_slide', 'Rename Slide')}
                        onClick={() => {
                            if (contextMenu.item.slide) {
                                const currentName = isRu ? contextMenu.item.slide.nameRu || contextMenu.item.slide.name : contextMenu.item.slide.name;
                                openGlobalModal(ModalType.PROMPT, {
                                    title: t('rename_slide', 'Rename Slide:'),
                                    defaultValue: currentName,
                                    onSelection: (newName: string | null) => {
                                        if (newName && newName !== currentName) {
                                            renameTemplateSlide(contextMenu.item.templateId, contextMenu.item.slide.id, newName, devMode);
                                        }
                                    }
                                });
                            }
                            onClose();
                        }}
                    />
                    <ContextMenuItem
                        icon={<Trash2 className="w-3 h-3" />}
                        label={t('delete_slide', 'Delete Slide')}
                        danger
                        onClick={() => {
                            if (contextMenu.item.slide) {
                                openGlobalModal(ModalType.CONFIRM, {
                                    title: t('confirm_delete_slide', 'Confirm Delete Slide'),
                                    message: t('confirm_remove_slide', 'Remove this slide from template?'),
                                    variant: 'danger',
                                    onSelection: (confirmed: boolean) => {
                                        if (confirmed) {
                                            removeTemplateSlide(contextMenu.item.templateId, contextMenu.item.slide.id, devMode);
                                        }
                                    }
                                });
                            }
                            onClose();
                        }}
                    />
                </>
            ) : null}
        </ContextMenu>
    );
};
