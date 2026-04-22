import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { LogoService } from '@/core/services/LogoService';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';
import { IpcService } from '@/core/services/IpcService';
import { ILogo, ILogoGroup } from '@/core/types';

export const useLogoSettings = () => {
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

                await LogoService.saveLogo({
                    id: logoId,
                    name: fileName,
                    data: blob,
                    mimeType: blob.type
                });

                const newLogo: ILogo = {
                    id: logoId,
                    name: fileName,
                    url: getLocalResourceUrl(filePath), 
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

                const dbLogos: ILogo[] = await Promise.all(results.map(async (l) => {
                    try {
                        const originalPath = l.url.replace(/^local-resource:\/\/(localhost)?/, '');
                        const result = await IpcService.invoke<{ data: Uint8Array; mimeType: string } | null>('read-file-data', originalPath);

                        if (!result) throw new Error('Failed to read file data');

                        const blob = new Blob([new Uint8Array(result.data)], { type: result.mimeType });
                        await LogoService.saveLogo({
                            id: l.id,
                            name: l.name,
                            data: blob,
                            mimeType: blob.type
                        });
                        return {
                            ...l,
                            url: l.url,
                            isFromDb: true
                        };
                    } catch (e) {
                        console.error('Failed to import logo to DB:', l.name, e);
                        return l; 
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
            const existingUrls = new Set(group.logos.map(l => l.url));
            const newLogos = results.filter(l => !existingUrls.has(l.url));
            if (newLogos.length > 0) {
                const dbLogos: ILogo[] = await Promise.all(newLogos.map(async (l) => {
                    const resp = await fetch(l.url);
                    const blob = await resp.blob();
                    await LogoService.saveLogo({
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

    return {
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
    };
};
