import React from 'react';
import { Plus, Music } from 'lucide-react';
import { GraceLibBin } from './GraceLibBin';
import { IMediaBin } from '@/core/types';

import { TFunction } from 'i18next';

interface ILibraryMediaSectionProps {
    graceLibMediaBins: Array<{ id: string, name: string, mediaIds: string[] }>;
    t: TFunction;
    handleAddBin: () => void;
    setContextMenu: (menu: { x: number; y: number; item: any; type: 'template' | 'media-bin' | 'template-slide' | 'presentation-bin' | 'presentation' } | null) => void;
}

export const LibraryMediaSection: React.FC<ILibraryMediaSectionProps> = ({
    graceLibMediaBins,
    t,
    handleAddBin,
    setContextMenu
}) => {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">{t('media_bins', 'Media Bins')}</span>
                <button
                    onClick={handleAddBin}
                    className="p-1 hover:bg-white/5 rounded-lg text-stone-500 hover:text-accent transition-all"
                    title={t('new_media_bin', 'New Media Bin')}
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
                {graceLibMediaBins.map(bin => (
                    <div
                        key={bin.id}
                        className="group relative"
                        onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                item: bin,
                                type: 'media-bin'
                            });
                        }}
                    >
                        <GraceLibBin
                            id={bin.id}
                            name={bin.name}
                            icon={Music}
                            onClick={() => { }} // Could open bin content
                            count={bin.mediaIds.length}
                        />
                    </div>
                ))}

                {graceLibMediaBins.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center">
                        <div className="w-full max-w-[240px] p-6 rounded-2xl bg-stone-950/20 border border-white/5 flex flex-col items-center gap-3 text-center opacity-40 hover:opacity-100 transition-opacity">
                            <Music className="w-8 h-8 text-stone-500" />
                            <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                                {t('configure_media_bins', 'Create bins to organize local media')}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
