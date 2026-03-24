import React from 'react';
import { Folder, FolderPlus, MoreVertical, Presentation, Trash2, Edit2, Download } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { IPresentationFile, IPresentationBin } from '@/core/types';
import PresentationSelector from './PresentationSelector';

import { TFunction } from 'i18next';

interface ILibraryPresentationsSectionProps {
    filteredPresentations: IPresentationFile[];
    filteredBins: IPresentationBin[];
    currentBinId: string | null;
    isDragging: boolean;
    isRu: boolean;
    t: TFunction;
    activePresentationId: string | null;
    handlePresentationClick: (pres: { id: string }) => void;
    pushPresentationBinNav: (id: string) => void;
    handleCreateBin: () => void;
    setContextMenu: (menu: { x: number; y: number; item: any; type: 'template' | 'media-bin' | 'template-slide' | 'presentation-bin' | 'presentation' } | null) => void;
    handleDragOver: (e: React.DragEvent) => void;
    handleDragLeave: () => void;
    handleDrop: (e: React.DragEvent) => void;
}

export const LibraryPresentationsSection: React.FC<ILibraryPresentationsSectionProps> = ({
    filteredPresentations,
    filteredBins,
    currentBinId,
    isDragging,
    isRu,
    t,
    activePresentationId,
    handlePresentationClick,
    pushPresentationBinNav,
    handleCreateBin,
    setContextMenu,
    handleDragOver,
    handleDragLeave,
    handleDrop
}) => {
    return (
        <div
            className={cn(
                "space-y-4 min-h-[400px] transition-colors rounded-2xl p-2",
                isDragging && "bg-accent/10 border-2 border-dashed border-accent/40"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">{t('bins', 'Bins')}</span>
                </div>
                <button
                    onClick={handleCreateBin}
                    className="p-1 hover:bg-white/5 rounded-lg text-stone-500 hover:text-accent transition-all"
                    title={t('new_bin', 'New Bin')}
                >
                    <FolderPlus className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-1">
                {filteredBins.map(bin => (
                    <button
                        key={bin.id}
                        onClick={() => pushPresentationBinNav(bin.id)}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                item: bin,
                                type: 'presentation-bin'
                            });
                        }}
                        className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-stone-800/50 text-stone-400 group-hover:text-accent transition-colors">
                                <Folder className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-stone-300 group-hover:text-white transition-colors">{bin.name}</span>
                                <span className="text-[10px] text-stone-500">{t('click_to_open', 'Click to open')}</span>
                            </div>
                        </div>
                        <MoreVertical className="w-4 h-4 text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                ))}
            </div>

            <div className="flex items-center justify-between px-1 pt-4">
                <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">{t('presentations', 'Presentations')}</span>
            </div>

            <div className="grid grid-cols-1 @[280px]:grid-cols-2 @[420px]:grid-cols-3 gap-3">
                {filteredPresentations.length > 0 ? (
                    filteredPresentations.map((p: IPresentationFile) => (
                        <button
                            key={p.id}
                            draggable
                            onDragStart={(e) => {
                                e.stopPropagation();
                                e.dataTransfer.setData('application/json', JSON.stringify({
                                    source: 'presentation-library',
                                    presentationId: p.id
                                }));
                                e.dataTransfer.effectAllowed = 'copyMove';
                            }}
                            onClick={() => handlePresentationClick(p)}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    item: p,
                                    type: 'presentation'
                                });
                            }}
                            className="bg-stone-900/60 border border-white/5 rounded-2xl overflow-hidden group hover:border-accent/40 transition-all aspect-video shadow-lg shadow-black/20 relative"
                        >
                            {p.thumbnailUrl ? (
                                <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-stone-800/40">
                                    <Presentation className="w-6 h-6 text-stone-600 group-hover:text-accent/60 transition-colors" />
                                </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/80 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 p-2">
                                <span className="text-[10px] font-bold text-white uppercase tracking-tight truncate block mb-1">
                                    {p.name}
                                </span>
                                <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest block">
                                    {new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(new Date(p.updatedAt || p.createdAt))}
                                </span>
                            </div>
                        </button>
                    ))
                ) : (
                    <div className="p-8 border border-white/5 border-dashed rounded-2xl flex flex-col items-center justify-center text-center gap-3 bg-stone-900/20">
                        <Presentation className="w-8 h-8 text-stone-700" />
                        <div className="flex flex-col gap-1">
                            <span className="text-sm text-stone-500 font-medium">{t('no_presentations', 'No presentations')}</span>
                            <span className="text-xs text-stone-600 max-w-[200px]">{t('no_presentations_desc', 'Import files or drag them from the service selector to build your library')}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
