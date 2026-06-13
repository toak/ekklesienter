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
    Layers,
    Copy,
    Star,
    Tag,
    ArrowUpDown
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
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { getUniquePresentationName } from '@/core/utils/nameUtils';

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
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        presentation: IPresentationFile;
    } | null>(null);

    const [filterStarredOnly, setFilterStarredOnly] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'master' | 'usual'>('all');
    const [selectedTag, setSelectedTag] = useState<string>('');
    const [sortBy, setSortBy] = useState<'lastOpened' | 'alphabetical' | 'createdAt'>('lastOpened');
    const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
    const [tagSearchInput, setTagSearchInput] = useState('');

    // Load presentations from DB for the active service
    const presentations = useLiveQuery(async () => {
        if (!activeService?.presentationIds?.length) return [];
        const all = await db.presentationFiles.bulkGet(activeService.presentationIds);
        return all.filter(Boolean) as IPresentationFile[];
    }, [activeService?.presentationIds]) || [];

    const allExistingTags = useMemo(() => {
        const tagsSet = new Set<string>();
        presentations.forEach(p => {
            if (p.tags) {
                p.tags.forEach(t => tagsSet.add(t));
            }
        });
        return Array.from(tagsSet);
    }, [presentations]);

    const filteredPresentations = useMemo(() => {
        let list = [...presentations];

        // 1. Search Query
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(q));
        }

        // 2. Starred Filter
        if (filterStarredOnly) {
            list = list.filter(p => p.isStarred);
        }

        // 3. Type Filter
        if (filterType === 'master') {
            list = list.filter(p => p.isMaster);
        } else if (filterType === 'usual') {
            list = list.filter(p => !p.isMaster);
        }

        // 4. Tag Filter
        if (selectedTag) {
            list = list.filter(p => p.tags && p.tags.includes(selectedTag));
        }

        // 5. Sorting
        list.sort((a, b) => {
            if (sortBy === 'alphabetical') {
                return a.name.localeCompare(b.name);
            }
            if (sortBy === 'createdAt') {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            }
            // Default: lastOpened / updatedAt
            const dateA = a.lastOpened ? new Date(a.lastOpened).getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
            const dateB = b.lastOpened ? new Date(b.lastOpened).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
            return dateB - dateA;
        });

        return list;
    }, [presentations, search, filterStarredOnly, filterType, selectedTag, sortBy]);

    const handleAddTag = async (presentationId: string, newTag: string) => {
        const trimmed = newTag.trim();
        if (!trimmed) return;
        const pres = await db.presentationFiles.get(presentationId);
        if (pres) {
            const currentTags = pres.tags || [];
            if (currentTags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
                toast.error(t('tag_exists', 'Tag already exists'));
                return;
            }
            const updated = [...currentTags, trimmed];
            await db.presentationFiles.update(presentationId, { tags: updated });
            setTagSearchInput('');
        }
    };

    const handleRemoveTag = async (presentationId: string, tagToRemove: string) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (pres) {
            const updated = (pres.tags || []).filter(t => t !== tagToRemove);
            await db.presentationFiles.update(presentationId, { tags: updated });
        }
    };

    const handleToggleStar = async (presentationId: string) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (pres) {
            await db.presentationFiles.update(presentationId, { isStarred: !pres.isStarred });
        }
    };

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
                <div className="flex flex-col min-w-0 text-left" title={activePresentation?.name}>
                    <span className="text-[10px] font-bold text-stone-300 uppercase leading-none truncate group-hover:text-white transition-colors">
                        {activePresentation ? activePresentation.name : t('select_presentation', 'Select Presentation')}
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
                    <button
                        type="button"
                        aria-label={t('close_menu', 'Close menu')}
                        className="absolute inset-0 w-full h-full bg-transparent border-0 cursor-default pointer-events-auto"
                        onClick={() => setIsOpen(false)}
                    />

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
                        <div className="p-2 border-b border-white/5 bg-stone-950/20 flex flex-col gap-1.5">
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

                            {/* Filter and Sort Bar */}
                            <div className="flex items-center gap-1.5 text-[10px]">
                                {/* Star Toggle */}
                                <button
                                    onClick={() => setFilterStarredOnly(!filterStarredOnly)}
                                    className={cn(
                                        "p-1.5 rounded-lg border transition-all shrink-0 flex items-center justify-center cursor-pointer",
                                        filterStarredOnly
                                            ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                                            : "bg-white/5 border-white/5 text-stone-500 hover:text-stone-300"
                                    )}
                                    title={t('filter_starred', 'Starred Only')}
                                >
                                    <Star className={cn("w-3 h-3", filterStarredOnly ? "fill-amber-400" : "")} />
                                </button>

                                {/* Type Dropdown */}
                                <select
                                    value={filterType}
                                    onChange={(e: any) => setFilterType(e.target.value)}
                                    className="bg-white/5 border border-white/5 rounded-lg px-1.5 py-1 text-[10px] text-stone-300 focus:outline-none focus:border-accent/40 transition-all cursor-pointer min-w-0 flex-1"
                                >
                                    <option value="all" className="bg-stone-900">{t('type_all', 'All Types')}</option>
                                    <option value="master" className="bg-stone-900">{t('type_master', 'Master')}</option>
                                    <option value="usual" className="bg-stone-900">{t('type_usual', 'Usual')}</option>
                                </select>

                                {/* Tag Dropdown */}
                                <select
                                    value={selectedTag}
                                    onChange={(e) => setSelectedTag(e.target.value)}
                                    className="bg-white/5 border border-white/5 rounded-lg px-1.5 py-1 text-[10px] text-stone-300 focus:outline-none focus:border-accent/40 transition-all cursor-pointer min-w-0 flex-1"
                                >
                                    <option value="" className="bg-stone-900">{t('filter_tags', 'Tags')}</option>
                                    {allExistingTags.map(tag => (
                                        <option key={tag} value={tag} className="bg-stone-900">{tag}</option>
                                    ))}
                                </select>

                                {/* Sort Dropdown */}
                                <div className="relative flex items-center shrink-0">
                                    <select
                                        value={sortBy}
                                        onChange={(e: any) => setSortBy(e.target.value)}
                                        className="bg-white/5 border border-white/5 rounded-lg pl-5 pr-1.5 py-1 text-[10px] text-stone-300 focus:outline-none focus:border-accent/40 transition-all cursor-pointer min-w-[75px]"
                                    >
                                        <option value="lastOpened" className="bg-stone-900">{t('last_opened', 'Recent')}</option>
                                        <option value="alphabetical" className="bg-stone-900">{t('alphabetical', 'A-Z')}</option>
                                        <option value="createdAt" className="bg-stone-900">{t('date_created', 'Created')}</option>
                                    </select>
                                    <ArrowUpDown className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-stone-500 pointer-events-none" />
                                </div>
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
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setContextMenu({ x: e.clientX, y: e.clientY, presentation: pres });
                                            }}
                                        >
                                            {renamingId === pres.id ? (
                                                <div className="flex-1 flex gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
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
                                                    <button onClick={() => handleRenamePresentation(pres.id)} className="p-1 text-accent hover:bg-accent/10 rounded shrink-0 cursor-pointer">
                                                        <Check className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : editingTagsId === pres.id ? (
                                                <div className="flex-1 flex flex-col gap-1.5 p-1 bg-stone-950/60 rounded-lg border border-white/5 relative" onClick={(e) => e.stopPropagation()}>
                                                    {/* Existing Tags pills with X to remove */}
                                                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto no-scrollbar">
                                                        {(pres.tags || []).map(tag => (
                                                            <span key={tag} className="flex items-center gap-1 text-[9px] font-bold bg-accent/20 text-accent px-1.5 py-0.5 rounded border border-accent/20">
                                                                {tag}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRemoveTag(pres.id, tag);
                                                                    }}
                                                                    className="hover:text-white transition-colors cursor-pointer"
                                                                >
                                                                    <X className="w-2.5 h-2.5" />
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>

                                                    {/* Add Tag input and Suggestions dropdown */}
                                                    <div className="flex gap-1 relative">
                                                        <input
                                                            type="text"
                                                            autoFocus
                                                            value={tagSearchInput}
                                                            onChange={(e) => setTagSearchInput(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleAddTag(pres.id, tagSearchInput);
                                                                }
                                                                if (e.key === 'Escape') {
                                                                    setEditingTagsId(null);
                                                                    setTagSearchInput('');
                                                                }
                                                            }}
                                                            placeholder={t('add_tag', 'Add tag...')}
                                                            className="flex-1 min-w-0 bg-white/5 border border-accent/30 rounded py-0.5 px-2 text-[11px] text-stone-200 focus:outline-none"
                                                        />
                                                        {tagSearchInput && (() => {
                                                            const query = tagSearchInput.toLowerCase();
                                                            const suggestions = allExistingTags.filter(tag => 
                                                                tag.toLowerCase().includes(query) &&
                                                                !(pres.tags || []).some(t => t.toLowerCase() === tag.toLowerCase())
                                                            );
                                                            if (suggestions.length === 0) return null;
                                                            return (
                                                                <div className="absolute left-0 right-0 bottom-full mb-1 max-h-24 overflow-y-auto bg-stone-950 border border-white/10 rounded-lg shadow-lg z-50 no-scrollbar">
                                                                    {suggestions.map(tag => (
                                                                        <button
                                                                            key={tag}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleAddTag(pres.id, tag);
                                                                            }}
                                                                            className="w-full text-left px-2 py-1 text-[10px] text-stone-300 hover:bg-accent/20 hover:text-white transition-colors cursor-pointer"
                                                                        >
                                                                            {tag}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })()}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingTagsId(null);
                                                                setTagSearchInput('');
                                                            }}
                                                            className="p-1 text-accent hover:bg-accent/10 rounded shrink-0 cursor-pointer"
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
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
                                                                {t('slides_count', { count: pres.slides.length, defaultValue: '{{count}} slides' })}
                                                            </span>
                                                            {pres.tags && pres.tags.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {pres.tags.map(tag => (
                                                                        <span key={tag} className="text-[7px] font-bold bg-white/5 text-stone-400 px-1 py-0.5 rounded border border-white/5">
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
 
                                                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                        {pres.isStarred && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleToggleStar(pres.id); }}
                                                                className="p-1 text-amber-400 hover:bg-white/5 rounded transition-all cursor-pointer"
                                                                title={t('unstar', 'Unstar')}
                                                            >
                                                                <Star className="w-3 h-3 fill-amber-400" />
                                                            </button>
                                                        )}

                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {!pres.isStarred && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleToggleStar(pres.id); }}
                                                                    className="p-1 text-stone-500 hover:text-amber-400 hover:bg-white/10 rounded transition-all cursor-pointer"
                                                                    title={t('star', 'Star')}
                                                                >
                                                                    <Star className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleExportPresentation(pres.id); }}
                                                                className="p-1 hover:bg-white/10 rounded text-stone-500 hover:text-accent transition-all cursor-pointer"
                                                                title={t('export_presentation', 'Export (.ektp)')}
                                                            >
                                                                <Upload className="w-3 h-3" />
                                                            </button>
                                                            {!pres.isMaster && (
                                                                <>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setRenamingId(pres.id); setRenameValue(pres.name); }}
                                                                        className="p-1 hover:bg-white/10 rounded text-stone-500 hover:text-stone-300 transition-all cursor-pointer"
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
                                                                        className="p-1 hover:bg-red-500/20 rounded text-stone-500 hover:text-red-400 transition-all cursor-pointer"
                                                                        title={t('delete', 'Delete')}
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
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

                        {contextMenu && (
                            <ContextMenu
                                x={contextMenu.x}
                                y={contextMenu.y}
                                onClose={() => setContextMenu(null)}
                            >
                                <ContextMenuItem
                                    icon={<Star className={cn("w-3 h-3", contextMenu.presentation.isStarred ? "fill-amber-400 text-amber-400" : "")} />}
                                    label={contextMenu.presentation.isStarred ? t('unstar', 'Unstar') : t('star', 'Star')}
                                    onClick={() => {
                                        handleToggleStar(contextMenu.presentation.id);
                                        setContextMenu(null);
                                    }}
                                />
                                <ContextMenuItem
                                    icon={<Tag className="w-3 h-3" />}
                                    label={t('manage_tags', 'Manage Tags...')}
                                    onClick={() => {
                                        setEditingTagsId(contextMenu.presentation.id);
                                        setTagSearchInput('');
                                        setContextMenu(null);
                                    }}
                                />
                                <ContextMenuItem
                                    icon={<Copy className="w-3 h-3" />}
                                    label={t('duplicate', 'Duplicate')}
                                    onClick={async () => {
                                        const original = await db.presentationFiles.get(contextMenu.presentation.id);
                                        if (original && activeServiceId) {
                                            const newName = await getUniquePresentationName(original.name);
                                            const clone = structuredClone(original);
                                            const newId = crypto.randomUUID();
                                            clone.id = newId;
                                            clone.name = newName;
                                            clone.isMaster = false;
                                            clone.isStarred = false;
                                            clone.serviceId = activeServiceId;
                                            const now = new Date();
                                            clone.createdAt = now;
                                            clone.updatedAt = now;
                                            clone.lastOpened = now;
                                            await db.presentationFiles.add(clone);

                                            const service = await db.serviceFiles.get(activeServiceId);
                                            if (service) {
                                                const updatedIds = [...service.presentationIds, newId];
                                                await db.serviceFiles.update(activeServiceId, {
                                                    presentationIds: updatedIds,
                                                    updatedAt: now
                                                });
                                                await setActiveService(activeServiceId);
                                                await setActivePresentation(newId);
                                            }
                                            toast.success(t('presentation_duplicated', 'Presentation duplicated'));
                                        }
                                        setContextMenu(null);
                                    }}
                                />
                                <ContextMenuItem
                                    icon={<Edit3 className="w-3 h-3" />}
                                    label={t('rename', 'Rename')}
                                    onClick={() => {
                                        setRenamingId(contextMenu.presentation.id);
                                        setRenameValue(contextMenu.presentation.name);
                                        setContextMenu(null);
                                    }}
                                />
                                <ContextMenuItem
                                    icon={<Upload className="w-3 h-3" />}
                                    label={t('export_presentation', 'Export (.ektp)')}
                                    onClick={() => {
                                        handleExportPresentation(contextMenu.presentation.id);
                                        setContextMenu(null);
                                    }}
                                />
                                {!contextMenu.presentation.isMaster && (
                                    <>
                                        <div className="h-px bg-white/5 my-1 mx-2" />
                                        <ContextMenuItem
                                            icon={<Trash2 className="w-3 h-3" />}
                                            label={t('delete', 'Delete')}
                                            danger
                                            onClick={() => {
                                                openModal(ModalType.CONFIRM, {
                                                    title: t('confirm_delete', 'Confirm Delete'),
                                                    message: t('confirm_delete_presentation', 'Delete this presentation?'),
                                                    variant: 'danger',
                                                    onSelection: (confirmed: boolean) => {
                                                        if (confirmed) {
                                                            removePresentation(contextMenu.presentation.id);
                                                        }
                                                    }
                                                });
                                                setContextMenu(null);
                                            }}
                                        />
                                    </>
                                )}
                            </ContextMenu>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default PresentationSelector;
