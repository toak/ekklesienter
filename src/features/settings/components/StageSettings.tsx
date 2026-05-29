import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePresenterStore, DEFAULT_SETTINGS } from '@/features/presenter/store/presenterStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/core/utils/cn';
import { Monitor, Square, Columns, LayoutGrid, Eye, EyeOff } from 'lucide-react';
import { StageCardConfig, StageCardId } from '@/core/types';

const StageSettings: React.FC = () => {
    const { t } = useTranslation();
    const { settings, updateStageSettings } = usePresenterStore(useShallow(state => ({
        settings: state.settings,
        updateStageSettings: state.updateStageSettings
    })));

    const stage = settings.stage ?? DEFAULT_SETTINGS.stage;

    const toggleVisibility = (id: StageCardId) => {
        const newLayout = stage.layout.map(card => 
            card.id === id ? { ...card, visible: !card.visible } : card
        );
        updateStageSettings({ layout: newLayout });
    };

    const updateSpan = (id: StageCardId, w: number, h: number) => {
        const newLayout = stage.layout.map(card => 
            card.id === id ? { ...card, w: Math.max(1, Math.min(12, w)), h: Math.max(1, Math.min(12, h)) } : card
        );
        updateStageSettings({ layout: newLayout });
    };

    const getCardLabel = (id: StageCardId) => {
        switch(id) {
            case 'current': return t('stage_current_slide', 'Current Slide');
            case 'next': return t('stage_next_slide', 'Next Slide');
            case 'prev': return t('stage_prev_slide', 'Previous Slide');
            case 'sound': return t('stage_sound_card', 'Sound Card');
            default: return id;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Global Settings */}
            <div className="bg-stone-900/40 border border-white/5 rounded-3xl p-6">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-accent" />
                    {t('stage_appearance', 'Appearance & Grid')}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Gap Slider */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold text-stone-300">{t('grid_gap', 'Card Spacing')}</label>
                            <span className="text-xs text-stone-500 font-mono bg-stone-950 px-2 py-1 rounded-md">{stage.gap}px</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="64"
                            step="4"
                            value={stage.gap}
                            onChange={(e) => updateStageSettings({ gap: Number(e.target.value) })}
                            className="w-full accent-accent bg-stone-800 rounded-full h-1.5 appearance-none"
                        />
                    </div>

                    {/* Corner Radius Slider */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold text-stone-300">{t('corner_radius', 'Corner Radius')}</label>
                            <span className="text-xs text-stone-500 font-mono bg-stone-950 px-2 py-1 rounded-md">{stage.cornerRadius}px</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="48"
                            step="4"
                            value={stage.cornerRadius}
                            onChange={(e) => updateStageSettings({ cornerRadius: Number(e.target.value) })}
                            className="w-full accent-accent bg-stone-800 rounded-full h-1.5 appearance-none"
                        />
                    </div>
                </div>
            </div>

            {/* Layout Customizer */}
            <div className="bg-stone-900/40 border border-white/5 rounded-3xl p-6">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-accent" />
                    {t('stage_layout', 'Bento Cards Configuration')}
                </h3>
                <p className="text-xs text-stone-500 mb-6">{t('stage_layout_desc', 'Adjust the size and visibility of cards on the stage screen. The layout uses a 12x12 grid system.')}</p>
                
                <div className="space-y-4">
                    {stage.layout.map((card) => (
                        <div key={card.id} className={cn(
                            "flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border transition-colors",
                            card.visible ? "bg-stone-950/50 border-white/10" : "bg-stone-950/20 border-white/5 opacity-50"
                        )}>
                            <div className="flex items-center gap-4 mb-4 md:mb-0">
                                <button 
                                    onClick={() => toggleVisibility(card.id)}
                                    className={cn(
                                        "p-2 rounded-xl transition-colors",
                                        card.visible ? "bg-accent/20 text-accent hover:bg-accent/30" : "bg-stone-800 text-stone-500 hover:bg-stone-700"
                                    )}
                                    title={card.visible ? "Hide Card" : "Show Card"}
                                >
                                    {card.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                                <div>
                                    <span className="font-bold text-stone-200">{getCardLabel(card.id)}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] text-stone-500 uppercase tracking-wider font-bold">Width</span>
                                    <div className="flex items-center bg-stone-900 rounded-lg p-1 border border-white/5">
                                        <button onClick={() => updateSpan(card.id, card.w - 1, card.h)} className="px-2 py-1 text-stone-400 hover:text-white disabled:opacity-30" disabled={!card.visible || card.w <= 1}>-</button>
                                        <span className="w-6 text-center text-xs font-mono">{card.w}</span>
                                        <button onClick={() => updateSpan(card.id, card.w + 1, card.h)} className="px-2 py-1 text-stone-400 hover:text-white disabled:opacity-30" disabled={!card.visible || card.w >= 12}>+</button>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] text-stone-500 uppercase tracking-wider font-bold">Height</span>
                                    <div className="flex items-center bg-stone-900 rounded-lg p-1 border border-white/5">
                                        <button onClick={() => updateSpan(card.id, card.w, card.h - 1)} className="px-2 py-1 text-stone-400 hover:text-white disabled:opacity-30" disabled={!card.visible || card.h <= 1}>-</button>
                                        <span className="w-6 text-center text-xs font-mono">{card.h}</span>
                                        <button onClick={() => updateSpan(card.id, card.w, card.h + 1)} className="px-2 py-1 text-stone-400 hover:text-white disabled:opacity-30" disabled={!card.visible || card.h >= 12}>+</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Grid Preview Simulation */}
                <div className="mt-8 pt-8 border-t border-white/5">
                    <h4 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-4">{t('preview_layout', 'Layout Preview')}</h4>
                    <div 
                        className="bg-stone-950 rounded-2xl border border-white/5 p-4 aspect-video grid overflow-hidden"
                        style={{
                            gridTemplateColumns: 'repeat(12, 1fr)',
                            gridAutoRows: 'minmax(20px, auto)',
                            gap: `${Math.min(8, stage.gap / 4)}px`, // scale down gap for preview
                        }}
                    >
                        {stage.layout.filter(c => c.visible).map(card => (
                            <div 
                                key={`preview-${card.id}`}
                                className="bg-stone-800/80 border border-white/10 flex items-center justify-center text-[10px] font-bold text-stone-400 transition-all"
                                style={{
                                    gridColumn: `span ${card.w}`,
                                    gridRow: `span ${card.h}`,
                                    borderRadius: `${Math.min(8, stage.cornerRadius / 4)}px` // scale down corner radius for preview
                                }}
                            >
                                {getCardLabel(card.id)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StageSettings;
