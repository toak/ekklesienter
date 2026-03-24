import React from 'react';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { Type, Palette } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { CustomSlider } from '@/components/CustomSlider';
import { CompactColorPicker } from '@/components/CompactColorPicker';
import { useTranslation } from 'react-i18next';
import { FontLibrary } from '../fonts/FontLibrary';

export const FontPicker: React.FC = () => {
    const { t } = useTranslation();
    const { settings: globalSettings, draftSettings, updateFont, updateDraft } = usePresenterStore();

    // Always prefer draft settings if available
    const settings = draftSettings || globalSettings;
    const { font } = settings;

    const handleFontSelect = (family: string) => {
        if (draftSettings) {
            updateDraft({ font: { ...font, family } });
        } else {
            updateFont({ family });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
            {/* Font Family Selection Bento Block */}
            <div className="bg-white/3 backdrop-blur-xl border border-white/5 rounded-3xl p-6 space-y-4 shadow-xl">
                <FontLibrary
                    value={font.family}
                    onSelect={handleFontSelect}
                    showTitle={true}
                />
            </div>

            {/* Core Metrics Bento Block */}
            <div className="bg-white/2 border border-white/5 rounded-3xl p-8 space-y-8 shadow-xl">
                <div className="flex items-center gap-3 px-1">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                        <Type className="w-4 h-4 text-stone-500" />
                    </div>
                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em]">{t('visual_tone')}</label>
                </div>

                <div className="pt-2">
                    {/* Superscript Toggle */}
                    <div className="flex items-center justify-between px-1 mb-6">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em]">{t('show_superscripts') || 'Superscripts'}</label>
                        <button
                            onClick={() => {
                                const newValue = !font.showSuperscript;
                                if (draftSettings) {
                                    updateDraft({ font: { ...font, showSuperscript: newValue } });
                                } else {
                                    updateFont({ showSuperscript: newValue });
                                }
                            }}
                            className={cn(
                                "w-12 h-6 rounded-full transition-all duration-300 relative overflow-hidden flex items-center shadow-inner group",
                                font.showSuperscript ? "bg-accent" : "bg-stone-800"
                            )}
                        >
                            <div className={cn(
                                "absolute w-4.5 h-4.5 bg-white rounded-full transition-all duration-300 shadow-xl",
                                font.showSuperscript ? "translate-x-6.5" : "translate-x-1"
                            )} />
                        </button>
                    </div>

                    <CompactColorPicker
                        label={t('text_color')}
                        color={font.color}
                        onChange={(color) => {
                            if (draftSettings) {
                                updateDraft({ font: { ...font, color } });
                            } else {
                                updateFont({ color });
                            }
                        }}
                    />
                </div>
            </div>

            {/* Effects Bento Block */}
            <div className="bg-white/2 border border-white/5 rounded-3xl p-8 space-y-8 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-500",
                            font.shadow ? "bg-accent/20 border-accent/40" : "bg-white/5 border-white/10"
                        )}>
                            <Palette className={cn("w-4 h-4 transition-colors duration-500", font.shadow ? "text-accent" : "text-stone-600")} />
                        </div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em]">{t('shadow_depth')}</label>
                    </div>

                    <button
                        onClick={() => {
                            if (draftSettings) {
                                updateDraft({ font: { ...font, shadow: !font.shadow } });
                            } else {
                                updateFont({ shadow: !font.shadow });
                            }
                        }}
                        className={cn(
                            "w-12 h-6 rounded-full transition-all duration-500 relative overflow-hidden flex items-center shadow-inner group",
                            font.shadow ? "bg-accent" : "bg-stone-800"
                        )}
                    >
                        <div className={cn(
                            "absolute w-4.5 h-4.5 bg-white rounded-full transition-all duration-500 shadow-xl",
                            font.shadow ? "translate-x-6.5" : "translate-x-1"
                        )} />
                    </button>
                </div>

                {font.shadow && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500 fill-mode-both">
                        <CustomSlider
                            label={t('depth_radius')}
                            min={0}
                            max={30}
                            step={1}
                            value={font.shadowBlur || 0}
                            onChange={(val) => {
                                if (draftSettings) {
                                    updateDraft({ font: { ...font, shadowBlur: val } });
                                } else {
                                    updateFont({ shadowBlur: val });
                                }
                            }}
                            unit="px"
                        />

                        <div className="pt-4 border-t border-white/5">
                            <CompactColorPicker
                                label={t('depth_shade')}
                                color={font.shadowColor || '#000000'}
                                onChange={(color) => {
                                    if (draftSettings) {
                                        updateDraft({ font: { ...font, shadowColor: color } });
                                    } else {
                                        updateFont({ shadowColor: color });
                                    }
                                }}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-8 pt-4 border-t border-white/5">
                            <CustomSlider
                                label={t('lateral_offset')}
                                min={-20}
                                max={20}
                                step={1}
                                value={font.shadowOffsetX || 0}
                                onChange={(val) => {
                                    if (draftSettings) {
                                        updateDraft({ font: { ...font, shadowOffsetX: val } });
                                    } else {
                                        updateFont({ shadowOffsetX: val });
                                    }
                                }}
                                unit="px"
                            />
                            <CustomSlider
                                label={t('vertical_offset')}
                                min={-20}
                                max={20}
                                step={1}
                                value={font.shadowOffsetY || 0}
                                onChange={(val) => {
                                    if (draftSettings) {
                                        updateDraft({ font: { ...font, shadowOffsetY: val } });
                                    } else {
                                        updateFont({ shadowOffsetY: val });
                                    }
                                }}
                                unit="px"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
