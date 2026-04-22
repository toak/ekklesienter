import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sliders, Eye, Link2, Play, Repeat, Volume2, VolumeX, Crop, Circle, Sun, Zap, Monitor, Smartphone, XCircle, Layers, Check } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { IStyleLayer, BLEND_MODES } from '@/core/types/style';
import { CustomSlider } from '@/components/CustomSlider';
import { CompactColorPicker } from '@/components/CompactColorPicker';
import DropdownSelector from '@/shared/ui/DropdownSelector';

interface AdjustmentPanelProps {
    activeLayer: IStyleLayer;
    onUpdateLayer: (updates: Partial<IStyleLayer>, immediate?: boolean) => void;
    onOpenCropModal: () => void;
}

const VIGNETTE_PRESETS = [
    { id: 'classic', icon: Circle, adjustments: { vignetteRadiusX: 50, vignetteRadiusY: 50, vignetteBlur: 50, dimmingOpacity: 0.5 } },
    { id: 'soft', icon: Sun, adjustments: { vignetteRadiusX: 80, vignetteRadiusY: 80, vignetteBlur: 80, dimmingOpacity: 0.4 } },
    { id: 'dramatic', icon: Zap, adjustments: { vignetteRadiusX: 40, vignetteRadiusY: 40, vignetteBlur: 30, dimmingOpacity: 0.7 } },
    { id: 'cinema', icon: Monitor, adjustments: { vignetteRadiusX: 100, vignetteRadiusY: 50, vignetteBlur: 60, dimmingOpacity: 0.6 } },
    { id: 'vertical', icon: Smartphone, adjustments: { vignetteRadiusX: 50, vignetteRadiusY: 100, vignetteBlur: 60, dimmingOpacity: 0.6 } },
    { id: 'none', icon: XCircle, adjustments: { vignetteRadiusX: 50, vignetteRadiusY: 50, vignetteBlur: 50, dimmingOpacity: 0 } },
];

