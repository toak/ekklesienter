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

import { SlideBackground } from './display/SlideBackground';

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
    const [viewMode, setViewMode] = useState<'layers' | 'selection'>('layers');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'selection' | 'adjustments'>('selection');

    // Sync activeLayerId if layers change and current activeLayerId is not found
    useEffect(() => {
        if (activeLayerId && !layers.some(l => l.id === activeLayerId)) {
            if (layers.length > 0) setActiveLayerId(layers[0].id);
            else setActiveLayerId(null);
        }
    }, [layers, activeLayerId]);

    const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];

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
        const newLayers = layers.filter(l => l.id !== id);
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
            setSearchResults(data.results.map((r: any) => ({
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
                setSearchResults(data.photos.map((p: any) => ({ id: p.id.toString(), url: p.src.large, thumb: p.src.small, source: 'pexels' })));
            } else {
                setSearchResults(data.videos.map((v: any) => ({ id: v.id.toString(), url: v.video_files.find((f: any) => f.quality === 'hd')?.link || v.video_files[0].link, thumb: v.image, source: 'pexels' })));
            }
        } catch (error) { console.error('Pexels search failed', error); } finally { setIsLoading(false); }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const id = crypto.randomUUID();
        try {
            await db.backgrounds.put({ id, name: file.name, data: file, mimeType: file.type });
            // Do not pass temporary blob URL to persistent state, as it becomes invalid after refresh.
            // Component is responsible for loading from DB using the ID.
            if (type === 'image') updateLayer(activeLayer.id, { type: 'image', image: { url: '', source: 'local', id, isFromDb: true } });
            else updateLayer(activeLayer.id, { type: 'video', video: { url: '', source: 'local', id, isMuted: true, isLooping: true, isFromDb: true } });
        } catch (error) {
            console.error('Failed to save background to DB:', error);
        }
    };

    return (
        <div className={cn("flex flex-col h-full overflow-hidden", !hideLayerStack ? "bg-[#171717] rounded-3xl border border-white/5 shadow-2xl text-white" : "")}>
            {/* FIGMA-LIKE LAYER STACK */}
            {!hideLayerStack && (
                <div className="p-4 border-b border-white/5 bg-black/40">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">{t('fills_and_layers', 'Fills & Layers')}</h3>
                        <button onClick={addLayer} className="p-1.5 hover:bg-white/10 rounded-lg text-accent transition-all active:scale-90">
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="space-y-1 max-h-[180px] overflow-y-auto px-0.5 custom-scrollbar">
                        {layers.map((layer, idx) => (
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
                                    {layer.type === 'image' && <img src={layer.image?.url} className="w-full h-full object-cover" />}
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
                                    <div className="p-1.5 text-stone-700 cursor-grab active:cursor-grabbing">
                                        <GripVertical className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* LARGE PREVIEW HEADER (when layer stack is hidden) */}
            {hideLayerStack && activeLayer && (
                <div className="p-4 bg-black/40 border-b border-white/5 flex flex-col items-center">
                    <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-stone-800 relative shadow-inner">
                        <SlideBackground background={[activeLayer]} showOverlay={false} />
                        {/* Checkered pattern underneath for transparency */}
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMzMzIj48L3JlY3Q+CjxyZWN0IHg9IjQiIHk9IjQiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMzMzMiPjwvcmVjdD4KPC9zdmc+')] opacity-20 -z-10" />
                    </div>
                </div>
            )}

            {/* TAB SELECTOR (Adjustments vs Selection) */}
            <div className="flex border-b border-white/5 bg-black/10 p-1">
                {[
                    { id: 'selection', icon: Palette, label: t('content', 'Content') },
                    { id: 'adjustments', icon: Sliders, label: t('adjustments', 'Adjustments') }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            activeTab === tab.id ? "bg-white/5 text-white shadow-lg" : "text-stone-500 hover:text-stone-300"
                        )}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/5">
                {!activeLayer ? (
                    <div className="flex flex-col items-center justify-center h-full text-stone-500/50 space-y-2">
                        <Layers className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-[10px] uppercase font-bold tracking-widest">{t('no_layer_selected', 'No Layer Selected')}</span>
                    </div>
                ) : activeTab === 'selection' ? (
                    <div className="space-y-6">
                        {/* Layer Type Buttons */}
                        <div className="grid grid-cols-5 gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
                            {[
                                { id: 'color', icon: Palette },
                                { id: 'gradient', icon: Layers },
                                { id: 'image', icon: ImageIcon },
                                { id: 'video', icon: Video },
                                { id: 'noise', icon: Hash },
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => updateLayer(activeLayer.id, { type: t.id as any })}
                                    className={cn(
                                        "p-2.5 rounded-lg flex items-center justify-center transition-all",
                                        activeLayer.type === t.id ? "bg-accent/10 text-accent" : "text-stone-600 hover:bg-white/5 hover:text-stone-400"
                                    )}
                                >
                                    <t.icon className="w-4 h-4" />
                                </button>
                            ))}
                        </div>

                        {/* Type-Specific Selection */}
                        {activeLayer.type === 'color' && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <CompactColorPicker
                                    color={activeLayer.color || '#000000'}
                                    onChange={(c) => updateLayer(activeLayer.id, { color: c })}
                                />
                            </div>
                        )}
                        {activeLayer.type === 'gradient' && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <GradientPicker
                                    from={activeLayer.gradient?.from || '#1c1917'}
                                    to={activeLayer.gradient?.to || '#000000'}
                                    angle={activeLayer.gradient?.angle ?? 135}
                                    onChange={(from, to, angle) => updateLayer(activeLayer.id, { gradient: { from, to, angle } })}
                                />
                            </div>
                        )}
                        {(activeLayer.type === 'image' || activeLayer.type === 'video') && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                                        <Search className="w-3.5 h-3.5 text-stone-600 group-focus-within:text-accent" />
                                    </div>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (activeLayer.type === 'image' ? searchUnsplash(searchQuery) : searchPexels(searchQuery, 'video'))}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-300 focus:outline-none focus:ring-1 focus:ring-accent/40"
                                        placeholder={activeLayer.type === 'image' ? t('search_imagery_placeholder') : t('search_motion_placeholder')}
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    {searchResults.map((r, i) => (
                                        <button
                                            key={i}
                                            onClick={() => activeLayer.type === 'image'
                                                ? updateLayer(activeLayer.id, { type: 'image', image: { url: r.url, source: r.source } })
                                                : updateLayer(activeLayer.id, { type: 'video', video: { url: r.url, source: r.source, isMuted: true, isLooping: true, thumbnail: r.thumb } })
                                            }
                                            className="aspect-video rounded-lg overflow-hidden border border-white/5 hover:border-accent/40 bg-stone-900 group relative"
                                        >
                                            <img src={r.thumb} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                            {((activeLayer.image?.url === r.url) || (activeLayer.video?.url === r.url)) && <div className="absolute inset-0 bg-accent/20 flex items-center justify-center"><Check className="w-4 h-4 text-white" /></div>}
                                        </button>
                                    ))}
                                    <label className="aspect-video rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors">
                                        <Upload className="w-4 h-4 text-stone-600 mb-1" />
                                        <span className="text-[8px] font-black uppercase tracking-widest text-stone-600">{t('upload')}</span>
                                        <input type="file" className="hidden" accept={activeLayer.type === 'image' ? 'image/*' : 'video/*'} onChange={(e) => handleFileSelect(e, activeLayer.type as any)} />
                                    </label>
                                </div>
                            </div>
                        )}
                        {activeLayer.type === 'noise' && (
                            <div className="bg-white/2 border border-white/5 rounded-2xl p-4 text-center">
                                <Hash className="w-8 h-8 text-stone-600 mx-auto mb-2" />
                                <p className="text-[10px] font-bold text-stone-400">{t('noise_layer_settings', 'Noise Layer Active')}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-400">
                        {/* Blending & Opacity Bento */}
                        <div className="bg-black/20 rounded-2xl p-4 border border-white/5 space-y-4">
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500">{t('blending_mode', 'Blending Mode')}</label>
                            </div>
                            <select
                                value={activeLayer.blendMode}
                                onChange={(e) => updateLayer(activeLayer.id, { blendMode: e.target.value })}
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-stone-300 focus:outline-none"
                            >
                                {BLEND_MODES.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>

                            <CustomSlider
                                label={t('opacity')}
                                min={0}
                                max={1}
                                step={0.01}
                                value={activeLayer.opacity ?? 1}
                                onChange={(val) => updateLayer(activeLayer.id, { opacity: val })}
                                formatValue={(v) => `${Math.round(v * 100)}%`}
                            />
                        </div>

                        {/* ADJUSTMENTS BENTO GRID */}
                        <div className="grid grid-cols-1 gap-4">
                            <div className="bg-white/2 rounded-3xl p-6 border border-white/5 space-y-5 shadow-inner">
                                <div className="flex items-center gap-2 mb-2">
                                    <Settings2 className="w-3.5 h-3.5 text-accent" />
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-300">{t('visual_adjustments', 'Bento Adjustments')}</h4>
                                </div>

                                <div className="space-y-6">
                                    <CustomSlider label={t('exposure', 'Exposure')} min={-100} max={100} step={1} value={activeLayer.adjustments?.exposure ?? 0} onChange={(v) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, exposure: v } })} />
                                    <CustomSlider label={t('brightness')} min={0} max={200} step={1} value={activeLayer.adjustments?.brightness ?? 100} onChange={(v) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, brightness: v } })} unit="%" />
                                    <CustomSlider label={t('contrast')} min={0} max={200} step={1} value={activeLayer.adjustments?.contrast ?? 100} onChange={(v) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, contrast: v } })} unit="%" />
                                    <CustomSlider label={t('saturation')} min={0} max={200} step={1} value={activeLayer.adjustments?.saturation ?? 100} onChange={(v) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, saturation: v } })} unit="%" />
                                    <CustomSlider label={t('vibrance', 'Vibrance')} min={-100} max={100} step={1} value={activeLayer.adjustments?.vibrance ?? 0} onChange={(v) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, vibrance: v } })} />
                                    <CustomSlider label={t('hue', 'Hue')} min={-180} max={180} step={1} value={activeLayer.adjustments?.hue ?? 0} onChange={(v) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, hue: v } })} unit="°" />
                                    <CustomSlider label={t('blur')} min={0} max={100} step={1} value={activeLayer.adjustments?.blur ?? 0} onChange={(v) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, blur: v } })} unit="px" />
                                </div>
                            </div>
                        </div>

                        {/* Media Controls Bento - For Video/Image */}
                        {(activeLayer.type === 'video' || activeLayer.type === 'image') && (
                            <div className="bg-white/2 rounded-3xl p-6 border border-white/5 space-y-5 shadow-inner">
                                <div className="flex items-center gap-2 mb-2">
                                    <Play className="w-3.5 h-3.5 text-accent" />
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-300">{t('media_controls', 'Media Controls')}</h4>
                                </div>

                                <div className="space-y-4">
                                    {/* Framing Options */}
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500">{t('framing', 'Framing')}</label>
                                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-0.5">
                                            {(['fit', 'fill', 'stretch', 'tile'] as const).map((frame) => (
                                                <button
                                                    key={frame}
                                                    onClick={() => updateLayer(activeLayer.id, { media: { ...activeLayer.media, framing: frame } })}
                                                    className={cn(
                                                        "flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                                                        (activeLayer.media?.framing || 'fill') === frame
                                                            ? "bg-accent/10 text-accent shadow-[0_0_10px_rgba(234,179,8,0.1)] border border-accent/20"
                                                            : "text-stone-500 hover:bg-white/2 hover:text-stone-300 border border-transparent"
                                                    )}
                                                >
                                                    {t(frame, frame)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {activeLayer.type === 'video' && (
                                        <>
                                            <div className="space-y-2">
                                                <CustomSlider
                                                    label={t('speed', 'Speed')}
                                                    min={0.1} max={5.0} step={0.1}
                                                    value={activeLayer.media?.speed ?? 1.0}
                                                    onChange={(v) => updateLayer(activeLayer.id, { media: { ...activeLayer.media, speed: v } })}
                                                    formatValue={(v) => `${v.toFixed(1)}x`}
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => updateLayer(activeLayer.id, { media: { ...activeLayer.media, isLooping: !(activeLayer.media?.isLooping ?? true) } })}
                                                    className={cn(
                                                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                                                        (activeLayer.media?.isLooping ?? true) ? "bg-accent/10 text-accent border-accent/20" : "bg-black/40 text-stone-500 border-white/5 hover:border-white/10 hover:text-stone-300"
                                                    )}
                                                >
                                                    <Repeat className="w-3 h-3" />
                                                    {t('loop', 'Loop')}
                                                </button>
                                                <button
                                                    onClick={() => updateLayer(activeLayer.id, { media: { ...activeLayer.media, isMuted: !(activeLayer.media?.isMuted ?? true) } })}
                                                    className={cn(
                                                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                                                        (activeLayer.media?.isMuted ?? true) ? "bg-accent/10 text-accent border-accent/20" : "bg-black/40 text-stone-500 border-white/5 hover:border-white/10 hover:text-stone-300"
                                                    )}
                                                >
                                                    {(activeLayer.media?.isMuted ?? true) ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                                                    {t('muted', 'Muted')}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Dimming Controls - Premium Bento */}
                        <div className="bg-linear-to-br from-accent/5 to-transparent rounded-3xl p-6 border border-accent/10 space-y-4">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-accent/60">{t('layer_dimming', 'Vignette / Dimming')}</label>
                            <div className="flex items-center gap-4">
                                <div className="shrink-0">
                                    <CompactColorPicker
                                        color={activeLayer.adjustments?.dimmingColor || '#000000'}
                                        onChange={(c) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, dimmingColor: c } })}
                                    />
                                </div>
                                <div className="flex-1">
                                    <CustomSlider
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={activeLayer.adjustments?.dimmingOpacity ?? 0}
                                        onChange={(v) => updateLayer(activeLayer.id, { adjustments: { ...activeLayer.adjustments!, dimmingOpacity: v } })}
                                        formatValue={(v) => `${Math.round(v * 100)}%`}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
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

