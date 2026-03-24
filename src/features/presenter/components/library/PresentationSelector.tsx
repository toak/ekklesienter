import React, { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    FileText,
    Search,
    Upload,
    Download,
    HardDrive,
    Plus,
    Trash2,
    Edit3,
    Check,
    X,
    Layers
} from 'lucide-react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { cn } from '@/core/utils/cn';
import { format } from 'date-fns';
import { createPortal } from 'react-dom';
import { db } from '@/core/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { IPresentationFile } from '@/core/types';
import { EktService } from '../../services/ektService';
import { EktpService } from '../../services/ektpService';
import { toast } from '@/core/utils/toast';
import { truncateMiddle } from '@/core/utils/markdownUtils';

interface PresentationSelectorProps {
    className?: string;
}

const PresentationSelector: React.FC<PresentationSelectorProps> = ({ className }) => {
    const { t } = useTranslation();
    const {
        activeService,
        activeServiceId,
        activePresentation,
        activePresentationId,
        setActivePresentation,
        setActiveService,
        createPresentation,
        renamePresentation,
        removePresentation
    } = usePresentationStore();

    const { openModal } = useModalStore();

    const [isOpen, setIsOpen] = useState(false);
    const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [search, setSearch] = useState('');
    const [addingNew, setAddingNew] = useState(false);
    const [newName, setNewName] = useState('');
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // Load presentations from DB for the active service
    const presentations = useLiveQuery(async () => {
        if (!activeService?.presentationIds?.length) return [];
        const all = await db.presentationFiles.bulkGet(activeService.presentationIds);
        return all.filter(Boolean) as IPresentationFile[];
    }, [activeService?.presentationIds]) || [];

    const filteredPresentations = useMemo(() => {
        if (!search) return presentations;
        const q = search.toLowerCase();
        return presentations.filter(p => p.name.toLowerCase().includes(q));
    }, [presentations, search]);

    const handleToggle = () => {
        if (!isOpen && triggerRef.current) {
            setTriggerRect(triggerRef.current.getBoundingClientRect());
        }
        setIsOpen(!isOpen);
    };

    // Position above trigger button
    const dropdownPosition = useMemo(() => {
        if (!triggerRect) return { bottom: '4.5rem', left: '1rem', width: '280px' };
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

    const handleCreatePresentation = async () => {
        if (!activeServiceId || !newName.trim()) {
            setAddingNew(false);
            return;
        }
        await createPresentation(newName, { serviceId: activeServiceId, isMaster: false });
        setNewName('');
        setAddingNew(false);
    };

    const handleRenamePresentation = async (id: string) => {
        if (!renameValue.trim()) {
            setRenamingId(null);
            return;
        }
        await renamePresentation(id, renameValue);
        setRenamingId(null);
        setRenameValue('');
    };

    const handleExportPresentation = async (id: string) => {
        try {
            const pres = await db.presentationFiles.get(id);
            if (!pres) return;

            const { blob } = await EktpService.pack(pres.id);

            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await (window as any).showSaveFilePicker({
                        suggestedName: `${pres.name}.ektp`,
                        types: [{ description: 'Presentation Package', accept: { 'application/zip': ['.ektp'] } }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    await db.presentationFiles.update(id, { fileHandle: handle });
                    toast.success(t('export_success', 'Presentation exported'), t('file_saved_to_disk', 'File saved to disk'));
                    return;
                } catch (err: any) {
                    if (err.name === 'AbortError') return;
                }
            }
            EktpService.download(blob, pres.name);
        } catch (error) {
            console.error('Export failed:', error);
            toast.error(t('export_error', 'Export failed'));
        }
    };

    const handleImportPresentation = async () => {
        try {
            const [handle] = await (window as any).showOpenFilePicker({
                types: [{
                    description: 'Presentation or PowerPoint',
                    accept: { 'application/zip': ['.ektp', '.pptx'] }
                }],
                multiple: false
            });

            const file = await handle.getFile();

            if (file.name.endsWith('.ektp')) {
                const presentationId = await EktpService.unpack(file);
                const presentation = await db.presentationFiles.get(presentationId);
                
                if (presentation) {
                    const newId = `imported-${crypto.randomUUID()}`;
                    await db.presentationFiles.add({
                        ...presentation,
                        id: newId,
                        serviceId: activeServiceId || undefined,
                        updatedAt: new Date(),
                        fileHandle: handle
                    });

                    if (activeServiceId) {
                        const service = await db.serviceFiles.get(activeServiceId);
                        if (service) {
                            await db.serviceFiles.update(activeServiceId, {
                                presentationIds: [...service.presentationIds, newId]
                            });
                            await setActiveService(activeServiceId);
                            // Auto-select the newly imported presentation
                            await setActivePresentation(newId);
                        }
                    }
                }
                toast.success(t('import_success_ektp', 'Presentation imported'), t('ready_to_present', 'Ready to use in your workflow'));
            } else if (file.name.endsWith('.pptx')) {
                const { PptxImportService } = await import('@/features/presenter/services/PptxImportService.ts');
                const presentation = await PptxImportService.convert(file);
                const newId = `imported-pptx-${crypto.randomUUID()}`;

                await db.presentationFiles.add({
                    ...presentation,
                    id: newId,
                    serviceId: activeServiceId || undefined,
                    updatedAt: new Date(),
                    isMaster: false
                });

                if (activeServiceId) {
                    const service = await db.serviceFiles.get(activeServiceId);
                    if (service) {
                        await db.serviceFiles.update(activeServiceId, {
                            presentationIds: [...service.presentationIds, newId]
                        });
                        await setActiveService(activeServiceId);
                        // Auto-select the newly imported PPTX presentation
                        await setActivePresentation(newId);
                    }
                }
                toast.success(t('pptx_import_success', 'PowerPoint imported'), t('converted_successfully', 'Converted successfully'));
            }

            setIsOpen(false);
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('Import failed:', error);
            toast.error(t('import_error', 'Import failed'));
        }
    };

    return (
        <div className={cn("relative", className)}>
            <button
                ref={triggerRef}
                onClick={handleToggle}
                className="w-full h-full flex items-center gap-3 p-3 rounded-2xl bg-stone-900/40 border border-white/5 hover:border-accent/40 hover:bg-stone-800/60 transition-all group active:scale-95 shadow-xl shadow-black/20"
            >
                <div className="min-w-10 h-8 px-2 rounded-xl bg-stone-800/50 flex items-center justify-center border border-white/5 shrink-0 group-hover:bg-accent/10 group-hover:border-accent/20 transition-all">
                    <Layers className="w-4 h-4 text-stone-600 group-hover:text-accent transition-colors" />
                </div>
                <div className="flex flex-col min-w-0 text-left">
                    <span className="text-[10px] font-bold text-stone-300 uppercase leading-none truncate group-hover:text-white transition-colors">
                        {activePresentation ? truncateMiddle(activePresentation.name, 14) : t('select_presentation', 'Select Presentation')}
                    </span>
                    <span className="text-[8px] font-bold text-stone-600 uppercase tracking-widest mt-1 truncate group-hover:text-stone-400">
                        {activePresentation ? `${activePresentation.slides.length} ${t('slides', 'slides')}` : t('no_presentation_active', 'None Active')}
                    </span>
                </div>
                {activePresentation?.fileHandle && (
                    <div className="ml-auto shrink-0" title={t('linked_to_disk', 'Linked to disk')}>
                        <HardDrive className="w-3 h-3 text-accent" />
                    </div>
                )}
            </button>

            {isOpen && createPortal(
                <div className="fixed inset-0 z-10002 pointer-events-none">
                    <div className="absolute inset-0 pointer-events-auto" onClick={() => setIsOpen(false)} />

                    <div
                        className="absolute bg-stone-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[420px] overflow-hidden animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
                        style={dropdownPosition}
                    >
                        {/* Header */}
                        <div className="p-3 border-b border-white/5 flex items-center justify-between bg-stone-950/40">
                            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                {t('presentations', 'Presentations')}
                            </h3>
                            <div className="flex items-center gap-1">
                                {activeServiceId && !addingNew && (
                                    <button
                                        onClick={() => setAddingNew(true)}
                                        className="p-1 hover:bg-accent/10 rounded-lg text-stone-500 hover:text-accent transition-all"
                                        title={t('new_presentation', 'New Presentation')}
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/5 rounded-lg text-stone-600 hover:text-white transition-all">
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
                                    placeholder={t('search_presentations', 'Search presentations...')}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full bg-white/5 border border-white/5 rounded-lg py-1.5 pl-8 pr-3 text-[11px] text-stone-200 focus:outline-none focus:border-accent/40 transition-all placeholder:text-stone-700"
                                />
                            </div>
                        </div>

                        {/* New Presentation Input */}
                        {addingNew && (
                            <div className="p-2 border-b border-white/5 bg-stone-950/10">
                                <div className="flex gap-1 animate-in slide-in-from-top-2 duration-200">
                                    <input
                                        type="text"
                                        autoFocus
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreatePresentation();
                                            if (e.key === 'Escape') { setAddingNew(false); setNewName(''); }
                                        }}
                                        placeholder={t('presentation_name', 'Presentation Name...')}
                                        className="flex-1 min-w-0 bg-white/5 border border-accent/30 rounded-lg py-1.5 px-3 text-[11px] text-stone-200 focus:outline-none transition-all placeholder:text-stone-700 font-medium"
                                    />
                                    <button
                                        onClick={handleCreatePresentation}
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

                        {/* Presentations List */}
                        {activeService ? (
                            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 no-scrollbar min-h-0">
                                {filteredPresentations.length > 0 ? (
                                    filteredPresentations.map(pres => (
                                        <div
                                            key={pres.id}
                                            draggable
                                            onDragStart={(e) => {
                                                e.stopPropagation();
                                                e.dataTransfer.setData('application/json', JSON.stringify({
                                                    source: 'presentation-library',
                                                    presentationId: pres.id
                                                }));
                                                e.dataTransfer.effectAllowed = 'copyMove';
                                            }}
                                            className={cn(
                                                "group w-full flex items-center justify-between p-2 rounded-lg transition-all text-left border cursor-pointer",
                                                activePresentationId === pres.id
                                                    ? "bg-accent/10 border-accent/20"
                                                    : "hover:bg-white/5 border-transparent hover:border-white/5"
                                            )}
                                            onClick={() => { if (renamingId !== pres.id) { setActivePresentation(pres.id); setIsOpen(false); } }}
                                        >
                                            {renamingId === pres.id ? (
                                                <div className="flex-1 flex gap-1 min-w-0">
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        value={renameValue}
                                                        onChange={(e) => setRenameValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleRenamePresentation(pres.id);
                                                            if (e.key === 'Escape') setRenamingId(null);
                                                        }}
                                                        className="flex-1 min-w-0 bg-white/5 border border-accent/30 rounded py-0.5 px-2 text-[11px] text-stone-200 focus:outline-none"
                                                    />
                                                    <button onClick={() => handleRenamePresentation(pres.id)} className="p-1 text-accent hover:bg-accent/10 rounded shrink-0">
                                                        <Check className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex-1 flex items-center gap-2 min-w-0">
                                                        {/* Thumbnail */}
                                                        <div className={cn(
                                                            "w-8 h-6 rounded overflow-hidden flex items-center justify-center shrink-0 border bg-stone-800",
                                                            activePresentationId === pres.id ? "border-accent/50 shadow-[0_0_8px_rgba(var(--accent-rgb),0.3)]" : "border-white/10"
                                                        )}>
                                                            {pres.thumbnailUrl ? (
                                                                <img src={pres.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                                                            ) : (
                                                                <FileText className={cn("w-3 h-3", activePresentationId === pres.id ? "text-accent" : "text-stone-600")} />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <div className="flex items-center gap-1 min-w-0">
                                                                <span className={cn(
                                                                    "text-[11px] font-bold truncate",
                                                                    activePresentationId === pres.id ? "text-accent" : "text-stone-300"
                                                                )}>
                                                                    {pres.name}
                                                                </span>
                                                                {pres.isMaster && (
                                                                    <span className="text-[7px] font-black bg-accent/20 text-accent px-1 py-0.5 rounded uppercase tracking-wider shrink-0">
                                                                        {t('master', 'Master')}
                                                                    </span>
                                                                )}
                                                                {pres.fileHandle && (
                                                                    <HardDrive className="w-2.5 h-2.5 text-accent shrink-0" />
                                                                )}
                                                            </div>
                                                            <span className="text-[8px] font-bold text-stone-600 uppercase tracking-widest leading-none mt-0.5">
                                                                {pres.slides.length} {t('slides', 'slides')}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleExportPresentation(pres.id); }}
                                                            className="p-1 hover:bg-white/10 rounded text-stone-500 hover:text-accent transition-all"
                                                            title={t('export_presentation', 'Export (.ektp)')}
                                                        >
                                                            <Upload className="w-3 h-3" />
                                                        </button>
                                                        {!pres.isMaster && (
                                                            <>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setRenamingId(pres.id); setRenameValue(pres.name); }}
                                                                    className="p-1 hover:bg-white/10 rounded text-stone-500 hover:text-stone-300 transition-all"
                                                                    title={t('rename', 'Rename')}
                                                                >
                                                                    <Edit3 className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openModal(ModalType.CONFIRM, {
                                                                            title: t('confirm_delete', 'Confirm Delete'),
                                                                            message: t('confirm_delete_presentation', 'Delete this presentation?'),
                                                                            variant: 'danger',
                                                                            onSelection: (confirmed: boolean) => {
                                                                                if (confirmed) {
                                                                                    removePresentation(pres.id);
                                                                                }
                                                                            }
                                                                        });
                                                                    }}
                                                                    className="p-1 hover:bg-red-500/20 rounded text-stone-500 hover:text-red-400 transition-all"
                                                                    title={t('delete', 'Delete')}
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>

                                                    {activePresentationId === pres.id && (
                                                        <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(var(--accent-rgb),0.5)] ml-1 shrink-0" />
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-8 flex flex-col items-center justify-center gap-2 opacity-30">
                                        <Layers className="w-8 h-8 text-stone-500" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest">
                                            {search ? t('no_results', 'No results') : t('no_presentations', 'No presentations')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 py-12 flex flex-col items-center justify-center gap-3 opacity-30">
                                <Layers className="w-8 h-8" />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                                    {t('select_service_first', 'Select Service First')}
                                </p>
                            </div>
                        )}

                        {/* Footer: Import */}
                        {activeServiceId && (
                            <div className="p-2 border-t border-white/5 bg-stone-950/40 shrink-0">
                                <button
                                    onClick={handleImportPresentation}
                                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black text-stone-500 hover:text-accent uppercase tracking-widest hover:bg-accent/10 transition-all cursor-pointer"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    {t('import_presentation', 'Import (.ektp / .pptx)')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default PresentationSelector;
