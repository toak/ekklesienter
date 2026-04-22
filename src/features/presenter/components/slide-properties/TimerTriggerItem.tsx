import React from 'react';
import { Zap, Trash2 } from 'lucide-react';
import DropdownSelector from '@/shared/ui/DropdownSelector';
import type { TFunction } from 'i18next';
import { ITimerTrigger, ITimerSettings, ITimerAction } from '@/core/types/timer';
import { ISlide } from '@/core/types';
import { 
    DndContext, 
    closestCenter, 
    KeyboardSensor, 
    PointerSensor, 
    useSensor, 
    useSensors 
} from '@dnd-kit/core';
import { 
    SortableContext, 
    arrayMove, 
    verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { ModalType } from '@/core/store/modalStore';
import { TimerActionStep } from './TimerActionStep';

interface ITimerTriggerItemProps {
    trigger: ITimerTrigger;
    idx: number;
    ts: ITimerSettings | undefined;
    selectedSlideId: string;
    updateTimerSettings: (id: string, settings: Partial<ITimerSettings>) => void;
    sensors: ReturnType<typeof useSensors>;
    openModal: (type: ModalType, props?: Record<string, unknown>) => void;
    t: TFunction;
    slides: ISlide[];
}

export const TimerTriggerItem: React.FC<ITimerTriggerItemProps> = ({ 
    trigger, idx, ts, selectedSlideId, updateTimerSettings, sensors, openModal, t, slides
}) => {
    const [localValue, setLocalValue] = React.useState<string | null>(null);

    return (
        <div className="bg-black/40 rounded-3xl border border-white/5 overflow-hidden shadow-inner p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20">
                        <Zap className="w-3 h-3 text-accent" />
                    </div>
                    <DropdownSelector
                        value={trigger.type || 'on_end'}
                        onChange={(val) => {
                            const p = [...(ts?.triggers || [])];
                            const old = p[idx];
                            const newType = val as ITimerTrigger['type'];
                            
                            let newTrigger: ITimerTrigger;
                            if (newType === 'on_keypress') {
                                newTrigger = { id: old.id, type: 'on_keypress', triggerValue: 'Space', actions: old.actions };
                            } else if (['remaining', 'elapsed', 'percentage'].includes(newType)) {
                                newTrigger = { id: old.id, type: newType as 'remaining' | 'elapsed' | 'percentage', value: 0, actions: old.actions };
                            } else {
                                newTrigger = { id: old.id, type: newType as 'on_start' | 'on_end', actions: old.actions };
                            }

                            p[idx] = newTrigger;
                            updateTimerSettings(selectedSlideId, { triggers: p });
                        }}
                        options={[
                            { value: 'on_start', label: t('on_start', 'On Start') },
                            { value: 'on_end', label: t('on_end', 'On End') },
                            { value: 'remaining', label: t('trigger_remaining', 'Time Remaining') },
                            { value: 'elapsed', label: t('trigger_elapsed', 'Time Elapsed') },
                            { value: 'percentage', label: t('trigger_percentage', 'Percentage') },
                            { value: 'on_keypress', label: t('on_keypress', 'Keyboard Shortcut') }
                        ]}
                        className="py-1 px-2 border-none bg-stone-100/5 text-[10px] font-black"
                    />
                </div>
                <button
                    onClick={() => {
                        const p = [...(ts?.triggers || [])];
                        p.splice(idx, 1);
                        updateTimerSettings(selectedSlideId, { triggers: p });
                    }}
                    className="p-1.5 hover:bg-red-500/20 text-stone-600 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-stone-600">{t('workflow_steps', 'Sequence Steps')}</label>
                    <div className="flex items-center gap-1">
                        <DropdownSelector
                            value="none"
                            onChange={(val) => {
                                if (val === 'none') return;
                                const p = [...(ts?.triggers || [])];
                                const newActions = [...(p[idx].actions || [])];
                                
                                let actionToAdd: ITimerAction;
                                const id = crypto.randomUUID();
                                
                                switch (val) {
                                    case 'navigate_to': actionToAdd = { id, type: 'navigate_to', payload: { slideId: '' } }; break;
                                    case 'play_sound': actionToAdd = { id, type: 'play_sound', payload: { soundId: 'ring_default' } }; break;
                                    case 'volume_fade': actionToAdd = { id, type: 'volume_fade', payload: { duration: 1 } }; break;
                                    case 'apply_override': actionToAdd = { id, type: 'apply_override', payload: { override: 'blackout' } }; break;
                                    case 'wait': actionToAdd = { id, type: 'wait', payload: { duration: 5 } }; break;
                                    case 'key_halt': actionToAdd = { id, type: 'key_halt', payload: { key: 'Enter' } }; break;
                                    case 'change_bg': actionToAdd = { id, type: 'change_bg', payload: { background: [] } }; break;
                                    case 'next_slide':
                                    case 'prev_slide':
                                    case 'close_override':
                                    case 'blackout':
                                    case 'flash':
                                        actionToAdd = { id, type: val as any }; break;
                                    default: actionToAdd = { id, type: val as any } as ITimerAction;
                                }

                                newActions.push(actionToAdd);
                                p[idx] = { ...p[idx], actions: newActions };
                                updateTimerSettings(selectedSlideId, { triggers: p });
                            }}
                            options={[
                                { value: 'none', label: t('add_step', '+ Add Step') },
                                { value: 'play_sound', label: t('timer_action_play_sound', 'Play Sound') },
                                { value: 'wait', label: t('timer_action_wait', 'Delay / Wait') },
                                { value: 'key_halt', label: t('timer_action_key_halt', 'Wait for Key') },
                                { value: 'navigate_to', label: t('timer_action_navigate_to', 'Go to Specific Slide') },
                                { value: 'next_slide', label: t('timer_action_next_slide', 'Next Slide') },
                                { value: 'prev_slide', label: t('timer_action_prev_slide', 'Previous Slide') },
                                { value: 'apply_override', label: t('timer_action_apply_override', 'Apply Projector Override') },
                                { value: 'close_override', label: t('timer_action_close_override', 'Close Override') },
                                { value: 'volume_fade', label: t('timer_action_volume_fade', 'Volume Fade Out') },
                            ]}
                            className="py-1 px-2 border-none bg-stone-100/5 text-[10px] font-black text-accent"
                        />
                    </div>
                </div>

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => {
                        const { active, over } = event;
                        if (over && active.id !== over.id) {
                            const p = [...(ts?.triggers || [])];
                            const oldIdx = p[idx].actions.findIndex((a) => `action-${idx}-${a.id}` === active.id);
                            const newIdx = p[idx].actions.findIndex((a) => `action-${idx}-${a.id}` === over.id);
                            if (oldIdx !== -1 && newIdx !== -1) {
                                p[idx] = { ...p[idx], actions: arrayMove(p[idx].actions, oldIdx, newIdx) };
                                updateTimerSettings(selectedSlideId, { triggers: p });
                            }
                        }
                    }}
                >
                    <SortableContext
                        items={(trigger.actions || []).map((a) => `action-${idx}-${a.id}`)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-2">
                            {(trigger.actions || []).map((action, actionIdx) => (
                                <TimerActionStep
                                    key={action.id}
                                    action={action}
                                    index={actionIdx}
                                    triggerIdx={idx}
                                    slides={slides}
                                    onRemove={() => {
                                        const p = [...(ts?.triggers || [])];
                                        const newActions = p[idx].actions.filter((_, i) => i !== actionIdx);
                                        p[idx] = { ...p[idx], actions: newActions };
                                        updateTimerSettings(selectedSlideId, { triggers: p });
                                    }}
                                    onUpdate={(updates) => {
                                        const p = [...(ts?.triggers || [])];
                                        const newActions = [...p[idx].actions];
                                        const oldAction = newActions[actionIdx];
                                        
                                        // Merge payload correctly for discriminated union
                                        if ('payload' in oldAction) {
                                            newActions[actionIdx] = { 
                                                ...oldAction, 
                                                payload: { ...oldAction.payload, ...updates } 
                                            } as ITimerAction;
                                        } else {
                                            newActions[actionIdx] = { 
                                                ...oldAction,
                                                ...updates
                                            } as ITimerAction;
                                        }

                                        p[idx] = { ...p[idx], actions: newActions };
                                        updateTimerSettings(selectedSlideId, { triggers: p });
                                    }}
                                    openModal={openModal}
                                    t={t}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
                
            </div>

            {['remaining', 'elapsed', 'percentage', 'on_keypress'].includes(trigger.type) && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-stone-600 px-1">
                        {trigger.type === 'percentage' ? t('value_percentage', 'Percentage (%)') : 
                            trigger.type === 'on_keypress' ? t('trigger_key', 'Trigger Key') : t('value_seconds', 'Seconds')}
                    </label>
                    {trigger.type === 'on_keypress' ? (
                        <input
                            type="text"
                            placeholder="e.g. Enter, Space, f"
                            value={(trigger as any).triggerValue || ''}
                            onChange={(e) => {
                                const p = [...(ts?.triggers || [])];
                                const current = p[idx];
                                if (current.type === 'on_keypress') {
                                    p[idx] = { ...current, triggerValue: e.target.value };
                                    updateTimerSettings(selectedSlideId, { triggers: p });
                                }
                            }}
                            className="w-full bg-stone-100/5 focus:bg-stone-100/10 border-none rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-0 placeholder:text-stone-700 transition-colors"
                        />
                    ) : (
                        <input
                            type="text"
                            inputMode="numeric"
                            value={localValue !== null ? localValue : (('value' in trigger) ? trigger.value : 0)}
                            onChange={(e) => {
                                const clean = e.target.value.replace(/[^0-9.]/g, '');
                                setLocalValue(clean);
                                const p = [...(ts?.triggers || [])];
                                const current = p[idx];
                                if ('value' in current) {
                                    p[idx] = { ...current, value: parseFloat(clean) || 0 } as ITimerTrigger;
                                    updateTimerSettings(selectedSlideId, { triggers: p });
                                }
                            }}
                            onBlur={() => setLocalValue(null)}
                            className="w-full bg-stone-100/50 border-none rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-0 placeholder:text-stone-400"
                        />
                    )}
                </div>
            )}
        </div>
    );
};
