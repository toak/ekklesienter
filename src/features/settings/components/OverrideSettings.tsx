import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun, Image as ImageIcon, Lock } from 'lucide-react';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { cn } from '@/core/utils/cn';
import { BackgroundPicker } from '@/features/presenter/components/slide-properties/BackgroundPicker';
import { SlideBackground } from '@/features/presenter/components/display/SlideBackground';

type OverrideTab = 'blackout' | 'whiteout' | 'logo';

const OverrideSettings: React.FC = () => {
    const { t } = useTranslation();
    const { settings, updateOverrideBackground } = usePresenterStore();
    const [activeTab, setActiveTab] = useState<OverrideTab>('logo');

    const tabs: { id: OverrideTab; icon: React.ElementType; label: string; desc: string; locked: boolean }[] = [
        { id: 'blackout', icon: Moon, label: t('blackout', 'Blackout'), desc: t('blackout_bg_desc', 'Always solid black'), locked: true },
        { id: 'whiteout', icon: Sun, label: t('whiteout', 'Whiteout'), desc: t('whiteout_bg_desc', 'Always solid white'), locked: true },
        { id: 'logo', icon: ImageIcon, label: t('logo_mode', 'Logo'), desc: t('logo_bg_desc', 'Customizable background'), locked: false },
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Override Tabs */}
            <div className="flex gap-3">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex-1 group relative flex flex-col items-center gap-3 p-5 rounded-3xl border transition-all duration-300 cursor-pointer overflow-hidden",
                                activeTab === tab.id
                                    ? "bg-accent/10 border-accent/30 shadow-lg ring-1 ring-accent/20"
                                    : "bg-stone-900/40 border-white/5 hover:border-white/10 hover:bg-stone-900/60"
                            )}
                        >
                            {/* Preview Thumbnail */}
                            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/5 shadow-inner">
                                <SlideBackground background={settings.overrides[tab.id].background} />
                                {tab.id === 'logo' && (
                                    <div className="relative z-10 w-full h-full flex items-center justify-center">
                                        <div className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center">
                                            <span className="text-[10px] font-black text-white/30">E</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                    <Icon className={cn(
                                        "w-4 h-4 transition-colors",
                                        activeTab === tab.id ? "text-accent" : "text-stone-500"
                                    )} />
                                    <span className={cn(
                                        "text-xs font-bold uppercase tracking-widest transition-colors",
                                        activeTab === tab.id ? "text-white" : "text-stone-400"
                                    )}>
                                        {tab.label}
                                    </span>
                                    {tab.locked && <Lock className="w-3 h-3 text-stone-600" />}
                                </div>
                                <p className="text-[10px] text-stone-600 font-medium mt-1">{tab.desc}</p>
                            </div>

                            {/* Active indicator */}
                            {activeTab === tab.id && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_var(--accent-glow)]" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Content area */}
            <div className="bg-stone-900/30 border border-white/5 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-accent/3 blur-3xl rounded-full translate-x-10 -translate-y-10 pointer-events-none" />

                <div className="relative z-10">
                    {activeTab === 'logo' ? (
                        <>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                                    <ImageIcon className="w-4 h-4 text-accent" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white tracking-tight">
                                        {t('logo_mode', 'Logo')} {t('background', 'Background')}
                                    </h3>
                                    <p className="text-[10px] text-stone-600 font-medium">
                                        {t('override_bg_customize', 'Customize what appears on the projector')}
                                    </p>
                                </div>
                            </div>
                            <BackgroundPicker
                                background={settings.overrides.logo.background}
                                onChange={(bg) => updateOverrideBackground('logo', bg)}
                            />
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className={cn(
                                "w-20 h-20 rounded-3xl border-2 flex items-center justify-center",
                                activeTab === 'blackout'
                                    ? "bg-black border-stone-800"
                                    : "bg-white border-stone-200"
                            )}>
                                <Lock className={cn(
                                    "w-6 h-6",
                                    activeTab === 'blackout' ? "text-stone-700" : "text-stone-400"
                                )} />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-stone-400">
                                    {activeTab === 'blackout' ? t('blackout_fixed', 'Fixed Black') : t('whiteout_fixed', 'Fixed White')}
                                </p>
                                <p className="text-[10px] text-stone-600 mt-1">
                                    {t('override_not_customizable', 'This override has a fixed color and cannot be customized')}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OverrideSettings;
