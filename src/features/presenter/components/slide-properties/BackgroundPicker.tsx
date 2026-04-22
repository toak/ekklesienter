import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { IStyleLayer, BackgroundSettings } from '@/core/types';
import { ensureLayers } from '@/core/utils/styleMigration';
import { Layers, Hash } from 'lucide-react';
import { BackgroundCropModal } from './BackgroundCropModal';
import { cn } from '@/core/utils/cn';
import { CompactColorPicker } from '@/components/CompactColorPicker';
import { GradientPicker } from '@/components/GradientPicker';
import { useHistoryStore } from '@/core/store/historyStore';
import { useThrottle } from '@/core/hooks/useThrottle';
import { useMediaUrl } from '@/core/hooks/useMediaUrl';

// Sub-components
import { LayerStack } from './BackgroundPicker/LayerStack';
import { TypeSelector } from './BackgroundPicker/TypeSelector';
import { MediaSourcePanel } from './BackgroundPicker/MediaSourcePanel';
import { AdjustmentPanel } from './BackgroundPicker/AdjustmentPanel';

const UNSPLASH_ACCESS_KEY = 'i-LgE2hgIfWqxDD17rja_1zoGRncuabMf6a4s0irhX0';
const PEXELS_API_KEY = 'YLQ6AjT3THV9CnA9JX0FckiITayzUi0V8HTbQ5S0rfso2tmwdTVxswYy';

interface BackgroundPickerProps {
    background: IStyleLayer[] | BackgroundSettings | undefined;
    onChange: (layers: IStyleLayer[]) => void;
    hideLayerStack?: boolean;
    defaultActiveLayerId?: string;
}

