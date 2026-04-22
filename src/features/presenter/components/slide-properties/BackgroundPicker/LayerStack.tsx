import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Plus, Eye, EyeOff, Trash2, Video } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { IStyleLayer } from '@/core/types';
import { SlideBackground } from '../../display/SlideBackground';

interface LayerStackProps {
    layers: IStyleLayer[];
    activeLayerId: string | null;
    onSelectLayer: (id: string) => void;
    onAddLayer: () => void;
    onRemoveLayer: (id: string) => void;
    onUpdateLayer: (id: string, updates: Partial<IStyleLayer>) => void;
}

export const LayerStack: React.FC<LayerStackProps> = ({
    layers,
    activeLayerId,
    onSelectLayer,
    onAddLayer,
    onRemoveLayer,
    onUpdateLayer
}) => {
    const { t } = useTranslation();

    return (
        <div className="p-4 border-b border-white/5 bg-black/40 animate-in slide-in-from-top duration-300">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-accent" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">{t('layer_stack', 'Layer Stack')}</h3>
                </div>
                <button 
                    onClick={onAddLayer} 
                    className="p-1.5 hover:bg-white/10 rounded-lg text-accent transition-all active:scale-90"
                >
                    <Plus className="w-3.5 h-3.5" />
                </button>
            </div>
            
            <div className="space-y-1 max-h-[180px] overflow-y-auto px-0.5 custom-scrollbar">
                {layers.map((layer) => (
                    <div
                        key={layer.id}
                        onClick={() => onSelectLayer(layer.id)}
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
                            <p className="text-[9px] text-stone-500 font-medium uppercase tracking-tighter">
                                {t(`blend_mode.${layer.blendMode}`, layer.blendMode)} • {Math.round(layer.opacity * 100)}%
                            </p>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { visible: !layer.visible }); }}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-stone-400 hover:text-white"
                            >
                                {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-stone-600" />}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemoveLayer(layer.id); }}
                                className="p-1.5 hover:bg-red-500/20 rounded-lg text-stone-400 hover:text-red-400"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
