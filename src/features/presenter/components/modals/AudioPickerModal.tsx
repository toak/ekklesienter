import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { X, Music, Search, Plus } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { IMediaItem, IAudioScope, ISlide } from '@/core/types';
import { findOverlappingScopes } from '../../utils/timelineUtils';
import { IpcService } from '@/core/services/IpcService';

const AudioPickerModal: React.FC = () => {
    const { t } = useTranslation();
    const { closeModal, stack } = useModalStore();
    // Find the LAST instance to correctly support nested modals
    const modalData = [...stack].reverse().find(m => m.id === ModalType.AUDIO_PICKER);
    const isOpen = !!modalData;
    const targetSlideId = modalData?.props?.targetSlideId as string | undefined;
    const onSelect = modalData?.props?.onSelect as ((ids: string[]) => void) | undefined;
    const multi = modalData?.props?.multi as boolean | undefined;

    const { addAudioScope } = usePresentationStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const audioItems = useLiveQuery(
        () => {
            const baseQuery = db.mediaPool.where('type').equals('audio');
            if (!searchQuery.trim()) {
                return baseQuery.reverse().sortBy('createdAt');
            }
            return baseQuery
                .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .reverse()
                .sortBy('createdAt');
        },
        [searchQuery]
    ) || [];

    if (!isOpen) return null;

    const handleSelect = async (item: IMediaItem) => {
        if (onSelect) {
            if (multi) {
                const newSelected = selectedIds.includes(item.id)
                    ? selectedIds.filter(id => id !== item.id)
                    : [...selectedIds, item.id];
                setSelectedIds(newSelected);
            } else {
                onSelect([item.id]);
                closeModal(ModalType.AUDIO_PICKER);
            }
            return;
        }

        if (targetSlideId) {
            const { activePresentation } = usePresentationStore.getState();
            if (activePresentation) {
                const slides = activePresentation.slides;
                const slideToIndexMap = new Map<string, number>();
                slides.forEach((s, idx) => slideToIndexMap.set(s.id, idx));

                const targetIdx = slides.findIndex(s => s.id === targetSlideId);
                const visualTimeline = slides.map(s => ({ slide: s }));
                const overlaps = findOverlappingScopes(targetIdx, targetIdx, visualTimeline, slideToIndexMap);

                if (overlaps.length > 0) {
                    const { openModal } = useModalStore.getState();
                    openModal(ModalType.AUDIO_CONFLICT, {
                        targetSlideId,
                        fileId: item.path,
                        overlappingScopes: overlaps
                    });
                } else {
                    await addAudioScope(targetSlideId, item.path, item.name);
                    closeModal(ModalType.AUDIO_PICKER);
                }
            }
        }
    };

    const handleConfirm = () => {
        if (onSelect && multi) {
            onSelect(selectedIds);
            closeModal(ModalType.AUDIO_PICKER);
        }
    };

    const handleImport = async () => {
        // Use Electron's native file picker if available for persistent absolute paths
        if (IpcService.isElectron()) {
            try {
                const filePath = await IpcService.selectFile({
                    properties: ['openFile', 'multiSelections'],
                    filters: [
                        { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] }
                    ]
                });

                if (!filePath) return;

                // selectFile can return string or string[] depending on implementation, 
                // but the current bridge seems to return a single string or null based on electron/main.ts.
                // Wait, electron/main.ts:278 returns result.filePaths[0].
                // Let's check if we can handle multiple.
                const paths = Array.isArray(filePath) ? filePath : [filePath];

                for (const path of paths) {
                    const name = path.split(/[/\\]/).pop() || 'Unknown Audio';
                    const item: IMediaItem = {
                        id: crypto.randomUUID(),
                        name: name,
                        path: path,
                        type: 'audio',
                        createdAt: Date.now()
                    };
                    await db.mediaPool.add(item);
                }
                return;
            } catch (error) {
                console.error('Failed to import via Electron:', error);
            }
        }

        // Fallback for web/dev or if bridge fails
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'audio/*';

        input.onchange = async (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (!files) return;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                // In Electron, .path is often available on File objects from <input>
                const path = (file as any).path || URL.createObjectURL(file);

                const item: IMediaItem = {
                    id: crypto.randomUUID(),
                    name: file.name,
                    path: path,
                    type: 'audio',
                    createdAt: Date.now()
                };
                await db.mediaPool.add(item);
            }
        };

        input.click();
    };

    return createPortal(
        <div className="fixed inset-0 z-10001 flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-stone-900 border border-white/10 rounded-[32px] w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-stone-900/50 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                            <Music className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white tracking-tight uppercase">
                                {t('select_audio', 'Select Audio')}
                            </h2>
                            <p className="text-[10px] text-stone-500 font-bold uppercase tracking-[0.2em] mt-0.5">
                                {t('media_pool', 'Media Pool')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => closeModal(ModalType.AUDIO_PICKER)}
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-stone-400 hover:text-white transition-all border border-white/5"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search & Actions */}
                <div className="p-4 border-b border-white/5 bg-stone-950/20 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
                        <input
                            type="text"
                            placeholder={t('search_audio_placeholder', 'Search audio...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-stone-900/50 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm text-stone-200 focus:outline-none focus:border-purple-500/40 transition-all placeholder:text-stone-700 font-bold"
                        />
                    </div>
                    <button
                        onClick={handleImport}
                        className="px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-xl hover:bg-purple-500/30 transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest whitespace-nowrap"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        {t('import', 'Import')}
                    </button>
                </div>

                {/* Audio Grid */}
                <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                    {audioItems.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-4">
                            <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-center">
                                <Music className="w-8 h-8 text-stone-700" strokeWidth={1} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-stone-400">
                                    {searchQuery ? t('no_audio_results', 'No matches found') : t('media_pool_audio_empty', 'Media pool is empty')}
                                </p>
                                <p className="text-[10px] text-stone-600 uppercase tracking-widest mt-1">
                                    {searchQuery ? t('try_another_search', 'Try a different keyword') : t('import_audio_hint', 'Import audio files to get started')}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2">
                            {audioItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    className={cn(
                                        "group w-full flex items-center gap-3 p-3 rounded-2xl bg-stone-900/40 border border-white/5 hover:border-purple-500/40 transition-all text-left",
                                        selectedIds.includes(item.id) ? "border-purple-500/50 bg-purple-500/5" : "hover:bg-purple-500/5"
                                    )}
                                >
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition-transform",
                                        selectedIds.includes(item.id)
                                            ? "bg-purple-500 text-white border-purple-400"
                                            : "bg-purple-500/20 text-purple-500 border-purple-500/20 group-hover:scale-110"
                                    )}>
                                        <Music className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className={cn(
                                            "block text-xs font-bold transition-colors truncate",
                                            selectedIds.includes(item.id) ? "text-purple-400" : "text-stone-200 group-hover:text-purple-400"
                                        )}>
                                            {item.name}
                                        </span>
                                        <span className="block text-[9px] font-bold text-stone-600 uppercase tracking-widest mt-0.5 truncate">
                                            {item.path}
                                        </span>
                                    </div>
                                    {multi ? (
                                        <div className={cn(
                                            "w-5 h-5 rounded-lg border transition-all flex items-center justify-center",
                                            selectedIds.includes(item.id)
                                                ? "bg-purple-500 border-purple-400 shadow-lg shadow-purple-500/20"
                                                : "border-white/10 group-hover:border-purple-500/40"
                                        )}>
                                            {selectedIds.includes(item.id) && <div className="w-2 h-2 bg-white rounded-full shadow-inner" />}
                                        </div>
                                    ) : (
                                        <Plus className="w-4 h-4 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/5 bg-stone-950/50 backdrop-blur-xl flex justify-end gap-3 shrink-0">
                    <button
                        onClick={() => closeModal(ModalType.AUDIO_PICKER)}
                        className="px-6 py-2 bg-white/5 hover:bg-white/10 text-stone-400 font-bold rounded-xl transition-all border border-white/5 text-[10px] uppercase tracking-widest"
                    >
                        {t('cancel', 'Cancel')}
                    </button>
                    {multi && (
                        <button
                            onClick={handleConfirm}
                            disabled={selectedIds.length === 0}
                            className="px-8 py-2 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 disabled:bg-stone-800 text-white font-black rounded-xl transition-all shadow-lg shadow-purple-500/20 border border-purple-400/30 text-[10px] uppercase tracking-widest"
                        >
                            {t('add_selected', 'Add Selected')} ({selectedIds.length})
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AudioPickerModal;
