import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { Type, Languages, SlidersHorizontal, Eye, EyeOff, Check, Palette } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { CustomSlider } from '@/components/CustomSlider';
import { CompactColorPicker } from '@/components/CompactColorPicker';

import { AVAILABLE_FONTS } from '@/core/data/fonts';

export const TranslationLabelPicker: React.FC = () => {
    const { t } = useTranslation();
    const { settings: globalSettings, draftSettings, updateDraft } = usePresenterStore();

    const settings = draftSettings || globalSettings;
    const { translationLabel } = settings;

    const updateLabel = (update: Partial<typeof translationLabel>) => {
        updateDraft({ translationLabel: { ...translationLabel, ...update } });
    };

    const handleFontSelect = (family: string) => {
        updateLabel({ fontFamily: family });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
            {/* ─── Visibility Toggle ─── */}
            <div className="bg-white/3 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500",
                            translationLabel.enabled ? "bg-accent/20 border-accent/40" : "bg-white/5 border-white/10"
                        )}>
                            <Languages className={cn("w-5 h-5 transition-colors duration-500", translationLabel.enabled ? "text-accent" : "text-stone-600")} />
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-stone-300 uppercase tracking-[0.2em] block">{t('translation_labels', 'Translation Labels')}</label>
                            <span className="text-[9px] font-medium text-stone-500 uppercase tracking-wider">{translationLabel.enabled ? t('visible', 'Visible') : t('hidden', 'Hidden')}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => updateLabel({ enabled: !translationLabel.enabled })}
                        className={cn(
                            "w-14 h-7 rounded-full transition-all duration-500 relative overflow-hidden flex items-center shadow-inner cursor-pointer",
                            translationLabel.enabled ? "bg-accent" : "bg-stone-800"
                        )}
                    >
                        <div className={cn(
                            "absolute w-5 h-5 bg-white rounded-full transition-all duration-500 shadow-xl",
                            translationLabel.enabled ? "translate-x-8" : "translate-x-1"
                        )} />
                    </button>
                </div>
            </div>

            {/* ─── Main Configuration Block ─── */}
            <div className={cn(
                "space-y-6 transition-all duration-500",
                !translationLabel.enabled && "opacity-40 pointer-events-none grayscale blur-[1px]"
            )}>
                {/* Typography & Color */}
                <div className="bg-white/3 backdrop-blur-xl border border-white/5 rounded-3xl p-6 space-y-6 shadow-xl">
                    <div className="flex items-center gap-3 px-1">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                            <Type className="w-4 h-4 text-stone-500" />
                        </div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em]">{t('typography')}</label>
                    </div>

                    <div className="space-y-6">
                        {/* Font Family Grid */}
                        <div className="grid grid-cols-1 gap-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                            {AVAILABLE_FONTS.map((f) => (
                                <button
                                    key={f.name}
                                    onClick={() => handleFontSelect(f.name)}
                                    className={cn(
                                        "flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-300 group relative overflow-hidden",
                                        translationLabel.fontFamily === f.name
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
                                    {translationLabel.fontFamily === f.name && (
                                        <div className="p-1.5 rounded-full bg-accent text-accent-foreground shadow-lg animate-in zoom-in-50 duration-300 relative z-10">
                                            <Check className="w-3 h-3" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="h-px bg-white/5 w-full" />

                        {/* Size Slider */}
                        <CustomSlider
                            label={t('font_size')}
                            min={8}
                            max={100}
                            step={1}
                            value={translationLabel.fontSize}
                            onChange={(val) => updateLabel({ fontSize: val })}
                            unit="px"
                        />
                    </div>
                </div>

                {/* Appearance Block */}
                <div className="bg-white/3 backdrop-blur-xl border border-white/5 rounded-3xl p-6 space-y-6 shadow-xl">
                    <div className="flex items-center gap-3 px-1">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                            <Palette className="w-4 h-4 text-stone-500" />
                        </div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em]">{t('appearance')}</label>
                    </div>

                    <div className="pt-2 space-y-6">
                        <CompactColorPicker
                            label={t('font_color')}
                            color={translationLabel.color || '#ffffff'}
                            onChange={(color) => updateLabel({ color })}
                        />

                        <div className="h-px bg-white/5 w-full" />

                        <CustomSlider
                            label={t('transparency', 'Transparency')}
                            min={0.1}
                            max={1}
                            step={0.05}
                            value={translationLabel.opacity}
                            onChange={(val) => updateLabel({ opacity: val })}
                            unit="%"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
