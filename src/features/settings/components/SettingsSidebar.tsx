import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Database, Monitor, Info, ImageIcon, Layers, Command } from 'lucide-react';
import { cn } from '@/core/utils/cn';

interface SettingsSidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeTab, setActiveTab }) => {
    const { t } = useTranslation();
    const tabs = [
        { id: 'general', label: t('general'), icon: Globe, description: t('appearance') },
        { id: 'displays', label: t('displays'), icon: Monitor, description: t('displays_description') },
        { id: 'data', label: t('data'), icon: Database, description: t('bible_translations') },
        { id: 'logo', label: t('church_logo', 'Church Logo'), icon: ImageIcon, description: t('logo_description', 'Manage church logos') },
        { id: 'overrides', label: t('overrides', 'Overrides'), icon: Layers, description: t('overrides_description', 'Black, white & logo screens') },
        { id: 'shortcuts', label: t('shortcuts', 'Shortcuts'), icon: Command, description: t('hotkeys_overview', 'App keyboard shortcuts') },
        { id: 'about', label: t('about_app'), icon: Info, description: t('about_description') },
    ];

    return (
        <div className="w-72 bg-stone-950/40 backdrop-blur-xl border-r border-white/5 flex flex-col p-6 gap-6 relative overflow-hidden">
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-linear-to-b from-white/5 to-transparent pointer-events-none" />

            <div className="space-y-2 relative z-10">
                <div className="px-4 mb-8">
                    <h1 className="text-xl font-bold bg-linear-to-r from-white to-stone-500 bg-clip-text text-transparent">
                        {t('settings')}
                    </h1>
                    <p className="text-[10px] text-stone-500 uppercase tracking-[0.2em] mt-1 font-semibold">
                        {t('settings_system_config')}
                    </p>
                </div>

                <div className="space-y-1.5">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "w-full group relative flex flex-col items-start gap-1 px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer text-left",
                                    isActive
                                        ? "bg-white/5 text-white ring-1 ring-white/10 shadow-lg"
                                        : "text-stone-500 hover:text-stone-300 hover:bg-white/5"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "p-2 rounded-lg transition-all duration-300",
                                        isActive ? "bg-accent shadow-[0_0_15px_var(--accent-glow)]" : "bg-stone-900 group-hover:bg-stone-800"
                                    )}>
                                        <Icon className={cn("w-4 h-4", isActive ? "text-accent-foreground" : "text-stone-400")} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold tracking-tight">{tab.label}</span>
                                        <span className="text-[10px] opacity-50 font-medium">{tab.description}</span>
                                    </div>
                                </div>

                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Accent */}
            <div className="mt-auto relative z-10 px-4">
                <div className="flex flex-col items-center gap-2 py-4 border-t border-white/5 opacity-40">
                    <p className="text-[9px] text-stone-500 font-bold uppercase tracking-[0.2em] text-center">
                        {t('app_title')} <br />
                        <span className="text-stone-700">{t('settings_premium_edition')}</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SettingsSidebar;
