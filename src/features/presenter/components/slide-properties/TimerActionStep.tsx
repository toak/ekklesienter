import React from 'react';
import { 
    Clock, Keyboard, Music, ArrowRight, CornerDownRight, 
    MousePointer2, ShieldAlert, Zap, GripVertical, Trash2, Import, Volume2 
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ISlide, ICanvasSlide, ITimerSettings, ITimerSlide } from '@/core/types';
import { ModalType } from '@/core/store/modalStore';
import type { TFunction } from 'i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ITimerAction } from '@/core/types/timer';
import DropdownSelector from '@/shared/ui/DropdownSelector';

interface ITimerActionStepProps {
    action: ITimerAction;
    index: number;
    triggerIdx: number;
    onRemove: () => void;
    onUpdate: (updates: Record<string, unknown>) => void;
    slides: ISlide[];
    openModal: (type: ModalType, props?: Record<string, unknown>) => void;
    t: TFunction;
}

export const TimerActionStep: React.FC<ITimerActionStepProps> = ({ action, index, triggerIdx, onRemove, onUpdate, slides, openModal, t }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `action-${triggerIdx}-${action.id}`,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.5 : 1,
    };

    const [isRecordingKey, setIsRecordingKey] = React.useState(false);
    const [localDuration, setLocalDuration] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!isRecordingKey) return;
        const handleDown = (e: KeyboardEvent) => {
            e.preventDefault();
            onUpdate({ key: e.key });
            setIsRecordingKey(false);
        };
        window.addEventListener('keydown', handleDown);
        return () => window.removeEventListener('keydown', handleDown);
    }, [isRecordingKey, onUpdate]);

    return (
        <div ref={setNodeRef} style={style} className="bg-white/5 border border-white/5 rounded-2xl p-3 group/step transition-all hover:bg-white/10">
            <div className="flex items-center gap-3">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-700 hover:text-stone-400 p-1">
                    <GripVertical className="w-4 h-4" />
                </div>
                
                <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {action.type === 'wait' && <Clock className="w-3.5 h-3.5 text-blue-400" />}
                            {action.type === 'key_halt' && <Keyboard className="w-3.5 h-3.5 text-purple-400" />}
                            {action.type === 'play_sound' && <Music className="w-3.5 h-3.5 text-green-400" />}
                            {action.type === 'next_slide' && <ArrowRight className="w-3.5 h-3.5 text-orange-400" />}
                            {action.type === 'prev_slide' && <CornerDownRight className="w-3.5 h-3.5 text-orange-400" />}
                            {action.type === 'navigate_to' && <MousePointer2 className="w-3.5 h-3.5 text-orange-400" />}
                            {action.type === 'apply_override' && <ShieldAlert className="w-3.5 h-3.5 text-red-400" />}
                            {action.type === 'close_override' && <Zap className="w-3.5 h-3.5 text-green-400" />}
                            {action.type === 'volume_fade' && <Volume2 className="w-3.5 h-3.5 text-blue-400" />}
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{t(`timer_action_${action.type}`)}</span>
                        </div>
                        <button onClick={onRemove} className="opacity-0 group-hover/step:opacity-100 p-1 hover:bg-red-500/20 text-stone-600 hover:text-red-400 rounded-lg transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Editor Content */}
                    {action.type === 'wait' && (
                        <div className="flex items-center gap-3 bg-black/20 p-2 rounded-xl border border-white/5">
                            <div className="flex-1 space-y-1">
                                <span className="text-[8px] font-bold text-stone-600 uppercase tracking-tighter block">{t('duration_sec', 'Seconds')}</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={localDuration !== null ? localDuration : (action.payload?.duration ?? 0)}
                                    onChange={(e) => {
                                        const clean = e.target.value.replace(/[^0-9]/g, '');
                                        setLocalDuration(clean);
                                        const duration = parseInt(clean) || 0;
                                        onUpdate({ duration });
                                    }}
                                    onBlur={() => setLocalDuration(null)}
                                    className="bg-transparent border-none p-0 text-xs font-bold text-white focus:ring-0 w-full"
                                />
                            </div>
                        </div>
                    )}

                    {action.type === 'key_halt' && (
                        <div className="flex items-center gap-3">
                             <button
                                onClick={() => setIsRecordingKey(true)}
                                className={cn(
                                    "flex-1 px-3 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all",
                                    isRecordingKey ? "bg-purple-500/20 border-purple-500 animate-pulse text-purple-300" : "bg-black/20 border-white/5 text-stone-400"
                                )}
                            >
                                {isRecordingKey ? t('recording_key', 'Press any key...') : (action.payload?.key || t('none', 'No key'))}
                            </button>
                        </div>
                    )}

                    {action.type === 'play_sound' && (
                        <div className="space-y-3">
                            <DropdownSelector
                                value={(action as any).payload?.soundId || 'ring_default'}
                                onChange={(val) => onUpdate({ soundId: val as string, mediaId: undefined })}
                                options={[
                                    { value: 'ring_default', label: t('ring_default', 'Clean Ping') },
                                    { value: 'ring_double', label: t('ring_double', 'Double Beep') },
                                    { value: 'ring_bell', label: t('ring_bell', 'Soft Bell') },
                                    { value: 'ring_chime', label: t('ring_chime', 'Ascending Chime') },
                                    { value: 'ring_retro', label: t('ring_retro', 'Digital Alert') },
                                    { value: 'ring_uplift', label: t('ring_uplift', 'Uplift Alert') },
                                    { value: 'ring_shimmer', label: t('ring_shimmer', 'Shimmer Alert') },
                                    { value: 'ring_cathedral', label: t('ring_cathedral', 'Cathedral Bell') }
                                ]}
                            />
                            <button
                                onClick={() => {
                                    openModal(ModalType.AUDIO_PICKER, {
                                        type: 'audio',
                                        multi: false,
                                        onSelect: (ids: string[]) => {
                                            if (ids.length > 0) {
                                                onUpdate({ mediaId: ids[0] });
                                            }
                                        }
                                    });
                                }}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent/10 border border-accent/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-accent hover:bg-accent/20 transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <Import className="w-3.5 h-3.5" />
                                {t('custom_media_sound', 'Import File')}
                            </button>
                        </div>
                    )}

                    {action.type === 'navigate_to' && (
                        <DropdownSelector
                            value={(action as any).payload?.slideId || ''}
                            onChange={(val) => onUpdate({ slideId: val as string })}
                            options={slides.map((s, i) => ({
                                value: s.id,
                                label: `${i + 1}. ${s.notes || (s.type === 'normal' 
                                    ? (s as ICanvasSlide).timerSettings?.prefix || t('slide', 'Slide') 
                                    : s.type === 'timer' 
                                        ? (s as ITimerSlide).prefix || t('slide', 'Slide')
                                        : t('slide', 'Slide'))}`
                            }))}
                        />
                    )}

                    {action.type === 'apply_override' && (
                        <DropdownSelector
                            value={action.payload.override || 'blackout'}
                            onChange={(val) => onUpdate({ override: val as 'blackout' | 'whiteout' | 'logo' })}
                            options={[
                                { value: 'blackout', label: t('blackout', 'Blackout') },
                                { value: 'whiteout', label: t('whiteout', 'Whiteout') },
                                { value: 'logo', label: t('logo', 'Logo') }
                            ]}
                        />
                    )}

                    {action.type === 'volume_fade' && (
                        <div className="flex items-center gap-3 bg-black/20 p-2 rounded-xl border border-white/5">
                            <div className="flex-1 space-y-1">
                                <span className="text-[8px] font-bold text-stone-600 uppercase tracking-tighter block">{t('fade_duration_sec', 'Fade Duration (sec)')}</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={localDuration !== null ? localDuration : (action.payload?.duration ?? 2)}
                                    onChange={(e) => {
                                        const clean = e.target.value.replace(/[^0-9]/g, '');
                                        setLocalDuration(clean);
                                        const duration = parseInt(clean) || 0;
                                        onUpdate({ duration });
                                    }}
                                    onBlur={() => setLocalDuration(null)}
                                    className="bg-transparent border-none p-0 text-xs font-bold text-white focus:ring-0 w-full"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