export const BackgroundPicker: React.FC<BackgroundPickerProps> = ({ 
    background, 
    onChange, 
    hideLayerStack = false, 
    defaultActiveLayerId 
}) => {
    const { t } = useTranslation();
    const layers = ensureLayers(background);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(defaultActiveLayerId || (layers.length > 0 ? layers[0].id : null));
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showAdvancedLayers, setShowAdvancedLayers] = useState(false);
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const { recentBackgrounds, addRecentBackground } = useHistoryStore();

    const [localLayers, setLocalLayers] = useState<IStyleLayer[]>(layers);
    const throttledOnChange = useThrottle(onChange, 16);

    useEffect(() => {
        if (activeLayerId && !layers.some((l) => l.id === activeLayerId)) {
            setActiveLayerId(layers.length > 0 ? layers[0].id : null);
        }
        setLocalLayers(layers);
    }, [layers, activeLayerId]);

    const activeLayer = localLayers.find((l) => l.id === activeLayerId) || localLayers[0];

    // Resolve URL for local images (from DB)
    const resolvedDbImage = useMediaUrl(
        activeLayer?.type === 'image' && activeLayer.image?.isFromDb && activeLayer.image.id
            ? { id: activeLayer.image.id, type: 'image', name: 'bg', path: '', createdAt: 0 }
            : null
    );

    const activeImageUrl = activeLayer?.type === 'image' 
        ? (activeLayer.image?.isFromDb ? resolvedDbImage : activeLayer.image?.url)
        : undefined;

    const updateLayer = (id: string, updates: Partial<IStyleLayer>, immediate = false) => {
        const nextLayers = localLayers.map(l => {
            if (l.id !== id) return l;
            if (updates.adjustments) {
                return { ...l, ...updates, adjustments: { ...(l.adjustments || {}), ...updates.adjustments } };
            }
            if (updates.media) {
                return { ...l, ...updates, media: { ...(l.media || {}), ...updates.media } };
            }
            return { ...l, ...updates };
        });

        setLocalLayers(nextLayers);
        if (immediate) onChange(nextLayers);
        else throttledOnChange(nextLayers);

        if (updates.id && id === activeLayerId) setActiveLayerId(updates.id);
    };

    const addLayer = () => {
        const newLayer: IStyleLayer = {
            id: crypto.randomUUID(),
            type: 'color',
            visible: true,
            opacity: 1,
            blendMode: 'normal',
            color: '#1c1917',
            adjustments: { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, hue: 0, blur: 0 }
        };
        onChange([newLayer, ...layers]);
        setActiveLayerId(newLayer.id);
    };

    const removeLayer = (id: string) => {
        if (layers.length <= 1) return;
        const newLayers = layers.filter((l) => l.id !== id);
        onChange(newLayers);
        if (activeLayerId === id) setActiveLayerId(newLayers[0].id);
    };

    // Shared media search logic
    const handleSearch = async (query: string) => {
        if (!query || !activeLayer) return;
        setIsLoading(true);
        try {
            if (activeLayer.type === 'image') {
                const resp = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&client_id=${UNSPLASH_ACCESS_KEY}&per_page=12`);
                const data = await resp.json();
                setSearchResults(data.results.map((r: any) => ({
                    id: r.id, url: r.urls.regular, thumb: r.urls.small, author: r.user.name, source: 'unsplash'
                })));
            } else {
                const endpoint = 'videos/search';
                const resp = await fetch(`https://api.pexels.com/v1/${endpoint}?query=${encodeURIComponent(query)}&per_page=12`, {
                    headers: { Authorization: PEXELS_API_KEY }
                });
                const data = await resp.json();
                setSearchResults(data.videos.map((v: any) => ({
                    id: v.id.toString(),
                    url: v.video_files.find((f: any) => f.quality === 'hd')?.link || v.video_files[0].link,
                    thumb: v.image,
                    source: 'pexels'
                })));
            }
        } catch (error) {
            console.error('Search failed', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeLayer) return;
        const type = activeLayer.type === 'image' ? 'image' : 'video';

        try {
            const { MediaPersistenceService } = await import('@/features/presenter/services/MediaPersistenceService');
            const stableId = await MediaPersistenceService.importMediaBlob(file, file.name, type, { forceBackground: true });
            
            const updates: Partial<IStyleLayer> = type === 'image' 
                ? { type: 'image', image: { url: null, source: 'local', id: stableId, isFromDb: true } }
                : { type: 'video', video: { url: null, source: 'local', id: stableId, isMuted: true, isLooping: true, isFromDb: true } };
            
            updateLayer(activeLayer.id, updates, true);
            addRecentBackground(updates as any);
        } catch (error) {
            console.error('Failed to save background:', error);
        }
    };

    return (
        <div className={cn("flex flex-col h-full overflow-hidden", !hideLayerStack ? "bg-[#171717] rounded-3xl border border-white/5 shadow-2xl text-white" : "")}>
            {!hideLayerStack && showAdvancedLayers && (
                <LayerStack 
                    layers={layers} 
                    activeLayerId={activeLayerId}
                    onSelectLayer={setActiveLayerId}
                    onAddLayer={addLayer}
                    onRemoveLayer={removeLayer}
                    onUpdateLayer={updateLayer}
                />
            )}

            <div className="px-4 py-3 bg-black/40 border-b border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
                        {activeLayer?.type === 'image' ? t('background_photo') 
                         : activeLayer?.type === 'video' ? t('background_motion')
                         : activeLayer?.type === 'gradient' ? t('background_gradient')
                         : t('background_picker')}
                    </h3>
                    {!hideLayerStack && (
                        <button 
                            onClick={() => setShowAdvancedLayers(!showAdvancedLayers)}
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all active:scale-95",
                                showAdvancedLayers ? "bg-accent/10 border-accent/30 text-accent" : "bg-white/5 border-white/10 text-stone-500 hover:text-stone-300"
                            )}
                        >
                            <Layers className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase tracking-widest">{t('layers')}</span>
                        </button>
                    )}
                </div>

                <TypeSelector 
                    activeLayer={activeLayer} 
                    onTypeChange={(type) => activeLayer && updateLayer(activeLayer.id, { type })} 
                />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/5 divide-y divide-white/5">
                {!activeLayer ? (
                    <div className="flex flex-col items-center justify-center h-full text-stone-500/50 p-12 space-y-2">
                        <Layers className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-[10px] uppercase font-bold tracking-widest">{t('no_layer_selected')}</span>
                    </div>
                ) : (
                    <>
                        <div className="p-4 space-y-4">
                            {activeLayer.type === 'color' && (
                                <CompactColorPicker
                                    color={activeLayer.color || '#000000'}
                                    onChange={(c: string) => {
                                        updateLayer(activeLayer.id, { color: c });
                                        addRecentBackground({ type: 'color', color: c });
                                    }}
                                />
                            )}
                            {activeLayer.type === 'gradient' && (
                                <GradientPicker
                                    from={activeLayer.gradient?.from || '#1c1917'}
                                    to={activeLayer.gradient?.to || '#000000'}
                                    angle={activeLayer.gradient?.angle ?? 135}
                                    onChange={(from: string, to: string, angle: number) => {
                                        updateLayer(activeLayer.id, { gradient: { from, to, angle } });
                                        addRecentBackground({ type: 'gradient', gradient: { from, to, angle } });
                                    }}
                                />
                            )}
                            {(activeLayer.type === 'image' || activeLayer.type === 'video') && (
                                <MediaSourcePanel 
                                    activeLayer={activeLayer}
                                    recentBackgrounds={recentBackgrounds}
                                    searchQuery={searchQuery}
                                    setSearchQuery={setSearchQuery}
                                    onSearch={handleSearch}
                                    searchResults={searchResults}
                                    isLoading={isLoading}
                                    onSelectRecent={(idx) => {
                                        const bg = recentBackgrounds[idx];
                                        if (bg.type === 'image') updateLayer(activeLayer.id, { type: 'image', image: bg.image });
                                        else if (bg.type === 'video') updateLayer(activeLayer.id, { type: 'video', video: bg.video });
                                        else if (bg.type === 'color') updateLayer(activeLayer.id, { type: 'color', color: bg.color });
                                        else if (bg.type === 'gradient') updateLayer(activeLayer.id, { type: 'gradient', gradient: bg.gradient });
                                    }}
                                    onSelectResult={(r) => {
                                        if (activeLayer.type === 'image') {
                                            const update = { type: 'image' as const, image: { url: r.url, source: r.source } };
                                            updateLayer(activeLayer.id, update);
                                            addRecentBackground(update);
                                        } else {
                                            const update = { type: 'video' as const, video: { url: r.url, source: r.source, isMuted: true, isLooping: true, thumbnail: r.thumb } };
                                            updateLayer(activeLayer.id, update);
                                            addRecentBackground(update);
                                        }
                                    }}
                                    onFileUpload={handleFileSelect}
                                />
                            )}
                            {activeLayer.type === 'noise' && (
                                <div className="bg-white/2 border border-white/5 rounded-2xl p-6 text-center shadow-inner">
                                    <Hash className="w-8 h-8 text-accent/20 mx-auto mb-2" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{t('noise_layer_active')}</p>
                                </div>
                            )}
                        </div>

                        <AdjustmentPanel 
                            activeLayer={activeLayer}
                            onUpdateLayer={(updates, immediate) => updateLayer(activeLayer.id, updates, immediate)}
                            onOpenCropModal={() => setIsCropModalOpen(true)}
                        />
                    </>
                )}
            </div>

            {activeLayer?.type === 'image' && activeImageUrl && (
                <BackgroundCropModal
                    isOpen={isCropModalOpen}
                    onClose={() => setIsCropModalOpen(false)}
                    imageUrl={activeImageUrl}
                    initialCrop={activeLayer.image?.crop}
                    onApply={(crop) => updateLayer(activeLayer.id, { image: { ...activeLayer.image!, crop } }, true)}
                />
            )}
        </div>
    );
};
