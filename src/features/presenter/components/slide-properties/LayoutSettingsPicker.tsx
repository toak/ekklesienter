import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { Maximize, Scan, Square, RectangleHorizontal, Layout } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { CustomSlider } from '@/components/CustomSlider';

export const LayoutSettingsPicker: React.FC = () => {
    const { t } = useTranslation();
    const { settings: globalSettings, draftSettings, updateDraft } = usePresenterStore();

    const settings = draftSettings || globalSettings;
    const { display } = settings;

    const updateDisplay = (update: Partial<typeof display>) => {
        updateDraft({ display: { ...display, ...update } });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
            {/* ─── Screen Geometry ─── */}
            <div className="bg-white/3 backdrop-blur-xl border border-white/5 rounded-3xl p-6 space-y-6 shadow-xl leading-none">
                <div className="flex items-center gap-3 px-1">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                        <Scan className="w-4 h-4 text-stone-500" />
                    </div>
                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em]">{t('screen_geometry', 'Screen Geometry')}</label>
                </div>

                <div className="space-y-6">
                    <CustomSlider
                        label={t('corner_radius', 'Corner Radius')}
                        min={0}
                        max={64}
                        step={2}
                        value={display.cornerRadius || 0}
                        onChange={(val) => updateDisplay({ cornerRadius: val })}
                        unit="px"
                    />

                    <div className="h-px bg-white/5 w-full" />

                    <CustomSlider
                        label={t('reference_gap', 'Ref. Gap')}
                        min={0}
                        max={128}
                        step={4}
                        value={display.referenceGap ?? 16}
                        onChange={(val) => updateDisplay({ referenceGap: val })}
                        unit="px"
                    />

                    <div className="h-px bg-white/5 w-full" />

                    <div className="grid grid-cols-2 gap-4">
                        <CustomSlider
                            label={t('label_gap', 'Label Gap')}
                            min={0}
                            max={128}
                            step={4}
                            value={display.translationGap ?? 32}
                            onChange={(val) => updateDisplay({ translationGap: val })}
                            unit="px"
                        />
                        <CustomSlider
                            label={t('verse_gap', 'Verse Gap')}
                            min={0}
                            max={128}
                            step={4}
                            value={display.verseGap ?? 24}
                            onChange={(val) => updateDisplay({ verseGap: val })}
                            unit="px"
                        />
                    </div>
                </div>
            </div>

            {/* ─── Safe Area / Padding ─── */}
            <div className="bg-white/3 backdrop-blur-xl border border-white/5 rounded-3xl p-6 space-y-6 shadow-xl leading-none">
                <div className="flex items-center gap-3 px-1">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                        <Maximize className="w-4 h-4 text-stone-500" />
                    </div>
                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em]">{t('content_inset', 'Content Inset')}</label>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div className="grid grid-cols-2 gap-4">
                        <CustomSlider
                            label={t('padding_top', 'Top')}
                            min={0}
                            max={200}
                            step={4}
                            value={display.padding.top}
                            onChange={(val) => updateDisplay({ padding: { ...display.padding, top: val } })}
                            unit="px"
                        />
                        <CustomSlider
                            label={t('padding_bottom', 'Bottom')}
                            min={0}
                            max={200}
                            step={4}
                            value={display.padding.bottom}
                            onChange={(val) => updateDisplay({ padding: { ...display.padding, bottom: val } })}
                            unit="px"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <CustomSlider
                            label={t('padding_left', 'Left')}
                            min={0}
                            max={200}
                            step={4}
                            value={display.padding.left}
                            onChange={(val) => updateDisplay({ padding: { ...display.padding, left: val } })}
                            unit="px"
                        />
                        <CustomSlider
                            label={t('padding_right', 'Right')}
                            min={0}
                            max={200}
                            step={4}
                            value={display.padding.right}
                            onChange={(val) => updateDisplay({ padding: { ...display.padding, right: val } })}
                            unit="px"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
