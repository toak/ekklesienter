import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PresenterSettings, IStyleLayer, BackgroundSettings } from '@/core/types';
import { ensureLayers } from '@/core/utils/styleMigration';

const UNSPLASH_ACCESS_KEY = 'i-LgE2hgIfWqxDD17rja_1zoGRncuabMf6a4s0irhX0';
const PEXELS_API_KEY = 'YLQ6AjT3THV9CnA9JX0FckiITayzUi0V8HTbQ5S0rfso2tmwdTVxswYy';
import { Palette, Image as ImageIcon, Video, Layers, Upload, Search, Play, Check, ChevronRight, Plus, Eye, EyeOff, Trash2, GripVertical, Sliders, Hash, Settings2, Volume2, VolumeX, Repeat } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { CustomSlider } from '@/components/CustomSlider';
import { CustomColorPicker } from '@/components/CustomColorPicker';
import { CompactColorPicker } from '@/components/CompactColorPicker';
import { GradientPicker } from '@/components/GradientPicker';
import { db } from '@/core/db';
import { useHistoryStore } from '@/core/store/historyStore';


const PRESET_GRADIENTS = [
    { from: '#020617', to: '#1e1b4b', angle: 135 }, // Night Deep
    { from: '#1e3a8a', to: '#172554', angle: 45 },  // Royal Blue
    { from: '#4c1d95', to: '#2e1065', angle: 180 }, // Royal Purple
    { from: '#064e3b', to: '#022c22', angle: 90 },  // Emerald Dark
    { from: '#1e293b', to: '#0f172a', angle: 135 }, // Slate Shadow
    { from: '#451a03', to: '#78350f', angle: 45 },  // Amber Warmth
];

const PRESET_SOLID_COLORS = [
    '#000000', '#1c1917', '#1e3a8a', '#1e1b4b', '#312e81', '#4c1d95',
    '#064e3b', '#422006', '#451a03', '#7c2d12', '#991b1b', '#111827'
];

const BLEND_MODES = [
    { value: 'normal', label: 'Normal' },
    { value: 'multiply', label: 'Multiply' },
    { value: 'screen', label: 'Screen' },
    { value: 'overlay', label: 'Overlay' },
    { value: 'darken', label: 'Darken' },
    { value: 'lighten', label: 'Lighten' },
    { value: 'color-dodge', label: 'Color Dodge' },
    { value: 'color-burn', label: 'Color Burn' },
    { value: 'hard-light', label: 'Hard Light' },
    { value: 'soft-light', label: 'Soft Light' },
    { value: 'difference', label: 'Difference' },
    { value: 'exclusion', label: 'Exclusion' },
    { value: 'hue', label: 'Hue' },
    { value: 'saturation', label: 'Saturation' },
    { value: 'color', label: 'Color' },
    { value: 'luminosity', label: 'Luminosity' },
];

import { SlideBackground } from '../display/SlideBackground';

interface BackgroundPickerProps {
    background: IStyleLayer[] | BackgroundSettings | undefined;
    onChange: (layers: IStyleLayer[]) => void;
    hideLayerStack?: boolean;
    defaultActiveLayerId?: string;
}

