import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Image as ImageIcon, Plus, FolderOpen, Trash2, CheckCircle2,
    ChevronDown, ChevronRight, FolderPlus, ArrowRightLeft, Group, RefreshCw, AlertCircle
} from 'lucide-react';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { cn } from '@/core/utils/cn';
import { PRELOADED_LOGOS } from '@/core/data/logoData';
import { ILogo, ILogoGroup, ILogoEntry } from '@/core/types';
import { db } from '@/core/db';
import { useLogoUrl } from '@/core/hooks/useLogoUrl';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';
import { IpcService } from '@/core/services/IpcService';

// ─── Create Group Dialog ────────────────────────────────────────────────────
interface CreateGroupDialogProps {
    onSubmit: (name: string) => void;
    onCancel: () => void;
}

const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({ onSubmit, onCancel }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');

    return (
        <div className="flex items-center gap-3 p-4 bg-stone-800/60 rounded-2xl border border-accent/20 animate-in fade-in slide-in-from-top-2 duration-300">
            <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) onSubmit(name.trim());
                    if (e.key === 'Escape') onCancel();
                }}
                placeholder={t('group_name_placeholder', 'Collection name...')}
                className="flex-1 min-w-0 bg-transparent border-b border-white/10 focus:border-accent/50 text-sm text-white placeholder:text-stone-600 outline-none pb-1 transition-colors"
            />
            <button
                type="button"
                onClick={() => name.trim() && onSubmit(name.trim())}
                disabled={!name.trim()}
                className="px-4 py-1.5 bg-accent text-accent-foreground text-xs font-bold rounded-xl disabled:opacity-30 transition-opacity cursor-pointer"
            >
                {t('common:create', 'Create')}
            </button>
            <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
            >
                {t('common:cancel', 'Cancel')}
            </button>
        </div>
    );
};

// ─── Move To Group Dropdown ─────────────────────────────────────────────────
interface MoveDropdownProps {
    groups: ILogoGroup[];
    currentGroupId: string | undefined;
    onMove: (targetGroupId: string | null) => void;
    onClose: () => void;
}

