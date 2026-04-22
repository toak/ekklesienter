import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Upload, Image as ImageIcon, Check } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { IStyleLayer } from '@/core/types';
import { getBackgroundIdentity } from '@/core/store/historyStore';
import { SlideBackground } from '../../display/SlideBackground';
import { VideoSequencePreview } from './VideoSequencePreview';

interface MediaSourcePanelProps {
    activeLayer: IStyleLayer;
    recentBackgrounds: any[];
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    onSearch: (query: string) => void;
    searchResults: any[];
    isLoading: boolean;
    onSelectRecent: (index: number) => void;
    onSelectResult: (result: any) => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const MediaSourcePanel: React.FC<MediaSourcePanelProps> = ({
    activeLayer,
    recentBackgrounds,
    searchQuery,
    setSearchQuery,
    onSearch,
    searchResults,
    isLoading,
    onSelectRecent,
    onSelectResult,
    onFileUpload
}) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* RECENT HISTORY */}
            {recentBackgrounds.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">{t('recent_backgrounds', 'Recent')}</h4>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
                        {recentBackgrounds.map((bg, idx) => {
                            const currentIdentity = getBackgroundIdentity(bg);
                            const activeIdentity = getBackgroundIdentity(activeLayer);
                            const isSelected = !!currentIdentity && !!activeIdentity && currentIdentity === activeIdentity;

                            return (
                                <button
                                    key={`${bg.type}-${idx}`}
                                    onClick={() => onSelectRecent(idx)}
                                    className={cn(
                                        "relative w-16 aspect-video rounded-lg overflow-hidden border border-white/5 shrink-0 transition-all hover:scale-110 active:scale-95 group bg-stone-900 shadow-lg",
                                        isSelected ? "border-accent ring-1 ring-accent/30" : "hover:border-white/20"
                                    )}
                                >
                                    <div className="absolute inset-0 flex items-center justify-center opacity-20 text-stone-400">
                                        {bg.type === 'image' && <ImageIcon className="w-4 h-4" />}
                                        {bg.type === 'video' && <ImageIcon className="w-4 h-4" /* Video icon placeholder if needed */ />}
                                    </div>

                                    <div className="absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity">
                                        {bg.type === 'video' && bg.video?.thumbnailSequence ? (
                                            <VideoSequencePreview sequence={bg.video.thumbnailSequence} />
                                        ) : (
                                            <SlideBackground 
                                                background={[bg as IStyleLayer]} 
                                                showOverlay={false} 
                                            />
                                        )}
                                    </div>
                                    
                                    {isSelected && (
                                        <div className="absolute inset-0 bg-accent/20 flex items-center justify-center animate-in fade-in zoom-in duration-200 z-10">
                                            <Check className="w-4 h-4 text-white drop-shadow-md" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="relative group">
                <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    <Search className="w-3.5 h-3.5 text-stone-600 group-focus-within:text-accent" />
                </div>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSearch(searchQuery)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-stone-300 focus:outline-none focus:ring-1 focus:ring-accent/40"
                    placeholder={activeLayer.type === 'image' ? t('search_unsplash', 'Search Unsplash...') : t('search_pexels', 'Search Pexels Videos...')}
                />
            </div>

            <div className="grid grid-cols-2 gap-2">
                <label className="aspect-video rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-accent/40 transition-all group overflow-hidden relative">
                    <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Upload className="w-5 h-5 text-stone-600 mb-1 group-hover:text-accent transition-colors" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-stone-600 group-hover:text-stone-300">{t('upload', 'Upload File')}</span>
                    <input type="file" className="hidden" accept={activeLayer.type === 'image' ? 'image/*' : 'video/*'} onChange={onFileUpload} />
                </label>

                {searchResults.map((r, i) => (
                    <button
                        key={i}
                        onClick={() => onSelectResult(r)}
                        className="aspect-video rounded-xl overflow-hidden border border-white/5 hover:border-accent/40 bg-stone-900 group relative transition-all"
                    >
                        {r.thumb ? (
                            <img src={r.thumb} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 text-stone-800" />
                            </div>
                        )}
                        {((activeLayer.image?.url === r.url) || (activeLayer.video?.url === r.url)) && (
                            <div className="absolute inset-0 bg-accent/30 flex items-center justify-center">
                                <Check className="w-5 h-5 text-white drop-shadow-lg" />
                            </div>
                        )}
                    </button>
                ))}
            </div>
            {isLoading && (
                <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    );
};
