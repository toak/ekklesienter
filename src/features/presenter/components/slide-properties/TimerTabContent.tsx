import React from 'react';
import { db } from '@/core/db';
import DropdownSelector from '@/shared/ui/DropdownSelector';
import {
    Music, Type, Clock, Trash2, Plus, Palette, Zap, Sun, Keyboard, ArrowRight, CornerDownRight, ShieldAlert, GripVertical, MousePointer2, FileAudio, Import
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ISlide, ITimerSettings, IStyleLayer, ITimerSlide, ICanvasSlide } from '@/core/types';
import { ModalType } from '@/core/store/modalStore';
import type { TFunction } from 'i18next';
import { PlaylistItemRow } from './PlaylistItemRow';
import { BackgroundPicker } from './BackgroundPicker';
import { FloatingPopover } from '@/components/FloatingPopover';
import { ensureLayers } from '@/core/utils/styleMigration';
import { SlideBackground } from '../display/SlideBackground';
import { MediaPersistenceService } from '../../services/MediaPersistenceService';
import { usePresentationStore } from '../../store/presentationStore';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { ITimerAction, ITimerTrigger } from '@/core/types/timer';
import { TimerTriggerItem } from './TimerTriggerItem';
import { TimerFillPicker } from './TimerFillPicker';

interface ITimerTabContentProps {
    selectedSlide: ISlide;
    updateTimerSettings: (id: string, updates: Partial<ITimerSettings>) => void;
    openModal: (type: ModalType, props?: Record<string, unknown>) => void;
    t: TFunction;
}