const MoveDropdown: React.FC<MoveDropdownProps> = ({ groups, currentGroupId, onMove, onClose }) => {
    const { t } = useTranslation();

    return (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-stone-900 border border-white/10 rounded-2xl shadow-xl p-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Ungrouped option */}
            {currentGroupId && (
                <button
                    type="button"
                    onClick={() => { onMove(null); onClose(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-stone-300 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                >
                    <ImageIcon className="w-3.5 h-3.5 text-stone-500" />
                    {t('ungrouped_logos', 'Ungrouped')}
                </button>
            )}
            {groups
                .filter(g => g.id !== currentGroupId)
                .map(g => (
                    <button
                        key={g.id}
                        type="button"
                        onClick={() => { onMove(g.id); onClose(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-stone-300 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                    >
                        <Group className="w-3.5 h-3.5 text-accent/60" />
                        {g.name}
                    </button>
                ))
            }
            {groups.filter(g => g.id !== currentGroupId).length === 0 && !currentGroupId && (
                <p className="px-3 py-2 text-[10px] text-stone-600 italic">
                    {t('no_groups_to_move', 'Create a collection first')}
                </p>
            )}
        </div>
    );
};

// ─── Logo Card ──────────────────────────────────────────────────────────────
interface LogoCardProps {
    logo: ILogo;
    isActive: boolean;
    onSelect: () => void;
    onRemove?: () => void;
    allGroups: ILogoGroup[];
    onMove: (logoId: string, targetGroupId: string | null) => void;
}

const LogoCard: React.FC<LogoCardProps> = ({ logo, isActive, onSelect, onRemove, allGroups, onMove }) => {
    const [showMove, setShowMove] = useState(false);
    const [imgError, setImgError] = useState(false);
    const displayUrl = useLogoUrl(logo);

    return (
        <div
            className={cn(
                "group relative aspect-square bg-stone-900/80 border overflow-hidden transition-all duration-300 rounded-3xl cursor-pointer",
                isActive ? "border-accent ring-4 ring-accent/10 shadow-lg shadow-accent/5" : "border-white/5 hover:border-white/20"
            )}
            onClick={onSelect}
        >
            {imgError ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
                    <ImageIcon className="w-8 h-8 text-stone-700" />
                    <span className="text-[9px] text-stone-600 font-medium text-center leading-tight">
                        {logo.name}
                    </span>
                </div>
            ) : (
                <img
                    src={displayUrl}
                    alt={logo.name}
                    className="w-full h-full object-contain p-5"
                    onError={() => setImgError(true)}
                />
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                <span className="text-[10px] text-white font-bold text-center line-clamp-2">{logo.name}</span>
                <div className="flex items-center gap-1.5">
                    {!logo.isPreloaded && allGroups.length > 0 && (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setShowMove(!showMove); }}
                                className="p-1.5 bg-stone-800/80 hover:bg-accent/30 text-stone-400 hover:text-accent rounded-lg transition-colors border border-white/10 cursor-pointer"
                                aria-label="Move to group"
                            >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                            {showMove && (
                                <MoveDropdown
                                    groups={allGroups}
                                    currentGroupId={logo.groupId}
                                    onMove={(targetId) => onMove(logo.id, targetId)}
                                    onClose={() => setShowMove(false)}
                                />
                            )}
                        </div>
                    )}
                    {onRemove && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onRemove(); }}
                            className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded-lg transition-colors border border-red-500/20 cursor-pointer"
                            aria-label="Remove logo"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Active check */}
            {isActive && (
                <div className="absolute top-3 right-3 p-1.5 bg-accent text-accent-foreground rounded-full shadow-lg">
                    <CheckCircle2 className="w-4 h-4" />
                </div>
            )}
        </div>
    );
};

// ─── Logo Grid ──────────────────────────────────────────────────────────────
interface LogoGridProps {
    logos: ILogo[];
    activeLogoId: string | null;
    onSelect: (id: string) => void;
    onRemove?: (id: string) => void;
    allGroups: ILogoGroup[];
    onMove: (logoId: string, targetGroupId: string | null) => void;
}

const LogoGrid: React.FC<LogoGridProps> = ({ logos, activeLogoId, onSelect, onRemove, allGroups, onMove }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {logos.map((logo) => (
            <LogoCard
                key={logo.id}
                logo={logo}
                isActive={activeLogoId === logo.id}
                onSelect={() => onSelect(logo.id)}
                onRemove={onRemove ? () => onRemove(logo.id) : undefined}
                allGroups={allGroups}
                onMove={onMove}
            />
        ))}
    </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────
const LogoSettings: React.FC = () => {
    const { t } = useTranslation();
    const {
        settings, addCustomLogo, removeCustomLogo, setActiveLogo,
        addLogoGroup, removeLogoGroup, addLogosToGroup, moveLogoToGroup
    } = usePresenterStore();

    const [isImporting, setIsImporting] = useState(false);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [importTargetGroupId, setImportTargetGroupId] = useState<string | null>(null);

    const activeLogoId = settings.logo.activeLogoId;
    const customGroups = settings.logo.customGroups ?? [];

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleSelectFile = async (groupId?: string) => {
        if (!IpcService.isElectron()) {
            console.error('LogoSettings: Electron is not available');
            return;
        }
        try {
            const filePaths = await IpcService.selectFile({
                title: t('select_logo_title', 'Select Church Logo'),
            });

            if (filePaths && filePaths.length > 0) {
                const filePath = filePaths[0];
                if (!filePath) return;

                const fileName = filePath.split(/[/\\]/).pop() || 'Logo';
                const logoId = crypto.randomUUID();

                const result = await IpcService.invoke<{ data: Uint8Array; mimeType: string } | null>('read-file-data', filePath);
                if (!result) return;
                const blob = new Blob([new Uint8Array(result.data)], { type: result.mimeType });

                // Save to IndexedDB
                await db.logos.put({
                    id: logoId,
                    name: fileName,
                    data: blob,
                    mimeType: blob.type
                });

                const newLogo: ILogo = {
                    id: logoId,
                    name: fileName,
                    url: getLocalResourceUrl(filePath), // Keep path as fallback
                    isFromDb: true,
                    groupId: groupId || undefined
                };
                if (groupId) {
                    addLogosToGroup([newLogo], groupId);
                } else {
                    addCustomLogo(newLogo);
                }
            }
        } catch (err) {
            console.error('LogoSettings: selectFile failed:', err);
        }
    };

    const handleImportFolder = async (groupId?: string) => {
        if (!IpcService.isElectron()) return;
        setIsImporting(true);
        setImportTargetGroupId(groupId ?? null);
        try {
            const folderPath = await IpcService.selectFolder();
            if (folderPath) {
                const results: ILogo[] = await IpcService.invoke<ILogo[]>('read-directory-recursive', folderPath);

                // For folder imports, we should probably also convert to Blobs for consistency 
                // but if there are many files, it might be heavy. 
                // However, the user request says "somewhy importing doesn't work appropriately".
                // Let's migrate them to Blobs one by one.

                const dbLogos: ILogo[] = await Promise.all(results.map(async (l) => {
                    try {
                        // Extract path from local-resource://[host]/path
                        const originalPath = l.url.replace(/^local-resource:\/\/(localhost)?/, '');
                        const result = await IpcService.invoke<{ data: Uint8Array; mimeType: string } | null>('read-file-data', originalPath);

                        if (!result) throw new Error('Failed to read file data');

                        const blob = new Blob([new Uint8Array(result.data)], { type: result.mimeType });
                        await db.logos.put({
                            id: l.id,
                            name: l.name,
                            data: blob,
                            mimeType: blob.type
                        });
                        return {
                            ...l,
                            url: l.url, // Keep local-resource:// path as fallback
                            isFromDb: true
                        };
                    } catch (e) {
                        console.error('Failed to import logo to DB:', l.name, e);
                        return l; // Fallback to local-resource if DB save fails
                    }
                }));

                if (groupId) {
                    addLogosToGroup(dbLogos, groupId);
                } else {
                    const folderName = folderPath.split('/').pop() || 'Imported';
                    const newGroup: ILogoGroup = {
                        id: crypto.randomUUID(),
                        name: folderName,
                        nameRu: folderName,
                        logos: dbLogos.map(l => ({ ...l, groupId: undefined })),
                        isUserCreated: true,
                        folderPath
                    };
                    newGroup.logos = newGroup.logos.map(l => ({ ...l, groupId: newGroup.id }));
                    addLogoGroup(newGroup);
                }
            }
        } finally {
            setIsImporting(false);
            setImportTargetGroupId(null);
        }
    };

    const handleRefreshFolder = async (group: ILogoGroup) => {
        if (!group.folderPath || !IpcService.isElectron()) return;
        setIsImporting(true);
        try {
            const results: ILogo[] = await IpcService.invoke<ILogo[]>('read-directory-recursive', group.folderPath);
            // Filter out already-existing URLs
            const existingUrls = new Set(group.logos.map(l => l.url));
            const newLogos = results.filter(l => !existingUrls.has(l.url));
            if (newLogos.length > 0) {
                const dbLogos: ILogo[] = await Promise.all(newLogos.map(async (l) => {
                    const resp = await fetch(l.url);
                    const blob = await resp.blob();
                    await db.logos.put({
                        id: l.id,
                        name: l.name,
                        data: blob,
                        mimeType: blob.type
                    });
                    return { ...l, url: '', isFromDb: true };
                }));
                addLogosToGroup(dbLogos, group.id);
            }
        } finally {
            setIsImporting(false);
        }
    };

    const handleCreateGroup = (name: string) => {
        const newGroup: ILogoGroup = {
            id: crypto.randomUUID(),
            name,
            nameRu: name,
            logos: [],
            isUserCreated: true
        };
        addLogoGroup(newGroup);
        setShowCreateGroup(false);
    };

    const toggleCollapse = (groupId: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const handleRemoveFromGroup = (logoId: string, groupId: string) => {
        // Remove logo from group by moving to ungrouped — or just delete
        // We'll delete it entirely
        const { settings: s } = usePresenterStore.getState();
        const newGroups = s.logo.customGroups.map(g =>
            g.id === groupId
                ? { ...g, logos: g.logos.filter(l => l.id !== logoId) }
                : g
        );
        const wasActive = s.logo.activeLogoId === logoId;
        usePresenterStore.setState({
            settings: {
                ...s,
                logo: {
                    ...s.logo,
                    customGroups: newGroups,
                    activeLogoId: wasActive ? null : s.logo.activeLogoId
                }
            }
        });
        usePresenterStore.getState().syncSettings();
    };

    // ── Render ──────────────────────────────────────────────────────────────
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
