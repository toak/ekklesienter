import React from 'react';
import {
    Image as ImageIcon, Plus, FolderOpen, Trash2,
    ChevronDown, ChevronRight, FolderPlus, Group, RefreshCw, AlertCircle
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { PRELOADED_LOGOS } from '@/core/data/logoData';
import { IpcService } from '@/core/services/IpcService';
import { CreateGroupDialog } from './logo/CreateGroupDialog';
import { LogoCard } from './logo/LogoCard';
import { LogoGrid } from './logo/LogoGrid';
import { useLogoSettings } from './logo/useLogoSettings';

const LogoSettings: React.FC = () => {
    const {
        t,
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

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {!IpcService.isElectron() && (
                <div className="flex items-center gap-3 px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-3xl text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{t('electron_required_warning', 'System features (Image/Folder Import) require the Desktop application.')}</span>
                </div>
            )}
            {/* ─── Action Bar ──────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={() => handleSelectFile()}
                    className="flex items-center gap-3 px-5 py-3.5 bg-stone-900/40 border border-white/5 hover:border-accent/50 hover:bg-stone-800/40 rounded-2xl transition-all group cursor-pointer"
                >
                    <div className="p-2 bg-stone-800 rounded-xl group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                        <Plus className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                        <span className="block text-xs font-bold text-white tracking-tight">{t('add_logo', 'Add Logo')}</span>
                        <span className="block text-[10px] text-stone-500 font-medium">{t('select_single_logo_desc', 'Select a single image file')}</span>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => handleImportFolder()}
                    disabled={isImporting && importTargetGroupId === null}
                    className="flex items-center gap-3 px-5 py-3.5 bg-stone-900/40 border border-white/5 hover:border-accent/50 hover:bg-stone-800/40 rounded-2xl transition-all group disabled:opacity-50 cursor-pointer"
                >
                    <div className="p-2 bg-stone-800 rounded-xl group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                        <FolderOpen className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                        <span className="block text-xs font-bold text-white tracking-tight">
                            {isImporting && importTargetGroupId === null ? t('importing', 'Importing...') : t('import_folder', 'Import Folder')}
                        </span>
                        <span className="block text-[10px] text-stone-500 font-medium">{t('import_folder_desc', 'Creates a new collection from folder')}</span>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => setShowCreateGroup(true)}
                    className="flex items-center gap-3 px-5 py-3.5 bg-stone-900/40 border border-white/5 hover:border-accent/50 hover:bg-stone-800/40 rounded-2xl transition-all group cursor-pointer"
                >
                    <div className="p-2 bg-stone-800 rounded-xl group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                        <FolderPlus className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                        <span className="block text-xs font-bold text-white tracking-tight">{t('create_collection', 'New Collection')}</span>
                        <span className="block text-[10px] text-stone-500 font-medium">{t('create_collection_desc', 'Organize logos into groups')}</span>
                    </div>
                </button>
            </div>

            {/* ─── Create Group Inline ────────────────────────────────────── */}
            {showCreateGroup && (
                <CreateGroupDialog
                    onSubmit={handleCreateGroup}
                    onCancel={() => setShowCreateGroup(false)}
                />
            )}

            {/* ─── Ungrouped Custom Logos ─────────────────────────────────── */}
            {settings.logo.customLogos.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                        <ImageIcon className="w-4 h-4 text-accent" />
                        <h3 className="text-xs font-bold text-stone-400 uppercase tracking-[0.2em]">
                            {t('ungrouped_logos', 'Ungrouped Logos')}
                        </h3>
                        <span className="text-[10px] text-stone-600 font-mono">{settings.logo.customLogos.length}</span>
                    </div>
                    <LogoGrid
                        logos={settings.logo.customLogos}
                        activeLogoId={activeLogoId}
                        onSelect={setActiveLogo}
                        onRemove={removeCustomLogo}
                        allGroups={customGroups}
                        onMove={moveLogoToGroup}
                    />
                </section>
            )}

            {/* ─── Custom Groups ──────────────────────────────────────────── */}
            {customGroups.map((group) => {
                const isCollapsed = collapsedGroups.has(group.id);
                return (
                    <section key={group.id} className="space-y-3">
                        {/* Group Header */}
                        <div className="flex items-center gap-2 px-2">
                            <button
                                type="button"
                                onClick={() => toggleCollapse(group.id)}
                                className="p-1 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                                aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                            >
                                {isCollapsed
                                    ? <ChevronRight className="w-4 h-4 text-stone-500" />
                                    : <ChevronDown className="w-4 h-4 text-stone-500" />
                                }
                            </button>
                            <Group className="w-4 h-4 text-accent" />
                            <h3 className="text-xs font-bold text-stone-300 uppercase tracking-[0.15em] flex-1 min-w-0 truncate">
                                {group.name}
                            </h3>
                            <span className="text-[10px] text-stone-600 font-mono shrink-0">
                                {group.logos.length} {t('common:items', 'items')}
                            </span>

                            {/* Group actions */}
                            <div className="flex items-center gap-1 shrink-0">
                                {/* Add logo to this group */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectFile(group.id)}
                                    className="p-1.5 hover:bg-white/5 text-stone-600 hover:text-accent rounded-lg transition-colors cursor-pointer"
                                    aria-label="Add logo to group"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>

                                {/* Refresh folder */}
                                {group.folderPath && (
                                    <button
                                        type="button"
                                        onClick={() => handleRefreshFolder(group)}
                                        disabled={isImporting}
                                        className="p-1.5 hover:bg-white/5 text-stone-600 hover:text-accent rounded-lg transition-colors disabled:opacity-30 cursor-pointer"
                                        aria-label="Refresh from folder"
                                    >
                                        <RefreshCw className={cn("w-3.5 h-3.5", isImporting && "animate-spin")} />
                                    </button>
                                )}

                                {/* Relocate folder */}
                                <button
                                    type="button"
                                    onClick={() => handleImportFolder(group.id)}
                                    className="p-1.5 hover:bg-white/5 text-stone-600 hover:text-accent rounded-lg transition-colors cursor-pointer"
                                    aria-label="Import folder to group"
                                >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete group */}
                                <button
                                    type="button"
                                    onClick={() => removeLogoGroup(group.id)}
                                    className="p-1.5 hover:bg-red-500/10 text-stone-600 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                                    aria-label="Delete group"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Folder path hint */}
                        {group.folderPath && (
                            <p className="px-9 text-[10px] text-stone-600 font-mono truncate" title={group.folderPath}>
                                📁 {group.folderPath}
                            </p>
                        )}

                        {/* Group Content */}
                        {!isCollapsed && (
                            group.logos.length === 0 ? (
                                <div className="mx-2 p-8 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-stone-600 gap-3">
                                    <ImageIcon className="w-10 h-10 opacity-10" />
                                    <p className="text-[10px] font-medium italic">{t('no_logos_in_group', 'No logos in this collection yet')}</p>
                                </div>
                            ) : (
                                <div className="px-2">
                                    <LogoGrid
                                        logos={group.logos}
                                        activeLogoId={activeLogoId}
                                        onSelect={setActiveLogo}
                                        onRemove={(id) => handleRemoveFromGroup(id, group.id)}
                                        allGroups={customGroups}
                                        onMove={moveLogoToGroup}
                                    />
                                </div>
                            )
                        )}
                    </section>
                );
            })}

            {/* ─── Empty State ────────────────────────────────────────────── */}
            {settings.logo.customLogos.length === 0 && customGroups.length === 0 && (
                <div className="p-12 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center text-stone-600 gap-4">
                    <ImageIcon className="w-14 h-14 opacity-10" />
                    <div className="text-center">
                        <p className="text-xs font-bold text-stone-500">{t('no_custom_logos_title', 'No logos added yet')}</p>
                        <p className="text-[10px] font-medium italic mt-1">
                            {t('no_custom_logos_hint', 'Add your church logo or import a folder to get started')}
                        </p>
                    </div>
                </div>
            )}

            {/* ─── Preloaded Collections ──────────────────────────────────── */}
            {PRELOADED_LOGOS.length > 0 && (
                <section className="space-y-6 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-3 px-2">
                        <Group className="w-4 h-4 text-stone-500" />
                        <h3 className="text-xs font-bold text-stone-500 uppercase tracking-[0.2em]">
                            {t('preloaded_logo_groups', 'Built-in Collections')}
                        </h3>
                    </div>

                    {PRELOADED_LOGOS.map((group) => (
                        <div key={group.id} className="space-y-3">
                            <div className="px-2">
                                <h4 className="text-sm font-bold text-white">
                                    {group.id === 'group-default' ? t('logo_group_default', 'Default Logos') : group.name}
                                </h4>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                </section>
            )}
        </div>
    );
};

export default LogoSettings;