export const AdjustmentPanel: React.FC<AdjustmentPanelProps> = ({
    activeLayer,
    onUpdateLayer,
    onOpenCropModal
}) => {
    const { t } = useTranslation();

    const updateAdjustments = (updates: any, immediate = false) => {
        onUpdateLayer({ adjustments: { ...(activeLayer.adjustments || {}), ...updates } }, immediate);
    };

    const updateMedia = (updates: any) => {
        onUpdateLayer({ media: { ...(activeLayer.media || {}), ...updates } });
    };

    return (
        <div className="p-4 space-y-4 pb-12">
            {/* Light & Color */}
            <div className="bg-white/2 rounded-2xl p-4 border border-white/5 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                    <Sliders className="w-3.5 h-3.5 text-accent" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">{t('light_and_color', 'Light & Color')}</h4>
                </div>
                
                <div className="grid grid-cols-1 gap-5 pt-2">
                    <CustomSlider label={t('exposure', 'Exposure')} min={-100} max={100} step={1} value={activeLayer.adjustments?.exposure ?? 0} onChange={(v: number) => updateAdjustments({ exposure: v })} />
                    <CustomSlider label={t('brightness')} min={0} max={200} step={1} value={activeLayer.adjustments?.brightness ?? 100} onChange={(v: number) => updateAdjustments({ brightness: v })} unit="%" />
                    <CustomSlider label={t('contrast')} min={0} max={200} step={1} value={activeLayer.adjustments?.contrast ?? 100} onChange={(v: number) => updateAdjustments({ contrast: v })} unit="%" />
                    <CustomSlider label={t('saturation')} min={0} max={200} step={1} value={activeLayer.adjustments?.saturation ?? 100} onChange={(v: number) => updateAdjustments({ saturation: v })} unit="%" />
                </div>
            </div>

            {/* Focus & Vignette */}
            <div className="bg-white/2 rounded-2xl p-4 border border-white/5 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">{t('effects_and_blur', 'Effects & Blur')}</h4>
                </div>
                <div className="grid grid-cols-1 gap-5 pt-2">
                    <CustomSlider label={t('blur', 'Glow / Blur')} min={0} max={100} step={1} value={activeLayer.adjustments?.blur ?? 0} onChange={(v: number) => updateAdjustments({ blur: v })} unit="px" />
                    <div className="space-y-4 pt-2">
                        <CustomSlider label={t('noise', 'Noise Intensity')} min={0} max={100} step={1} value={activeLayer.adjustments?.noise ?? 0} onChange={(v: number) => updateAdjustments({ noise: v })} unit="%" />
                        {activeLayer.adjustments?.noise !== undefined && activeLayer.adjustments.noise > 0 && (
                            <div className="grid grid-cols-2 gap-3 pb-2 pt-1 border-b border-white/5">
                                <CustomSlider label={t('scale', 'Scale')} min={1} max={100} step={1} value={activeLayer.adjustments?.noiseScale ?? 65} onChange={(v: number) => updateAdjustments({ noiseScale: v })} />
                                <CustomSlider label={t('softness', 'Softness')} min={0} max={100} step={1} value={activeLayer.adjustments?.noiseSoftness ?? 0} onChange={(v: number) => updateAdjustments({ noiseSoftness: v })} />
                            </div>
                        )}
                    </div>
                    <div className="space-y-4 pt-2 border-t border-white/5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent/40" />
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">{t('vignette', 'Vignette')}</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <DropdownSelector
                                    value={VIGNETTE_PRESETS.find(p => 
                                        activeLayer.adjustments?.dimmingOpacity === p.adjustments.dimmingOpacity && 
                                        activeLayer.adjustments?.vignetteRadiusX === p.adjustments.vignetteRadiusX
                                    )?.id || 'custom'}
                                    onChange={(id) => {
                                        const preset = VIGNETTE_PRESETS.find(p => p.id === id);
                                        if (preset) updateAdjustments(preset.adjustments, true);
                                    }}
                                    options={VIGNETTE_PRESETS.map(p => ({
                                        value: p.id,
                                        label: t(`presets.${p.id}`, p.id),
                                        icon: <p.icon className="w-3.5 h-3.5" />
                                    }))}
                                    placeholder={t('custom', 'Custom')}
                                    renderSelected={(opt) => opt?.icon || <Circle className="w-3.5 h-3.5 opacity-40" />}
                                    className="px-2 py-1.5 w-14"
                                />
                                <button
                                    onClick={() => {
                                        const linked = !(activeLayer.adjustments?.vignetteLinked ?? true);
                                        updateAdjustments({ vignetteLinked: linked });
                                    }}
                                    className={cn(
                                        "p-2 rounded-lg border transition-all active:scale-90 shrink-0",
                                        (activeLayer.adjustments?.vignetteLinked ?? true) ? "bg-accent/10 border-accent/20 text-accent" : "bg-black/40 border-white/5 text-stone-600"
                                    )}
                                >
                                    <Link2 className="w-3.5 h-3.5" />
                                </button>
                                <div className="shrink-0">
                                    <CompactColorPicker 
                                        color={activeLayer.adjustments?.dimmingColor || '#000000'} 
                                        onChange={(c: string) => updateAdjustments({ dimmingColor: c })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-5">
                            <CustomSlider 
                                label={t('opacity')} 
                                min={0} max={1} step={0.01} 
                                value={activeLayer.adjustments?.dimmingOpacity ?? 0} 
                                onChange={(v: number) => updateAdjustments({ dimmingOpacity: v })} 
                                unit="%"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <CustomSlider 
                                    label={t('radius_x')} 
                                    min={0} max={200} step={1} 
                                    value={activeLayer.adjustments?.vignetteRadiusX ?? 50} 
                                    onChange={(v: number) => {
                                        const updates: any = { vignetteRadiusX: v };
                                        if (activeLayer.adjustments?.vignetteLinked ?? true) {
                                            const oldX = activeLayer.adjustments?.vignetteRadiusX ?? 50;
                                            const oldY = activeLayer.adjustments?.vignetteRadiusY ?? 50;
                                            const ratio = oldX > 0 ? oldY / oldX : 1;
                                            updates.vignetteRadiusY = Math.round(v * ratio);
                                        }
                                        updateAdjustments(updates);
                                    }}
                                    unit="%"
                                />
                                <CustomSlider 
                                    label={t('radius_y')} 
                                    min={0} max={200} step={1} 
                                    value={activeLayer.adjustments?.vignetteRadiusY ?? 50} 
                                    onChange={(v: number) => {
                                        const updates: any = { vignetteRadiusY: v };
                                        if (activeLayer.adjustments?.vignetteLinked ?? true) {
                                            const oldX = activeLayer.adjustments?.vignetteRadiusX ?? 50;
                                            const oldY = activeLayer.adjustments?.vignetteRadiusY ?? 50;
                                            const ratio = oldY > 0 ? oldX / oldY : 1;
                                            updates.vignetteRadiusX = Math.round(v * ratio);
                                        }
                                        updateAdjustments(updates);
                                    }}
                                    unit="%"
                                />
                            </div>
                            <CustomSlider 
                                label={t('vignette_blur')} 
                                min={0} max={100} step={1} 
                                value={activeLayer.adjustments?.vignetteBlur ?? 50} 
                                onChange={(v: number) => updateAdjustments({ vignetteBlur: v })} 
                                unit="%"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Media & Framing */}
            {(activeLayer.type === 'video' || activeLayer.type === 'image') && (
                <div className="bg-white/2 rounded-2xl p-4 border border-white/5 space-y-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Play className="w-3.5 h-3.5 text-accent" />
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">{t('framing_and_playback', 'Framing & Playback')}</h4>
                    </div>
                    <div className="space-y-4">
                        <DropdownSelector
                            value={activeLayer.media?.framing || 'fill'}
                            onChange={(val) => updateMedia({ framing: val as any })}
                            options={[
                                { value: 'fill', label: t('fill', 'Fill') },
                                { value: 'fit', label: t('fit', 'Fit') },
                                { value: 'stretch', label: t('stretch', 'Stretch') },
                                { value: 'tile', label: t('tile', 'Tile') },
                            ]}
                            className="px-3 py-2"
                        />
                        {activeLayer.type === 'image' && (
                            <button
                                type="button"
                                onClick={onOpenCropModal}
                                className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-accent/10"
                            >
                                <Crop className="w-4 h-4" />
                                {activeLayer.image?.crop ? t('adjust_crop') : t('crop_image')}
                            </button>
                        )}
                        {activeLayer.type === 'video' && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => updateMedia({ isLooping: !(activeLayer.media?.isLooping ?? true) })}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                                        (activeLayer.media?.isLooping ?? true) ? "bg-accent/10 text-accent border-accent/20" : "bg-black/40 text-stone-500 border-white/5"
                                    )}
                                >
                                    <Repeat className="w-3 h-3" />
                                    {t('loop')}
                                </button>
                                <button
                                    onClick={() => updateMedia({ isMuted: !(activeLayer.media?.isMuted ?? true) })}
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

            {/* Opacity & Blend Mode */}
            <div className="bg-black/20 rounded-2xl p-4 border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500">{t('opacity_and_blending', 'Opacity & Blending')}</label>
                    <span className="text-[9px] font-mono text-accent">{Math.round((activeLayer.opacity ?? 1) * 100)}%</span>
                </div>
                <CustomSlider
                    min={0} max={1} step={0.01}
                    value={activeLayer.opacity ?? 1}
                    onChange={(val: number) => onUpdateLayer({ opacity: val })}
                />
                <DropdownSelector
                    value={activeLayer.blendMode}
                    onChange={(val) => onUpdateLayer({ blendMode: val as any })}
                    options={BLEND_MODES.map(m => ({
                        value: m.value,
                        label: t(`blend_mode.${m.value}`, m.label)
                    }))}
                    icon={<Layers className="w-3.5 h-3.5" />}
                    className="px-3 py-2.5"
                />
            </div>
        </div>
    );
};