export const BackgroundPicker: React.FC<BackgroundPickerProps> = ({ background, onChange, hideLayerStack = false, defaultActiveLayerId }) => {
    const { t } = useTranslation();
    const layers = ensureLayers(background);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(defaultActiveLayerId || (layers.length > 0 ? layers[0].id : null));
    const [viewMode, setViewMode] = useState<'layers' | 'selection'>('selection');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showAdvancedLayers, setShowAdvancedLayers] = useState(false);
    const { recentBackgrounds, addRecentBackground } = useHistoryStore();

    // Sync activeLayerId if layers change and current activeLayerId is not found
    useEffect(() => {
        if (activeLayerId && !layers.some((l: IStyleLayer) => l.id === activeLayerId)) {
            if (layers.length > 0) setActiveLayerId(layers[0].id);
            else setActiveLayerId(null);
        }
    }, [layers, activeLayerId]);

    const activeLayer = layers.find((l: IStyleLayer) => l.id === activeLayerId) || layers[0];

    const updateLayer = (id: string, updates: Partial<IStyleLayer>) => {
        const newLayers = layers.map(l => l.id === id ? { ...l, ...updates } : l);
        onChange(newLayers);
        // If the ID was stable/placeholder and changed, update activeLayerId
        if (updates.id && id === activeLayerId) {
            setActiveLayerId(updates.id);
        }
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
        const newLayers = layers.filter((l: IStyleLayer) => l.id !== id);
        onChange(newLayers);
        if (activeLayerId === id) setActiveLayerId(newLayers[0].id);
    };

    const reorderLayers = (startIndex: number, endIndex: number) => {
        const result = Array.from(layers);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        onChange(result);
    };

    // Shared media search logic (Unsplash, Pexels)
    const searchUnsplash = async (query: string) => {
        if (!query) return;
        setIsLoading(true);
        try {
            const resp = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&client_id=${UNSPLASH_ACCESS_KEY}&per_page=12`);
            const data = await resp.json();
            setSearchResults(data.results.map((r: { id: string, urls: { regular: string, small: string }, user: { name: string } }) => ({
                id: r.id,
                url: r.urls.regular,
                thumb: r.urls.small,
                author: r.user.name,
                source: 'unsplash'
            })));
        } catch (error) { console.error('Unsplash search failed', error); } finally { setIsLoading(false); }
    };

    const searchPexels = async (query: string, type: 'image' | 'video') => {
        if (!query) return;
        setIsLoading(true);
        try {
            const endpoint = type === 'image' ? 'search' : 'videos/search';
            const resp = await fetch(`https://api.pexels.com/v1/${endpoint}?query=${encodeURIComponent(query)}&per_page=12`, {
                headers: { Authorization: PEXELS_API_KEY }
            });
            const data = await resp.json();
            if (type === 'image') {
                setSearchResults(data.photos.map((p: { id: number, src: { large: string, small: string } }) => ({ id: p.id.toString(), url: p.src.large, thumb: p.src.small, source: 'pexels' })));
            } else {
                setSearchResults(data.videos.map((v: { id: number, video_files: { quality: string, link: string }[], image: string }) => ({ id: v.id.toString(), url: v.video_files.find((f: { quality: string, link: string }) => f.quality === 'hd')?.link || v.video_files[0].link, thumb: v.image, source: 'pexels' })));
            }
        } catch (error) { console.error('Pexels search failed', error); } finally { setIsLoading(false); }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            // Use MediaPersistenceService to ensure stable ID and deduplication
            const { MediaPersistenceService } = await import('@/features/presenter/services/MediaPersistenceService');
            const stableId = await MediaPersistenceService.importMediaBlob(file, file.name, type, { forceBackground: true });
            
            if (type === 'image') {
                updateLayer(activeLayer.id, { 
                    type: 'image', 
                    image: { url: null, source: 'local', id: stableId, isFromDb: true } 
                });
                addRecentBackground({ type: 'image', image: { url: null, source: 'local', id: stableId, isFromDb: true } });
            } else {
                updateLayer(activeLayer.id, { 
                    type: 'video', 
                    video: { url: null, source: 'local', id: stableId, isMuted: true, isLooping: true, isFromDb: true } 
                });
                addRecentBackground({ type: 'video', video: { url: null, source: 'local', id: stableId, isMuted: true, isLooping: true, isFromDb: true } });
            }
        } catch (error) {
            console.error('Failed to save background via MediaPersistenceService:', error);
        }
    };

    return (
        <div className={cn("flex flex-col h-full overflow-hidden", !hideLayerStack ? "bg-[#171717] rounded-3xl border border-white/5 shadow-2xl text-white" : "")}>
            {/* FIGMA-LIKE LAYER STACK */}
            {/* FIGMA-LIKE LAYER STACK (Advanced Mode Only) */}
            {!hideLayerStack && showAdvancedLayers && (
                <div className="p-4 border-b border-white/5 bg-black/40 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5 text-accent" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">{t('layer_stack', 'Layer Stack')}</h3>
                        </div>
                        <button onClick={addLayer} className="p-1.5 hover:bg-white/10 rounded-lg text-accent transition-all active:scale-90">
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    {/* ... rest of layer list remains similar but cleaner ... */}
                    <div className="space-y-1 max-h-[180px] overflow-y-auto px-0.5 custom-scrollbar">
                        {layers.map((layer: IStyleLayer) => (
                            <div
                                key={layer.id}
                                onClick={() => setActiveLayerId(layer.id)}
                                className={cn(
                                    "group flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer",
                                    activeLayerId === layer.id
                                        ? "bg-accent/10 border-accent/20"
                                        : "bg-black/40 border-transparent hover:border-white/10"
                                )}
                            >
                                <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-stone-800">
                                    {layer.type === 'color' && <div className="w-full h-full" style={{ backgroundColor: layer.color }} />}
                                    {layer.type === 'gradient' && <div className="w-full h-full" style={{ background: `linear-gradient(${layer.gradient?.angle}deg, ${layer.gradient?.from}, ${layer.gradient?.to})` }} />}
                                    {layer.type === 'image' && (layer.image?.url || layer.image?.id) && (
                                        <div className="w-full h-full relative">
                                            <SlideBackground background={[layer]} showOverlay={false} />
                                        </div>
                                    )}
                                    {layer.type === 'video' && <div className="w-full h-full bg-black flex items-center justify-center"><Video className="w-3 h-3 text-white/50" /></div>}
                                    {layer.type === 'noise' && <div className="w-full h-full bg-neutral-900 overflow-hidden"><div className="w-full h-full opacity-50" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} /></div>}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold truncate">
                                        {layer.type === 'color' ? t('bg_solid') : layer.type === 'gradient' ? t('bg_gradient') : layer.type === 'image' ? t('bg_image') : layer.type === 'video' ? t('bg_video') : t('bg_noise')}
                                    </p>
                                    <p className="text-[9px] text-stone-500 font-medium uppercase tracking-tighter">{layer.blendMode} • {layer.opacity * 100}%</p>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }}
                                        className="p-1.5 hover:bg-white/10 rounded-lg text-stone-400 hover:text-white"
                                    >
                                        {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-stone-600" />}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
                                        className="p-1.5 hover:bg-red-500/20 rounded-lg text-stone-400 hover:text-red-400"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SIMPLIFIED HEADER & MODE SELECTOR */}
            <div className="px-4 py-3 bg-black/40 border-b border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
                        {activeLayer?.type === 'image' ? t('background_photo', 'Background Photo') 
                         : activeLayer?.type === 'video' ? t('background_motion', 'Background Motion')
                         : activeLayer?.type === 'gradient' ? t('background_gradient', 'Background Gradient')
                         : t('background_picker', 'Background Picker')}
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
                            <span className="text-[9px] font-black uppercase tracking-widest">{t('layers', 'Layers')}</span>
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-5 gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
                    {[
                        { id: 'color', icon: Palette, label: 'Solid' },
                        { id: 'gradient', icon: Layers, label: 'Grad' },
                        { id: 'image', icon: ImageIcon, label: 'Photo' },
                        { id: 'video', icon: Video, label: 'Motion' },
                        { id: 'noise', icon: Hash, label: 'Noise' },
                    ].map(type => (
                        <button
                            key={type.id}
                            onClick={() => activeLayer && updateLayer(activeLayer.id, { type: type.id as any })}
                            className={cn(
                                "flex flex-col items-center gap-1.5 py-2.5 rounded-lg transition-all",
                                activeLayer?.type === type.id 
                                    ? "bg-white/5 text-accent shadow-lg ring-1 ring-white/10" 
                                    : "text-stone-600 hover:bg-white/5 hover:text-stone-400"
                            )}
                            title={type.label}
                        >
                            <type.icon className="w-4 h-4" />
                            <span className="text-[7px] font-black uppercase tracking-tighter opacity-50">{type.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/5 divide-y divide-white/5">
                {!activeLayer ? (
                    <div className="flex flex-col items-center justify-center h-full text-stone-500/50 p-12 space-y-2">
                        <Layers className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-[10px] uppercase font-bold tracking-widest">{t('no_layer_selected', 'No Layer Selected')}</span>
                    </div>
                ) : (
                    <>
                        {/* SECTION 1: CONTENT PICKER */}
                        <div className="p-4 space-y-4">
                            {activeLayer.type === 'color' && (
                                <div className="animate-in fade-in duration-300">
                                    <CompactColorPicker
                                        color={activeLayer.color || '#000000'}
                                        onChange={(c: string) => updateLayer(activeLayer.id, { color: c })}
                                    />
                                </div>
                            )}
                            {activeLayer.type === 'gradient' && (
                                <div className="animate-in fade-in duration-300">
                                    <GradientPicker
                                        from={activeLayer.gradient?.from || '#1c1917'}
                                        to={activeLayer.gradient?.to || '#000000'}
                                        angle={activeLayer.gradient?.angle ?? 135}
                                        onChange={(from: string, to: string, angle: number) => updateLayer(activeLayer.id, { gradient: { from, to, angle } })}
                                    />
                                </div>
                            )}
                            {(activeLayer.type === 'image' || activeLayer.type === 'video') && (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    {/* RECENT HISTORY */}
                                    {recentBackgrounds.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">{t('recent_backgrounds', 'Recent')}</h4>
                                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
                                                {recentBackgrounds.map((bg, idx) => {
                                                    const isSelected = bg.type === 'image' 
                                                        ? (activeLayer.image?.id === bg.image?.id || activeLayer.image?.url === bg.image?.url)
                                                        : (activeLayer.video?.id === bg.video?.id || activeLayer.video?.url === bg.video?.url);
                                                    
                                                    const thumb = bg.type === 'image' ? bg.image?.url : bg.video?.thumbnail;
                                                    const stableId = bg.type === 'image' ? bg.image?.id : bg.video?.id;

                                                    return (
                                                        <button
                                                            key={`${bg.type}-${idx}`}
                                                            onClick={() => {
                                                                if (bg.type === 'image') updateLayer(activeLayer.id, { type: 'image', image: bg.image });
                                                                else updateLayer(activeLayer.id, { type: 'video', video: bg.video });
                                                            }}
                                                            className={cn(
                                                                "relative w-16 h-10 rounded-lg overflow-hidden border border-white/5 shrink-0 transition-all hover:scale-105 active:scale-95 group bg-stone-900",
                                                                isSelected ? "border-accent ring-1 ring-accent/30" : "hover:border-white/20"
                                                            )}
                                                        >
                                                            {thumb ? (
                                                                <img src={thumb} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    {bg.type === 'image' ? <ImageIcon className="w-4 h-4 text-stone-700" /> : <Video className="w-4 h-4 text-stone-700" />}
                                                                </div>
                                                            )}
                                                            {isSelected && <div className="absolute inset-0 bg-accent/20 flex items-center justify-center"><Check className="w-4 h-4 text-white drop-shadow-md" /></div>}
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
                                            onKeyDown={(e) => e.key === 'Enter' && (activeLayer.type === 'image' ? searchUnsplash(searchQuery) : searchPexels(searchQuery, 'video'))}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-stone-300 focus:outline-none focus:ring-1 focus:ring-accent/40"
                                            placeholder={activeLayer.type === 'image' ? t('search_unsplash', 'Search Unsplash...') : t('search_pexels', 'Search Pexels Videos...')}
                                        />
                                    </div>

                                    {/* Masonry-style Grid */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Upload Card */}
                                        <label className="aspect-video rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-accent/40 transition-all group overflow-hidden relative">
                                            <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <Upload className="w-5 h-5 text-stone-600 mb-1 group-hover:text-accent transition-colors" />
                                            <span className="text-[8px] font-black uppercase tracking-widest text-stone-600 group-hover:text-stone-300">{t('upload', 'Upload File')}</span>
                                            <input type="file" className="hidden" accept={activeLayer.type === 'image' ? 'image/*' : 'video/*'} onChange={(e) => handleFileSelect(e, activeLayer.type as any)} />
                                        </label>

                                        {searchResults.map((r, i) => (
                                            <button
                                                key={i}
                                                onClick={() => {
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
                                                className="aspect-video rounded-xl overflow-hidden border border-white/5 hover:border-accent/40 bg-stone-900 group relative transition-all"
                                            >
                                                {r.thumb ? (
                                                    <img src={r.thumb} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <ImageIcon className="w-4 h-4 text-stone-800" />
                                                    </div>
                                                )}
                                                {((activeLayer.image?.url === r.url) || (activeLayer.video?.url === r.url)) && <div className="absolute inset-0 bg-accent/30 flex items-center justify-center"><Check className="w-5 h-5 text-white drop-shadow-lg" /></div>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {activeLayer.type === 'noise' && (
                                <div className="bg-white/2 border border-white/5 rounded-2xl p-6 text-center shadow-inner">
                                    <Hash className="w-8 h-8 text-accent/20 mx-auto mb-2" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{t('noise_layer_active', 'Textured Noise Active')}</p>
                                    <p className="text-[8px] font-bold text-stone-600 mt-1">{t('adjust_noise_below', 'Use adjustments below to tune intensity')}</p>
                                </div>
                            )}
                        </div>

                        {/* SECTION 2: BENTO ADJUSTMENTS */}
                        <div className="p-4 space-y-4 pb-12">
                            {/* BENTO 1: Light & Color */}
                            <div className="bg-white/2 rounded-2xl p-4 border border-white/5 space-y-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <Sliders className="w-3.5 h-3.5 text-accent" />
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">{t('light_and_color', 'Light & Color')}</h4>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-5 pt-2">
                                    <CustomSlider label={t('exposure', 'Exposure')} min={-100} max={100} step={1} value={activeLayer.adjustments?.exposure ?? 0} onChange={(v: number) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, exposure: v } })} />
                                    <CustomSlider label={t('brightness')} min={0} max={200} step={1} value={activeLayer.adjustments?.brightness ?? 100} onChange={(v: number) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, brightness: v } })} unit="%" />
                                    <CustomSlider label={t('contrast')} min={0} max={200} step={1} value={activeLayer.adjustments?.contrast ?? 100} onChange={(v: number) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, contrast: v } })} unit="%" />
                                    <CustomSlider label={t('saturation')} min={0} max={200} step={1} value={activeLayer.adjustments?.saturation ?? 100} onChange={(v: number) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, saturation: v } })} unit="%" />
                                </div>
                            </div>

                            {/* BENTO 2: Effects & Quality */}
                            <div className="bg-white/2 rounded-2xl p-4 border border-white/5 space-y-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">{t('effects_and_blur', 'Effects & Blur')}</h4>
                                </div>
                                <div className="grid grid-cols-1 gap-5 pt-2">
                                    <CustomSlider label={t('blur', 'Glow / Blur')} min={0} max={100} step={1} value={activeLayer.adjustments?.blur ?? 0} onChange={(v: number) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, blur: v } })} unit="px" />
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 px-1">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">{t('vignette', 'Vignette')}</label>
                                            <CompactColorPicker 
                                                color={activeLayer.adjustments?.dimmingColor || '#000000'} 
                                                onChange={(c: string) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, dimmingColor: c } })}
                                            />
                                        </div>
                                        <CustomSlider 
                                            min={0} max={1} step={0.01} 
                                            value={activeLayer.adjustments?.dimmingOpacity ?? 0} 
                                            onChange={(v: number) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, dimmingOpacity: v } })} 
                                            unit="%"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* BENTO 3: Media & Framing (If applicable) */}
                            {(activeLayer.type === 'video' || activeLayer.type === 'image') && (
                                <div className="bg-white/2 rounded-2xl p-4 border border-white/5 space-y-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Play className="w-3.5 h-3.5 text-accent" />
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">{t('framing_and_playback', 'Framing & Playback')}</h4>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-0.5">
                                            {(['fit', 'fill', 'stretch', 'tile'] as const).map((frame) => (
                                                <button
                                                    key={frame}
                                                    onClick={() => updateLayer(activeLayer.id, { media: { ...activeLayer.media, framing: frame } })}
                                                    className={cn(
                                                        "flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                                        (activeLayer.media?.framing || 'fill') === frame
                                                            ? "bg-accent text-black shadow-lg"
                                                            : "text-stone-500 hover:text-stone-300"
                                                    )}
                                                >
                                                    {t(frame, frame)}
                                                </button>
                                            ))}
                                        </div>
                                        {activeLayer.type === 'video' && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => updateLayer(activeLayer.id, { media: { ...activeLayer.media, isLooping: !(activeLayer.media?.isLooping ?? true) } })}
                                                    className={cn(
                                                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                                                        (activeLayer.media?.isLooping ?? true) ? "bg-accent/10 text-accent border-accent/20" : "bg-black/40 text-stone-500 border-white/5"
                                                    )}
                                                >
                                                    <Repeat className="w-3 h-3" />
                                                    {t('loop')}
                                                </button>
                                                <button
                                                    onClick={() => updateLayer(activeLayer.id, { media: { ...activeLayer.media, isMuted: !(activeLayer.media?.isMuted ?? true) } })}
                                                    className={cn(
                                                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                                                        (activeLayer.media?.isMuted ?? true) ? "bg-accent/10 text-accent border-accent/20" : "bg-black/40 text-stone-500 border-white/5"
                                                    )}
                                                >
                                                    {(activeLayer.media?.isMuted ?? true) ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                                                    {t('muted')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Advanced Options (Opacity/Blend) */}
                            <div className="bg-black/20 rounded-2xl p-4 border border-white/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500">{t('opacity_and_blending', 'Opacity & Blending')}</label>
                                    <span className="text-[9px] font-mono text-accent">{Math.round((activeLayer.opacity ?? 1) * 100)}%</span>
                                </div>
                                <CustomSlider
                                    min={0} max={1} step={0.01}
                                    value={activeLayer.opacity ?? 1}
                                    onChange={(val: number) => updateLayer(activeLayer.id, { opacity: val })}
                                />
                                <select
                                    value={activeLayer.blendMode}
                                    onChange={(e) => updateLayer(activeLayer.id, { blendMode: e.target.value })}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-stone-300 focus:outline-none"
                                >
                                    {BLEND_MODES.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* FIGMA-LIKE FOOTER */}
            {!hideLayerStack && (
                <div className="p-3 bg-black/40 border-t border-white/5 flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                        <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">{layers.length} {t('layers', 'Layers')}</span>
                    </div>
                    <div className="text-[9px] font-black text-stone-600 uppercase tracking-tighter">Ekklesienter Pro</div>
                </div>
            )}
        </div>
    );
};

