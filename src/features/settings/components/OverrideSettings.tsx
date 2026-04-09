import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun, Image as ImageIcon, Lock, Plus, FolderOpen, Trash2, ChevronDown, ChevronRight, FolderPlus, Group, RefreshCw, AlertCircle, Library } from 'lucide-react';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { cn } from '@/core/utils/cn';
import { BackgroundPicker } from '@/features/presenter/components/slide-properties/BackgroundPicker';
import { SlideBackground } from '@/features/presenter/components/display/SlideBackground';
import { PRELOADED_LOGOS } from '@/core/data/logoData';
import { useLogoUrl } from '@/core/hooks/useLogoUrl';
import { useLogoSettings } from './logo/useLogoSettings';
import { LogoGrid } from './logo/LogoGrid';
import { CreateGroupDialog } from './logo/CreateGroupDialog';
import { LogoCard } from './logo/LogoCard';
import { IpcService } from '@/core/services/IpcService';

type OverrideTab = 'blackout' | 'whiteout' | 'logo';

const OverrideSettings: React.FC = () => {
    const { t } = useTranslation();
    const { updateOverrideBackground } = usePresenterStore();
    const [activeTab, setActiveTab] = useState<OverrideTab>('logo');
    const [logoSubTab, setLogoSubTab] = useState<'library' | 'background'>('library');

    const {
        settings,
        activeLogoId,
        customGroups,
        isImporting,
        showCreateGroup,
        collapsedGroups,
        importTargetGroupId,
        setShowCreateGroup,
        handleSelectFile,
        handleImportFolder,
        handleRefreshFolder,
        handleCreateGroup,
        toggleCollapse,
        handleRemoveFromGroup,
        removeCustomLogo,
        setActiveLogo,
        moveLogoToGroup,
        removeLogoGroup,
    } = useLogoSettings();

    // Find active logo object
    const activeLogo = React.useMemo(() => {
        if (!activeLogoId) return null;

        // 1. Search preloaded
        for (const group of PRELOADED_LOGOS) {
            const found = group.logos.find(l => l.id === activeLogoId);
            if (found) return found;
        }

        // 2. Search custom
        const customFound = settings.logo.customLogos.find(l => l.id === activeLogoId);
        if (customFound) return customFound;

        // 3. Search groups
        for (const group of settings.logo.customGroups || []) {
            const found = group.logos.find(l => l.id === activeLogoId);
            if (found) return found;
        }

        return null;
    }, [activeLogoId, settings.logo]);

    const logoUrl = useLogoUrl(activeLogo);

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
                                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
                                        {logoUrl ? (
                                            <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain drop-shadow-md" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center">
                                                <span className="text-[10px] font-black text-white/30">E</span>
                                            </div>
                                        )}
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
            <div className="bg-stone-900/30 border border-white/5 rounded-3xl p-6 relative overflow-hidden flex flex-col min-h-[400px]">
                <div className="absolute top-0 right-0 w-40 h-40 bg-accent/3 blur-3xl rounded-full translate-x-10 -translate-y-10 pointer-events-none" />

                <div className="relative z-10 flex-1 flex flex-col">
                    {activeTab === 'logo' ? (
                        <div className="flex flex-col h-full gap-6">
                            {/* Logo Sub-Tabs */}
                            <div className="flex items-center justify-between">
                                <div className="flex bg-stone-950/40 p-1 rounded-xl border border-white/5">
                                    <button
                                        onClick={() => setLogoSubTab('library')}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                            logoSubTab === 'library' ? "bg-stone-800 text-white shadow-lg" : "text-stone-500 hover:text-stone-300"
                                        )}
                                    >
                                        <Library className="w-3.5 h-3.5" />
                                        {t('logo_library', 'Library')}
                                    </button>
                                    <button
                                        onClick={() => setLogoSubTab('background')}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                            logoSubTab === 'background' ? "bg-stone-800 text-white shadow-lg" : "text-stone-500 hover:text-stone-300"
                                        )}
                                    >
                                        <ImageIcon className="w-3.5 h-3.5" />
                                        {t('background', 'Background')}
                                    </button>
                                </div>

                                {logoSubTab === 'library' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSelectFile()}
                                            className="p-2 bg-stone-800 hover:bg-stone-700 rounded-lg border border-white/5 transition-colors text-stone-300 hover:text-white"
                                            title={t('add_logo', 'Add Logo')}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleImportFolder()}
                                            className="p-2 bg-stone-800 hover:bg-stone-700 rounded-lg border border-white/5 transition-colors text-stone-300 hover:text-white"
                                            title={t('import_folder', 'Import Folder')}
                                        >
                                            <FolderOpen className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {logoSubTab === 'background' ? (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
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
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300 overflow-y-auto max-h-[450px] pr-2 scrollbar-thin scrollbar-thumb-stone-800">
                                    {!IpcService.isElectron() && (
                                        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-[10px]">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                            <span>{t('electron_required_warning', 'System features require Desktop application.')}</span>
                                        </div>
                                    )}

                                    {showCreateGroup && (
                                        <CreateGroupDialog onSubmit={handleCreateGroup} onCancel={() => setShowCreateGroup(false)} />
                                    )}

                                    {/* Library Content (Simplified version of LogoSettings) */}
                                    <div className="space-y-6">
                                        {/* Custom Logos */}
                                        {(settings.logo.customLogos.length > 0 || customGroups.length > 0) ? (
                                            <>
                                                {settings.logo.customLogos.length > 0 && (
                                                    <div className="space-y-3">
                                                        <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">{t('your_logos', 'Your Logos')}</h4>
                                                        <LogoGrid
                                                            logos={settings.logo.customLogos}
                                                            activeLogoId={activeLogoId}
                                                            onSelect={setActiveLogo}
                                                            onRemove={removeCustomLogo}
                                                            allGroups={customGroups}
                                                            onMove={moveLogoToGroup}
                                                        />
                                                    </div>
                                                )}

                                                {customGroups.map(group => (
                                                    <div key={group.id} className="space-y-3">
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => toggleCollapse(group.id)} className="p-1 hover:bg-white/5 rounded">
                                                                {collapsedGroups.has(group.id) ? <ChevronRight className="w-3 h-3 text-stone-600" /> : <ChevronDown className="w-3 h-3 text-stone-600" />}
                                                            </button>
                                                            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{group.name}</h4>
                                                            <span className="text-[10px] text-stone-700">{group.logos.length}</span>
                                                        </div>
                                                        {!collapsedGroups.has(group.id) && (
                                                            <LogoGrid
                                                                logos={group.logos}
                                                                activeLogoId={activeLogoId}
                                                                onSelect={setActiveLogo}
                                                                onRemove={(id) => handleRemoveFromGroup(id, group.id)}
                                                                allGroups={customGroups}
                                                                onMove={moveLogoToGroup}
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </>
                                        ) : (
                                            <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl text-stone-600">
                                                <ImageIcon className="w-8 h-8 opacity-10 mb-2" />
                                                <p className="text-[10px] font-medium">{t('no_logos_added', 'No custom logos added yet')}</p>
                                            </div>
                                        )}

                                        {/* Preloaded Section */}
                                        <div className="pt-4 border-t border-white/5 space-y-4">
                                            <h4 className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">{t('built_in_collections', 'Built-in Collections')}</h4>
                                            {PRELOADED_LOGOS.map((group) => (
                                                <div key={group.id} className="space-y-2">
                                                    <p className="text-[10px] font-bold text-stone-500">{group.name}</p>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {group.logos.map((logo) => (
                                                            <LogoCard
                                                                key={logo.id}
                                                                logo={logo}
                                                                isActive={activeLogoId === logo.id}
                                                                onSelect={() => setActiveLogo(logo.id)}
                                                                allGroups={customGroups}
                                                                onMove={moveLogoToGroup}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 gap-4 h-full">
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
