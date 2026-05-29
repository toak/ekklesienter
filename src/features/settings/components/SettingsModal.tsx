import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsSidebar from './SettingsSidebar';
import GeneralSettings from './GeneralSettings';
import DataSettings from './DataSettings';
import DisplaySettings from './DisplaySettings';
import AboutSettings from './AboutSettings';
import LogoSettings from './LogoSettings';
import OverrideSettings from './OverrideSettings';
import ShortcutsSettings from './ShortcutsSettings';
import RemoteSettings from './RemoteSettings';
import StageSettings from './StageSettings';
import { X, Globe, Database, Monitor, Info, ImageIcon, Layers, Command, Smartphone, Airplay } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('general');

    if (!isOpen) return null;


    const renderContent = () => {
        switch (activeTab) {
            case 'general': return <GeneralSettings />;
            case 'displays': return <DisplaySettings />;
            case 'data': return <DataSettings />;
            case 'overrides': return <OverrideSettings />;
            case 'shortcuts': return <ShortcutsSettings />;
            case 'remote': return <RemoteSettings />;
            case 'stage': return <StageSettings />;
            case 'about': return <AboutSettings />;
            default: return <GeneralSettings />;
        }
    };

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-stone-950/80 backdrop-blur-2xl animate-in fade-in duration-300 p-4 md:p-8">

            {/* Modal Container with Immersive Shell */}
            <div className="w-full max-w-[1000px] h-full max-h-[750px] bg-stone-950/40 border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] flex overflow-hidden ring-1 ring-white/5 relative group/modal">

                {/* Dynamic Content Blur background */}
                <div className="absolute inset-0 bg-linear-to-b from-white/2 to-transparent pointer-events-none" />

                <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-accent/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

                {/* Sidebar Section */}
                <SettingsSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col relative z-10 bg-black/20 overflow-hidden">

                    {/* Integrated Header */}
                    <div className="h-28 px-10 flex items-center justify-between border-b border-white/5 bg-stone-950/20 backdrop-blur-md relative overflow-hidden group/header">
                        {/* Header Glow Accent */}
                        <div className="absolute -top-10 left-10 w-40 h-20 bg-accent/10 blur-[60px] rounded-full pointer-events-none" />

                        <div className="relative z-10 flex items-center gap-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full" />
                                <div className="relative w-12 h-12 rounded-2xl bg-stone-900 border border-white/10 flex items-center justify-center shadow-2xl">
                                    {activeTab === 'general' && <Globe className="w-6 h-6 text-accent animate-in zoom-in duration-500" />}
                                    {activeTab === 'displays' && <Monitor className="w-6 h-6 text-accent animate-in zoom-in duration-500" />}
                                    {activeTab === 'data' && <Database className="w-6 h-6 text-accent animate-in zoom-in duration-500" />}
                                    {activeTab === 'overrides' && <Layers className="w-6 h-6 text-accent animate-in zoom-in duration-500" />}
                                    {activeTab === 'shortcuts' && <Command className="w-6 h-6 text-accent animate-in zoom-in duration-500" />}
                                    {activeTab === 'remote' && <Smartphone className="w-6 h-6 text-accent animate-in zoom-in duration-500" />}
                                    {activeTab === 'stage' && <Monitor className="w-6 h-6 text-accent animate-in zoom-in duration-500" />}
                                    {activeTab === 'about' && <Info className="w-6 h-6 text-accent animate-in zoom-in duration-500" />}
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-[0.3em]">
                                        {t('settings')}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-stone-800" />
                                    <span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em]">
                                        {activeTab === 'remote' && t('remote_control_title')}
                                        {activeTab === 'stage' && t('stage_screen_title', 'Stage Screen')}
                                        {activeTab === 'general' && t('general')}
                                        {activeTab === 'displays' && t('displays')}
                                        {activeTab === 'data' && t('data')}
                                        {activeTab === 'shortcuts' && t('shortcuts')}
                                        {activeTab === 'overrides' && t('overrides')}
                                        {activeTab === 'about' && t('about')}
                                    </span>
                                </div>
                                <h2 className="text-2xl font-black text-white tracking-tight">
                                    {activeTab === 'general' && t('appearance')}
                                    {activeTab === 'displays' && t('displays')}
                                    {activeTab === 'data' && t('bible_translations')}
                                    {activeTab === 'overrides' && t('overrides', 'Overrides')}
                                    {activeTab === 'shortcuts' && t('shortcuts', 'Shortcuts')}
                                    {activeTab === 'remote' && t('remote_control_title', 'Remote Control')}
                                    {activeTab === 'stage' && t('stage_screen_title', 'Stage Screen')}
                                    {activeTab === 'about' && t('about_app')}
                                </h2>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="group/close relative p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all active:scale-95 shadow-lg"
                        >
                            <X className="w-5 h-5 text-stone-400 group-hover/close:text-white transition-all duration-300" />
                        </button>
                    </div>

                    {/* Content Scroll Area */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide p-10">
                        {/* Tab Content Wrapper */}
                        <div className="max-w-4xl mx-auto">
                            {renderContent()}
                        </div>
                    </div>

                    {/* Seamless Footer Glow */}
                    <div className="h-8 bg-linear-to-t from-stone-950/40 to-transparent pointer-events-none" />
                </div>
            </div>

            {/* Click outside to close (backdrop) */}
            <button
                type="button"
                aria-label={t('close', 'Close')}
                className="absolute inset-0 -z-10 w-full h-full cursor-default bg-transparent"
                onClick={onClose}
            />
        </div>
    );
};

export default SettingsModal;