export const TimerTabContent: React.FC<ITimerTabContentProps> = ({
    selectedSlide, updateTimerSettings, openModal, t,
}) => {
    const slides = usePresentationStore(state => state.activePresentation?.slides || []);
    // TimerTabContent is primarily designed for normal slides with timer overlays
    if (selectedSlide.type !== 'normal' && selectedSlide.type !== 'timer') return null;

    // Timer settings are present on normal slides (as overlay) and timer slides (as core)
    const ts = selectedSlide.type === 'normal' 
        ? (selectedSlide as ICanvasSlide).timerSettings 
        : selectedSlide.type === 'timer' 
            ? (selectedSlide as ITimerSlide)
            : undefined;

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const [localMins, setLocalMins] = React.useState<string | null>(null);
    const [localSecs, setLocalSecs] = React.useState<string | null>(null);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const playlist = ts?.playlist || [];
            const oldIndex = playlist.findIndex((_, i) => `${playlist[i]}-${i}` === active.id);
            const newIndex = playlist.findIndex((_, i) => `${playlist[i]}-${i}` === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newPlaylist = arrayMove(playlist, oldIndex, newIndex);
                updateTimerSettings(selectedSlide.id, { playlist: newPlaylist });
            }
        }
    };

    const handleDropFromMediaPool = async (e: React.DragEvent) => {
        e.preventDefault();
        try {
            // 1. Handle drag from Media Pool (JSON)
            const dataStr = e.dataTransfer.getData('application/json');
            if (dataStr) {
                const data = JSON.parse(dataStr);
                if (data.source === 'media-pool' && data.media?.type === 'audio') {
                    const current = ts?.playlist || [];
                    updateTimerSettings(selectedSlide.id, {
                        playlist: [...current, data.media.id]
                    });
                    return;
                }
            }

            // 2. Handle drag from System (Files)
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                const audioFiles = Array.from(files).filter(f => f.type.startsWith('audio/'));
                if (audioFiles.length === 0) return;

                const batchItems = audioFiles.map(file => ({
                    file,
                    path: (file as File & { path?: string }).path || null,
                    type: 'audio' as const
                }));

                const newIds = await MediaPersistenceService.importMediaBatch(batchItems);

                if (newIds.length > 0) {
                    const current = ts?.playlist || [];
                    updateTimerSettings(selectedSlide.id, {
                        playlist: [...current, ...newIds]
                    });
                }
            }
        } catch (err) {
            console.error('Failed to drop audio:', err);
        }
    };

    const handleReplaceAudio = (index: number) => {
        openModal(ModalType.AUDIO_PICKER, {
            type: 'audio',
            multi: false,
            onSelect: (ids: string[]) => {
                if (ids.length > 0) {
                    const current = [...(ts?.playlist || [])];
                    current[index] = ids[0];
                    updateTimerSettings(selectedSlide.id, { playlist: current });
                }
            }
        });
    };

    return (
        <div className="pb-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Duration */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{t('duration', 'Duration')}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-2 group hover:border-white/10 transition-colors">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-stone-600 block group-hover:text-stone-400 transition-colors">{t('minutes', 'Minutes')}</span>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={localMins !== null ? localMins : Math.floor((ts?.duration || 0) / 60)}
                            placeholder="0"
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setLocalMins(val);
                                const mins = parseInt(val) || 0;
                                const secs = (ts?.duration || 0) % 60;
                                updateTimerSettings(selectedSlide.id, { duration: mins * 60 + secs });
                            }}
                            onBlur={() => setLocalMins(null)}
                            className="w-full bg-transparent text-sm font-mono font-bold text-white focus:outline-none placeholder:text-white/10"
                        />
                    </div>
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-2 group hover:border-white/10 transition-colors">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-stone-600 block group-hover:text-stone-400 transition-colors">{t('seconds', 'Seconds')}</span>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={localSecs !== null ? localSecs : (ts?.duration || 0) % 60}
                            placeholder="0"
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setLocalSecs(val);
                                let secs = parseInt(val) || 0;
                                if (secs > 59) secs = 59;
                                const mins = Math.floor((ts?.duration || 0) / 60);
                                updateTimerSettings(selectedSlide.id, { duration: mins * 60 + secs });
                            }}
                            onBlur={() => setLocalSecs(null)}
                            className="w-full bg-transparent text-sm font-mono font-bold text-white focus:outline-none placeholder:text-white/10"
                        />
                    </div>
                </div>
            </div>

            {/* Style Picker */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Palette className="w-3.5 h-3.5 text-stone-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{t('style', 'Visual Style')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        'minimal_ring', 'modern_bold', 'serene', 'brutalist', 'neon_cyber', 'aurora', 'old_digital', 'flip_clock', 'neo_brutalist', 'vhs_crt'
                    ].map((style) => (
                        <button
                            key={style}
                            onClick={() => updateTimerSettings(selectedSlide.id, { style: style as ITimerSettings['style'] })}
                            className={cn(
                                "px-3 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer",
                                ts?.style === style ? "bg-orange-500/20 border-orange-500/40 text-orange-400 shadow-lg shadow-orange-500/10" : "bg-white/3 border-white/5 text-stone-500 hover:border-white/10 hover:text-stone-300"
                            )}
                        >
                            {style.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Prefix & Subtitle Text */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Type className="w-3.5 h-3.5 text-stone-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{t('text_content', 'Text Content')}</span>
                </div>
                <div className="space-y-3">
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-stone-600 block mb-2">{t('prefix', 'Title')}</span>
                        <input
                            type="text"
                            placeholder={t('prefix_placeholder', 'e.g. Starting in...')}
                            value={ts?.prefix || ''}
                            onChange={(e) => updateTimerSettings(selectedSlide.id, { prefix: e.target.value })}
                            className="w-full bg-transparent text-sm font-bold text-white focus:outline-none placeholder:text-stone-700"
                        />
                    </div>
                    {(ts?.style === 'serene' || ts?.style === 'neo_brutalist') && (
                        <div className="bg-black/20 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-600 block mb-2">{t('subtitle', 'Subtitle')}</span>
                            <input
                                type="text"
                                placeholder={t('subtitle_placeholder', 'e.g. Please take your seats')}
                                value={ts?.subtitle || ''}
                                onChange={(e) => updateTimerSettings(selectedSlide.id, { subtitle: e.target.value })}
                                className="w-full bg-transparent text-sm font-bold text-white focus:outline-none placeholder:text-stone-700"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Style Palette */}
            {(() => {
                const styleColors: Record<string, Record<string, string>> = {
                    minimal_ring: { ring: '#f97316', timerText: '#1c1917', title: '#78716c' },
                    modern_bold: { accent: '#f97316', timerText: '#ffffff', title: '#ffffffb3', subtitle: '#ffffff80' },
                    serene: { accent: '#f97316', timerText: '#1c1917', title: '#44403c', subtitle: '#78716c' },
                    brutalist: { rightPanel: '#ffea00', badge: '#ff4b4b', border: '#111111', timerText: '#111111', title: '#ffffff', subtitle: '#111111' },
                    neon_cyber: { accent: '#2563eb', timerText: '#d946ef', title: '#d946ef', subtitle: '#d946ef' },
                    aurora: { accent: '#9333ea', accent2: '#14b8a6', timerText: '#ffffff', title: '#ffffff99', subtitle: '#ffffff80' },
                    old_digital: { panel: '#0a0202', border: '#1a1a1a', timerText: '#ef4444', title: '#ef4444', subtitle: '#ef4444' },
                    flip_clock: { panel: '#27272a', timerText: '#e4e4e7', title: '#ffffff', subtitle: '#ffffff' },
                    neo_brutalist: { badge: '#fbbf24', border: '#000000', cardBackground: '#ffffff', shadow: '#000000', timerText: '#000000', title: '#000000', subtitle: '#000000' },
                    vhs_crt: { accent: '#00ff00', timerText: '#ffffff', title: '#ffffff', subtitle: '#ffffff' },
                };

                const currentStyle = ts?.style || '';
                const styleConfig = styleColors[currentStyle] || {};
                const activeColors = Object.keys(styleConfig);
                if (activeColors.length === 0) return null;

                return (
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2">
                            <Palette className="w-3.5 h-3.5 text-stone-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{t('custom_colors', 'Style Palette')}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {activeColors.map((colorKey) => {
                                const propKey = `${currentStyle}_${colorKey}`;
                                return (
                                    <TimerFillPicker
                                        key={propKey}
                                        label={colorKey.replace(/([A-Z])/g, ' $1')}
                                        fill={ts?.customFills?.[propKey]}
                                        defaultColor={styleConfig[colorKey]}
                                        onChange={(fill) => {
                                            const newFills = { ...(ts?.customFills || {}), [propKey]: fill };
                                            updateTimerSettings(selectedSlide.id, { customFills: newFills });
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* Playlist */}
            <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Music className="w-3.5 h-3.5 text-stone-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{t('playlist', 'Playlist')}</span>
                    </div>
                    <button
                        onClick={() => openModal(ModalType.AUDIO_PICKER, {
                            type: 'audio',
                            multi: true,
                            onSelect: (ids: string[]) => {
                                const current = ts?.playlist || [];
                                updateTimerSettings(selectedSlide.id, { playlist: Array.from(new Set([...current, ...ids])) });
                            }
                        })}
                        className="p-1.5 bg-accent/10 border border-accent/20 rounded-lg text-accent hover:bg-accent/20 transition-all active:scale-95 cursor-pointer"
                        title={t('import_file', 'Import File')}
                        aria-label={t('import_file', 'Import File')}
                    >
                        <Import className="w-4 h-4" />
                    </button>
                </div>
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                    }}
                    onDrop={handleDropFromMediaPool}
                    className="bg-black/40 border border-white/5 rounded-3xl overflow-hidden shadow-inner min-h-[100px]"
                >
                    {(ts?.playlist || []).length > 0 ? (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={(ts?.playlist || []).map((id, index) => `${id}-${index}`)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="divide-y divide-white/5">
                                    {(ts?.playlist || []).map((id, index) => (
                                        <PlaylistItemRow
                                            key={`${id}-${index}`}
                                            id={id}
                                            index={index}
                                            onRemove={(idx) => {
                                                const p = [...(ts?.playlist || [])];
                                                p.splice(idx, 1);
                                                updateTimerSettings(selectedSlide.id, { playlist: p });
                                            }}
                                            onReplace={handleReplaceAudio}
                                            t={(key, fallback) => t(key, fallback) as string}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    ) : (
                        <div className="p-8 text-center">
                            <Music className="w-8 h-8 text-stone-800 mx-auto mb-3 opacity-50" strokeWidth={1.5} />
                            <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest">{t('playlist_empty', 'Playlist Empty')}</p>
                            <p className="text-[9px] text-stone-700 mt-1 uppercase tracking-tighter">{t('dnd_audio_hint', 'Drop audio from Media Pool or System')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Triggers & Actions */}
            <div className="space-y-4 border-t border-white/5 pt-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-stone-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{t('triggers_actions', 'Triggers & Actions')}</span>
                    </div>
                    <button
                        onClick={() => {
                            const current = ts?.triggers || [];
                            updateTimerSettings(selectedSlide.id, {
                                triggers: [...current, {
                                    id: crypto.randomUUID(),
                                    type: 'on_end',
                                    actions: [{ id: crypto.randomUUID(), type: 'next_slide' }]
                                }]
                            });
                        }}
                        className="p-1.5 hover:bg-accent/10 rounded-lg text-accent transition-all active:scale-95 group cursor-pointer"
                    >
                        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                    </button>
                </div>
                {(ts?.triggers || []).map((trigger, idx) => (
                    <TimerTriggerItem
                        key={trigger.id || idx}
                        trigger={trigger}
                        idx={idx}
                        ts={ts}
                        selectedSlideId={selectedSlide.id}
                        updateTimerSettings={updateTimerSettings}
                        sensors={sensors}
                        openModal={openModal}
                        t={t}
                        slides={slides}
                    />
                ))}
            </div>
        </div>
    );
};
