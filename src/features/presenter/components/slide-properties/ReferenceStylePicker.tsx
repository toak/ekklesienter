import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import {
    LayoutTemplate,
    Type,
    Palette,
    ArrowUpFromLine,
    ArrowDownFromLine,
    Check,
    Minus,
    Type as TypeIcon,
    Baseline,
    BoxSelect,
    Braces
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { CustomSlider } from '@/components/CustomSlider';
import { CompactColorPicker } from '@/components/CompactColorPicker';

import { AVAILABLE_FONTS } from '@/core/data/fonts';

export const ReferenceStylePicker: React.FC = () => {
    const { t } = useTranslation();
    const { settings: globalSettings, draftSettings, updateDraft } = usePresenterStore();

    const settings = draftSettings || globalSettings;
    const { reference } = settings;

    const updateReference = (update: Partial<typeof reference>) => {
        updateDraft({ reference: { ...reference, ...update } });
    };

    const styles = [
        { id: 'modern', label: 'Modern' },
        { id: 'classic', label: 'Classic' },
        { id: 'minimal', label: 'Minimal' },
        { id: 'accent', label: 'Accent' },
        { id: 'pill', label: 'Pill' },
        { id: 'outline', label: 'Outline' },
        { id: 'brackets', label: 'Brackets' },
        { id: 'underline', label: 'Underline' },
        { id: 'ribbon', label: 'Ribbon' },
    ] as const;

    // Mini preview component
    const StylePreview = ({ styleId, isActive }: { styleId: string, isActive: boolean }) => {
        const baseColor = isActive ? 'currentColor' : '#78716c'; // stone-500
        const accentColor = isActive ? 'currentColor' : '#a8a29e'; // stone-400

        return (
            <div className={cn(
                "w-full h-8 flex items-center justify-center relative overflow-hidden",
                // Ribbon needs specific alignment in preview too
                styleId === 'ribbon' ? "px-2 justify-start" : "px-2"
            )}>
                {/* Classic Lines */}
                {styleId === 'classic' && (
                    <div className="w-full flex items-center gap-1 opacity-60">
                        <div className="h-px flex-1 bg-linear-to-r from-transparent to-current" style={{ color: baseColor }} />
                        <span className="text-[6px] tracking-widest uppercase" style={{ color: baseColor }}>ROM 8:28</span>
                        <div className="h-px flex-1 bg-linear-to-r from-current to-transparent" style={{ color: baseColor }} />
                    </div>
                )}

                {/* Modern */}
                {styleId === 'modern' && (
                    <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: baseColor }}>ROM 8:28</span>
                )}

                {/* Minimal */}
                {styleId === 'minimal' && (
                    <span className="text-[8px] font-light tracking-wide opacity-80" style={{ color: baseColor }}>Rom 8:28</span>
                )}

                {/* Accent */}
                {styleId === 'accent' && (
                    <span className="text-[8px] font-bold tracking-widest text-accent" style={{ color: isActive ? 'currentColor' : undefined }}>ROM 8:28</span>
                )}

                {/* Brackets */}
                {styleId === 'brackets' && (
                    <span className="text-[8px] font-medium tracking-widest uppercase flex gap-1" style={{ color: accentColor }}>
                        <span className="opacity-50">[</span>
                        <span style={{ color: baseColor }}>ROM 8:28</span>
                        <span className="opacity-50">]</span>
                    </span>
                )}

                {/* Pill */}
                {styleId === 'pill' && (
                    <div className={cn(
                        "px-2 py-0.5 rounded-full text-[6px] font-bold tracking-wide",
                        isActive ? "bg-white/20 text-white" : "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
                    )}>
                        ROM 8:28
                    </div>
                )}

                {/* Outline */}
                {styleId === 'outline' && (
                    <div className={cn(
                        "px-2 py-0.5 rounded-full text-[6px] font-bold tracking-wide border",
                        isActive ? "border-white/40 text-white" : "border-stone-300 text-stone-500 dark:border-stone-700 dark:text-stone-400"
                    )}>
                        ROM 8:28
                    </div>
                )}

                {/* Underline */}
                {styleId === 'underline' && (
                    <div className={cn(
                        "pb-0.5 text-[7px] font-bold tracking-wide border-b",
                        isActive ? "border-white/50 text-white" : "border-stone-300 text-stone-500 dark:border-stone-700 dark:text-stone-400"
                    )}>
                        ROM 8:28
                    </div>
                )}

                {/* Ribbon */}
                {styleId === 'ribbon' && (
                    <div className={cn(
                        "pl-1.5 pr-2 py-0.5 text-[6px] font-bold tracking-wide border-l-2",
                        isActive
                            ? "border-white bg-linear-to-r from-white/20 to-transparent text-white"
                            : "border-stone-400 bg-linear-to-r from-stone-400/10 to-transparent text-stone-500 dark:border-stone-600 dark:text-stone-400"
                    )}>
                        ROM 8:28
                    </div>
                )}
            </div>
        );
    };

    const handleFontSelect = (family: string) => {
        updateReference({ fontFamily: family });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
            {/* ─── Position & Layout ─── */}
            <div className="bg-white/3 backdrop-blur-xl border border-white/5 rounded-3xl p-6 space-y-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-3 px-1">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                        <LayoutTemplate className="w-4 h-4 text-stone-500" />
                    </div>
                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em]">{t('position_layout', 'Position & Layout')}</label>
                </div>

                {/* Position Toggle */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-black/20 rounded-xl">
                    <button
                        onClick={() => updateReference({ position: 'top' })}
                        className={cn(
                            "flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                            reference.position === 'top'
                                ? "bg-white/10 text-white shadow-lg shadow-black/10"
                                : "text-stone-500 hover:text-stone-300 hover:bg-white/5"
                        )}
                    >
                        <ArrowUpFromLine className="w-3.5 h-3.5" />
                        {t('top', 'Top')}
                    </button>
                    <button
                        onClick={() => updateReference({ position: 'bottom' })}
                        className={cn(
                            "flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                            reference.position === 'bottom'
                                ? "bg-white/10 text-white shadow-lg shadow-black/10"
                                : "text-stone-500 hover:text-stone-300 hover:bg-white/5"
                        )}
                    >
                        <ArrowDownFromLine className="w-3.5 h-3.5" />
                        {t('bottom', 'Bottom')}
                    </button>
                </div>

                {/* Style Grid */}
                <div className="grid grid-cols-3 gap-2">
                    {styles.map((style) => (
                        <button
                            key={style.id}
                            onClick={() => updateReference({ style: style.id })}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 p-2 rounded-xl border group relative overflow-hidden h-20",
                                reference.style === style.id
                                    ? "bg-accent/15 border-accent/40 text-accent shadow-lg shadow-accent/5"
                                    : "bg-white/5 border-white/5 text-stone-500 hover:bg-white/10 hover:text-stone-300"
                            )}
                        >
                            <StylePreview styleId={style.id} isActive={reference.style === style.id} />
                            <span className="text-[9px] font-bold uppercase tracking-wider">{t(`ref_style_${style.id}`, style.label)}</span>

                            {reference.style === style.id && (
                                <div className="absolute inset-0 bg-accent/5 animate-pulse pointer-events-none" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ─── Appearance ─── */}
            <div className="bg-white/3 backdrop-blur-xl border border-white/5 rounded-3xl p-6 space-y-6 shadow-xl">
                <div className="flex items-center gap-3 px-1">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                        <Type className="w-4 h-4 text-stone-500" />
                    </div>
                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em]">{t('appearance')}</label>
                </div>

                <div className="space-y-6">
                    {/* Color Picker */}
                    <CompactColorPicker
                        label={t('reference_color', 'Reference Color')}
                        color={reference.color || '#ffffff'}
                        onChange={(color) => updateReference({ color })}
                    />

                    <div className="h-px bg-white/5 w-full" />

                    {/* Font Family Grid */}
                    <div className="grid grid-cols-1 gap-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                        {AVAILABLE_FONTS.map((f) => (
                            <button
                                key={f.name}
                                onClick={() => handleFontSelect(f.name)}
                                className={cn(
                                    "flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-300 group relative overflow-hidden",
                                    reference.fontFamily === f.name
                                        ? "bg-accent/15 border-accent/40 text-accent shadow-md ring-1 ring-accent/20"
                                        : "bg-black/20 border-white/5 text-stone-400 hover:border-white/20 hover:bg-white/5"
                                )}
                                style={{ fontFamily: f.name }}
                            >
                                <div className="flex flex-col items-start relative z-10">
                                    <span className="text-base font-medium tracking-tight">{f.name}</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] uppercase tracking-[0.15em] opacity-40 font-bold">{f.category}</span>
                                        {f.tags.includes('Cyrillic') && (
                                            <span className="text-[8px] uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded text-white/40">CYR</span>
                                        )}
                                    </div>
                                </div>
                                {reference.fontFamily === f.name && (
                                    <div className="p-1.5 rounded-full bg-accent text-accent-foreground shadow-lg animate-in zoom-in-50 duration-300 relative z-10">
                                        <Check className="w-3 h-3" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="h-px bg-white/5 w-full" />

                    {/* Size Slider: Mapping directly to fontSize px */}
                    <CustomSlider
                        label={t('font_size')}
                        min={8}
                        max={200}
                        step={1}
                        value={reference.fontSize || 20}
                        onChange={(val) => updateReference({ fontSize: val })}
                        unit="px"
                    />

                    {/* Opacity Slider */}
                    <CustomSlider
                        label={t('opacity')}
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={reference.opacity}
                        onChange={(val) => updateReference({ opacity: val })}
                        unit="%"
                    />
                </div>
            </div>
        </div>
    );
};
