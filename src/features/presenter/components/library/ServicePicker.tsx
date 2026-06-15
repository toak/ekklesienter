import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import {
    Search,
    X,
    Plus,
    Check,
    Edit3,
    Trash2,
    Upload,
    Download,
    Layers,
    Copy
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { cn } from '@/core/utils/cn';
import { IServiceFile, IPresentationFile } from '@/core/types';
import { EktService } from '../../services/ektService';
import { toast } from '@/core/utils/toast';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { getUniqueServiceName, getUniquePresentationName } from '@/core/utils/nameUtils';

interface ServicePickerProps {
    currentServiceId: string | null;
    onSelect: (serviceId: string) => void;
    onClose: () => void;
    triggerRect?: DOMRect | null;
    onServiceCreated?: (serviceId: string) => void;
}

const ServicePicker: React.FC<ServicePickerProps> = ({
    currentServiceId,
    onSelect,
    onClose,
    triggerRect,
    onServiceCreated
}) => {
    const { t, i18n } = useTranslation();
    const { openModal } = useModalStore();
    const [search, setSearch] = useState('');
    const [addingNew, setAddingNew] = useState(false);
    const [newName, setNewName] = useState('');
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        service: IServiceFile;
    } | null>(null);
    const isRu = i18n.language?.substring(0, 2) === 'ru';

    const services = useLiveQuery(() => db.serviceFiles.orderBy('updatedAt').reverse().toArray()) || [];

    const filteredServices = useMemo(() => {
        if (!search) return services;
        const q = search.toLowerCase();
        return services.filter(s =>
            s.name.toLowerCase().includes(q) ||
            (s.nameRu && s.nameRu.toLowerCase().includes(q))
        );
    }, [services, search]);

    // Position above trigger button (like TranslationPicker)
    const position = useMemo(() => {
        if (!triggerRect) return { bottom: '1rem', left: '1rem', width: '280px' };
        const spacing = 4;
        const windowHeight = window.innerHeight;
        const menuHeight = 420;
        const bottom = windowHeight - triggerRect.top + spacing;
        const left = triggerRect.left;
        const width = Math.max(triggerRect.width, 280);

        if (triggerRect.top < menuHeight + spacing) {
            return { top: triggerRect.bottom + spacing, left, width };
        }
        return { bottom, left, width };
    }, [triggerRect]);

    const handleCreateService = async () => {
        if (!newName.trim()) {
            setAddingNew(false);
            return;
        }

        const serviceId = crypto.randomUUID();
        const masterId = crypto.randomUUID();
        const now = new Date();

        const masterPres: IPresentationFile = {
            id: masterId,
            name: `${newName} (Master)`,
            serviceId: serviceId,
            isMaster: true,
            createdAt: now,
            updatedAt: now,
            lastOpened: now,
            slides: []
        };
        await db.presentationFiles.add(masterPres);

        await db.serviceFiles.add({
            id: serviceId,
            name: newName,
            nameRu: newName,
            description: '',
            presentationIds: [masterId],
            masterPresentationId: masterId,
            createdAt: now,
            updatedAt: now,
            lastOpened: now
        });

        setNewName('');
        setAddingNew(false);

        if (onServiceCreated) {
            onServiceCreated(serviceId);
        }
    };

    const handleRenameService = async (id: string) => {
        if (!renameValue.trim()) {
            setRenamingId(null);
            return;
        }
        await db.serviceFiles.update(id, { name: renameValue, nameRu: renameValue });
        setRenamingId(null);
        setRenameValue('');
    };

    const handleDeleteService = async (id: string) => {
        openModal(ModalType.CONFIRM, {
            title: t('confirm_delete', 'Confirm Delete'),
            message: t('confirm_delete_service', 'Delete this service and all its presentations?'),
            variant: 'danger',
            onSelection: async (confirmed: boolean) => {
                if (confirmed) {
                    const service = await db.serviceFiles.get(id);
                    if (service) {
                        for (const presId of service.presentationIds) {
                            await db.presentationFiles.delete(presId);
                        }
                        await db.serviceFiles.delete(id);
                    }
                    toast.success(t('service_deleted', 'Service deleted'));
                }
            }
        });
    };

    const handleExportService = async (id: string) => {
        try {
            const service = await db.serviceFiles.get(id);
            if (!service) return;

            const blob = await EktService.pack(id);

            if (window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: `${service.name}.ekt`,
                        types: [{ description: 'Service File', accept: { 'application/zip': ['.ekt'] } }]
                    });
                    const writable = await (handle as any).createWritable();
                    await writable.write(blob);
                    await writable.close();
                    await db.serviceFiles.update(id, { fileHandle: handle });
                    toast.success(t('export_success', 'Service exported'));
                    return;
                } catch (err: unknown) {
                    if (err instanceof Error && err.name === 'AbortError') return;
                }
            }
            EktService.download(blob, service.name);
        } catch (error) {
            console.error('Export failed:', error);
            toast.error(t('export_error', 'Export failed'));
        }
    };
 
    const handleImportService = async () => {
        try {
            if (!window.showOpenFilePicker) throw new Error('File System Access API not supported');
            const [handle] = await window.showOpenFilePicker({
                types: [{ description: 'Service File', accept: { 'application/zip': ['.ekt'] } }],
                multiple: false
            });
            const file = await handle.getFile();
            const pending = await EktService.prepareImport(file);

            if (pending.conflict) {
                openModal(ModalType.CONFIRM, {
                    title: t('import_conflict', 'Service already exists'),
                    message: t('import_conflict_message', 'A service with this ID already exists. Do you want to replace it or create a copy?'),
                    confirmLabel: t('replace', 'Replace'),
                    cancelLabel: t('create_copy', 'Create Copy'),
                    variant: 'warning',
                    onSelection: async (confirmed: boolean) => {
                        const resolution = confirmed ? 'replace' : 'create_new';
                        const newServiceId = await EktService.commitImport(pending, resolution);
                        if (onServiceCreated) onServiceCreated(newServiceId);
                        toast.success(t('import_success_ekt', 'Service imported'));
                        onClose();
                    }
                });
            } else {
                const newServiceId = await EktService.commitImport(pending, 'create_new');
                if (onServiceCreated) onServiceCreated(newServiceId);
                toast.success(t('import_success_ekt', 'Service imported'));
                onClose();
            }
        } catch (error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') return;
            console.error('Import failed:', error);
            toast.error(t('import_error', 'Import failed'));
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-9999 pointer-events-none">
            <button
                type="button"
                aria-label={t('close_menu', 'Close menu')}
                className="absolute inset-0 w-full h-full bg-transparent border-0 cursor-default pointer-events-auto"
                onClick={onClose}
            />

            <div
                className="absolute bg-stone-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[420px] overflow-hidden animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
                style={position}
            >
                {/* Header */}
                <div className="p-3 border-b border-white/5 flex items-center justify-between bg-stone-950/40">
                    <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                        {t('services', 'Services')}
                    </h3>
                    <div className="flex items-center gap-1">
                        {!addingNew && (
                            <button
                                onClick={() => setAddingNew(true)}
                                className="p-1 hover:bg-accent/10 rounded-lg text-stone-500 hover:text-accent transition-all"
                                title={t('new_service', 'New Service')}
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg text-stone-600 hover:text-white transition-all">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="p-2 border-b border-white/5 bg-stone-950/20">
                    <div className="relative group">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-600 group-focus-within:text-accent" />
                        <input
                            type="text"
                            autoFocus
                            placeholder={t('search_services', 'Search services...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-white/5 border border-white/5 rounded-lg py-1.5 pl-8 pr-3 text-[11px] text-stone-200 focus:outline-none focus:border-accent/40 transition-all placeholder:text-stone-700"
                        />
                    </div>
                </div>

                {/* New Service Inline Input */}
                {addingNew && (
                    <div className="p-2 border-b border-white/5 bg-stone-950/10">
                        <div className="flex gap-1 animate-in slide-in-from-top-2 duration-200">
                            <input
                                type="text"
                                autoFocus
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreateService();
                                    if (e.key === 'Escape') { setAddingNew(false); setNewName(''); }
                                }}
                                placeholder={t('service_name', 'Service Name...')}
                                className="flex-1 min-w-0 bg-white/5 border border-accent/30 rounded-lg py-1.5 px-3 text-[11px] text-stone-200 focus:outline-none transition-all placeholder:text-stone-700 font-medium"
                            />
                            <button
                                onClick={handleCreateService}
                                className="w-8 flex items-center justify-center bg-accent/20 hover:bg-accent/30 text-accent rounded-lg transition-all border border-accent/10 shrink-0"
                            >
                                <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => { setAddingNew(false); setNewName(''); }}
                                className="w-8 flex items-center justify-center bg-white/5 hover:bg-white/10 text-stone-500 rounded-lg transition-all border border-white/5 shrink-0"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Services List */}
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 no-scrollbar min-h-0">
                    {filteredServices.map(service => (
                        <div
                            key={service.id}
                            className={cn(
                                "group w-full flex items-center justify-between p-2 rounded-lg transition-all text-left border cursor-pointer",
                                currentServiceId === service.id
                                    ? "bg-accent/10 border-accent/20"
                                    : "hover:bg-white/5 border-transparent hover:border-white/5"
                            )}
                            onClick={() => { if (renamingId !== service.id) { onSelect(service.id); onClose(); } }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setContextMenu({ x: e.clientX, y: e.clientY, service });
                            }}
                        >
                            {renamingId === service.id ? (
                                <div className="flex-1 flex gap-1 min-w-0">
                                    <input
                                        type="text"
                                        autoFocus
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRenameService(service.id);
                                            if (e.key === 'Escape') setRenamingId(null);
                                        }}
                                        className="flex-1 min-w-0 bg-white/5 border border-accent/30 rounded py-0.5 px-2 text-[11px] text-stone-200 focus:outline-none"
                                    />
                                    <button onClick={() => handleRenameService(service.id)} className="p-1 text-accent hover:bg-accent/10 rounded shrink-0">
                                        <Check className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1 flex items-center gap-2.5 min-w-0">
                                        <div className={cn(
                                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                            currentServiceId === service.id ? "bg-accent/20 text-accent" : "bg-stone-800/50 text-stone-600 group-hover:text-stone-400"
                                        )}>
                                            <Layers className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className={cn("text-[11px] font-bold truncate", currentServiceId === service.id ? "text-accent" : "text-stone-300")}>
                                                {isRu ? service.nameRu : service.name}
                                            </span>
                                            <span className="text-[8px] font-bold text-stone-600 uppercase tracking-widest leading-none mt-0.5">
                                                {t('presentations_count', { count: service.presentationIds.length, defaultValue: '{{count}} presentations' })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleExportService(service.id); }}
                                            className="p-1 hover:bg-white/10 rounded text-stone-500 hover:text-accent transition-all"
                                            title={t('export_service', 'Export (.ekt)')}
                                        >
                                            <Upload className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setRenamingId(service.id); setRenameValue(service.name); }}
                                            className="p-1 hover:bg-white/10 rounded text-stone-500 hover:text-stone-300 transition-all"
                                            title={t('rename', 'Rename')}
                                        >
                                            <Edit3 className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteService(service.id); }}
                                            className="p-1 hover:bg-red-500/20 rounded text-stone-500 hover:text-red-400 transition-all"
                                            title={t('delete', 'Delete')}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>

                                    {currentServiceId === service.id && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(var(--accent-rgb),0.5)] ml-1 shrink-0" />
                                    )}
                                </>
                            )}
                        </div>
                    ))}

                    {filteredServices.length === 0 && (
                        <div className="py-8 flex flex-col items-center justify-center gap-2 opacity-30">
                            <Layers className="w-8 h-8 text-stone-500" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">
                                {search ? t('no_results', 'No results') : t('no_services', 'No services yet')}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer: Import */}
                <div className="p-2 border-t border-white/5 bg-stone-950/40 shrink-0">
                    <button
                        onClick={handleImportService}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black text-stone-500 hover:text-accent uppercase tracking-widest hover:bg-accent/10 transition-all cursor-pointer"
                    >
                        <Download className="w-3.5 h-3.5" />
                        {t('import_service', 'Import Service (.ekt)')}
                    </button>
                </div>

                {contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        onClose={() => setContextMenu(null)}
                    >
                        <ContextMenuItem
                            icon={<Copy className="w-3 h-3" />}
                            label={t('duplicate', 'Duplicate')}
                            onClick={async () => {
                                const serviceId = crypto.randomUUID();
                                const now = new Date();
                                const newName = await getUniqueServiceName(contextMenu.service.name);

                                const duplicatedPresIds: string[] = [];
                                let newMasterPresId = '';

                                for (const presId of contextMenu.service.presentationIds) {
                                    const originalPres = await db.presentationFiles.get(presId);
                                    if (originalPres) {
                                        const clonePres = structuredClone(originalPres);
                                        clonePres.id = crypto.randomUUID();
                                        clonePres.serviceId = serviceId;
                                        clonePres.createdAt = now;
                                        clonePres.updatedAt = now;
                                        clonePres.lastOpened = now;
                                        
                                        if (originalPres.id === contextMenu.service.masterPresentationId) {
                                            clonePres.name = `${newName} (Master)`;
                                            clonePres.isMaster = true;
                                            newMasterPresId = clonePres.id;
                                        } else {
                                            clonePres.name = await getUniquePresentationName(originalPres.name);
                                        }
                                        await db.presentationFiles.add(clonePres);
                                        duplicatedPresIds.push(clonePres.id);
                                    }
                                }

                                await db.serviceFiles.add({
                                    id: serviceId,
                                    name: newName,
                                    nameRu: newName,
                                    description: contextMenu.service.description || '',
                                    presentationIds: duplicatedPresIds,
                                    masterPresentationId: newMasterPresId,
                                    createdAt: now,
                                    updatedAt: now,
                                    lastOpened: now
                                });

                                toast.success(t('service_duplicated', 'Service duplicated'));
                                setContextMenu(null);
                            }}
                        />
                        <ContextMenuItem
                            icon={<Edit3 className="w-3 h-3" />}
                            label={t('rename', 'Rename')}
                            onClick={() => {
                                setRenamingId(contextMenu.service.id);
                                setRenameValue(contextMenu.service.name);
                                setContextMenu(null);
                            }}
                        />
                        <ContextMenuItem
                            icon={<Upload className="w-3 h-3" />}
                            label={t('export', 'Export')}
                            onClick={() => {
                                handleExportService(contextMenu.service.id);
                                setContextMenu(null);
                            }}
                        />
                        <div className="h-px bg-white/5 my-1 mx-2" />
                        <ContextMenuItem
                            icon={<Trash2 className="w-3 h-3" />}
                            label={t('delete', 'Delete')}
                            danger
                            onClick={() => {
                                handleDeleteService(contextMenu.service.id);
                                setContextMenu(null);
                            }}
                        />
                    </ContextMenu>
                )}
            </div>
        </div>,
        document.body
    );
};

export default ServicePicker;
