import React from 'react';
import { Music, Volume2, VolumeX, Repeat, Trash2 } from 'lucide-react';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { cn } from '@/core/utils/cn';
import { CustomSlider } from '@/components/CustomSlider';
import { IAudioScope } from '@/core/types';
import type { TFunction } from 'i18next';
import { ScrubbableInput } from '../slide-properties/ScrubbableInput';

interface IAudioTabContentProps {
    scope: IAudioScope | undefined;
    mediaItem: { name?: string } | undefined;
    selectedAudioScopeId: string | null;
    updateAudioScope: (id: string, updates: Partial<IAudioScope>) => Promise<void>;
    removeAudioScope: (id: string) => Promise<void>;
    selectAudioScope: (id: string | null) => void;
    t: TFunction;
}

export const AudioTabContent: React.FC<IAudioTabContentProps> = ({
    scope, mediaItem, selectedAudioScopeId, updateAudioScope, removeAudioScope, selectAudioScope, t,
}) => {
    const { openModal } = useModalStore();
    if (!selectedAudioScopeId || !scope) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
                <div className="w-20 h-20 rounded-full bg-white/2 flex items-center justify-center border border-white/5"><Music className="w-8 h-8 text-stone-800" strokeWidth={1.5} /></div>
                <p className="text-[11px] text-stone-700 font-bold uppercase tracking-[0.2em]">{t('no_audio_selected', 'No Audio Clip Selected')}</p>
                <p className="text-[10px] text-stone-800 max-w-[150px] leading-relaxed">{t('select_audio_to_edit', 'Select an audio clip from the timeline to edit its properties')}</p>
            </div>
        );
    }

    const cf = scope.crossfadeSettings;

    return (
        <div className="pb-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Identity */}
            <div className="flex items-center gap-4 p-5 rounded-3xl bg-black/40 border border-white/5 shadow-inner">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 shadow-lg shadow-accent/5"><Music className="w-6 h-6 text-accent" /></div>
                <div className="min-w-0 flex-1"><p className="text-[10px] text-stone-500 font-black uppercase tracking-[0.2em] leading-none mb-1.5 px-0.5">{t('audio_clip')}</p><h3 className="text-sm font-bold text-white truncate px-0.5">{mediaItem?.name || t('unknown_file')}</h3></div>
            </div>

            {/* Volume */}
            <div className="space-y-4 px-1">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2"><div className="w-1 h-3 bg-accent/40 rounded-full" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">{t('volume', 'Volume')}</span></div>
                    <button onClick={() => updateAudioScope(scope.id, { isMuted: !scope.isMuted })} className={cn("p-1.5 rounded-lg transition-all active:scale-90 cursor-pointer", scope.isMuted ? "bg-red-500/10 text-red-500" : "text-stone-500 hover:text-stone-300 hover:bg-white/5")} title={scope.isMuted ? t('unmute', 'Unmute') : t('mute', 'Mute')}>
                        {scope.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                </div>
                <div className={cn("bg-black/40 p-5 rounded-3xl border border-white/5 transition-opacity", scope.isMuted && "opacity-50 pointer-events-none")}>
                    <CustomSlider min={0} max={1} step={0.01} value={scope.volume ?? 1} onChange={(v) => updateAudioScope(scope.id, { volume: v })} formatValue={(v) => `${Math.round(v * 100)}%`} />
                </div>
            </div>

            {/* Trimming */}
            <div className="space-y-4 px-1">
                <div className="flex items-center gap-2"><div className="w-1 h-3 bg-accent/40 rounded-full" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">{t('trimming', 'Trimming')}</span></div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/40 p-4 rounded-3xl border border-white/5 space-y-3 group hover:border-white/10 transition-colors">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-stone-600 block px-0.5">{t('trim_start', 'Start')}</span>
                        <ScrubbableInput label={t('trim_start')} value={scope.trimStart ?? 0} onChange={(v) => updateAudioScope(scope.id, { trimStart: v })} min={0} step={0.1} className="bg-stone-900/50 rounded-xl px-3 py-2 border border-white/5" />
                    </div>
                    <div className="bg-black/40 p-4 rounded-3xl border border-white/5 space-y-3 group hover:border-white/10 transition-colors">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-stone-600 block px-0.5">{t('trim_end', 'End')}</span>
                        <ScrubbableInput label={t('trim_end')} value={scope.trimEnd ?? 0} onChange={(v) => updateAudioScope(scope.id, { trimEnd: v })} min={0} step={0.1} className="bg-stone-900/50 rounded-xl px-3 py-2 border border-white/5" />
                    </div>
                </div>
                <p className="text-[9px] text-stone-600 px-1 font-medium">{t('trim_help')} <span className="text-stone-400">{((scope.trimEnd || 0) - (scope.trimStart || 0)).toFixed(1)}s</span></p>
            </div>

            {/* Playback */}
            <div className="space-y-4 px-1">
                <div className="flex items-center gap-2"><div className="w-1 h-3 bg-accent/40 rounded-full" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">{t('playback', 'Playback')}</span></div>
                <button onClick={() => updateAudioScope(scope.id, { loop: !scope.loop })} className={cn("w-full flex items-center justify-between p-5 rounded-3xl border transition-all active:scale-[0.98] cursor-pointer", scope.loop ? "bg-accent/10 border-accent/30 text-accent font-bold" : "bg-black/40 border-white/5 text-stone-500 hover:border-white/10 hover:text-stone-300")}>
                    <div className="flex items-center gap-3"><div className={cn("p-2 rounded-xl border transition-colors", scope.loop ? "bg-accent/20 border-accent/20" : "bg-white/5 border-white/5")}><Repeat className={cn("w-4 h-4", scope.loop ? "text-accent" : "text-stone-600")} /></div><span className="text-[11px] font-bold uppercase tracking-widest">{t('loop_playback', 'Loop Playback')}</span></div>
                    <div className={cn("w-9 h-5 rounded-full relative transition-colors duration-300 flex items-center px-1", scope.loop ? "bg-accent" : "bg-stone-800")}><div className={cn("w-3 h-3 rounded-full bg-white transition-all duration-300 shadow-sm", scope.loop ? "ml-4" : "ml-0")} /></div>
                </button>
            </div>

            {/* Fades */}
            <div className="space-y-4 px-1">
                <div className="flex items-center gap-2"><div className="w-1 h-3 bg-accent/40 rounded-full" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">{t('fade_settings', 'Fade Settings')}</span></div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/40 p-4 rounded-3xl border border-white/5 space-y-3 group hover:border-white/10 transition-colors">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-stone-600 block px-0.5">{t('fade_in', 'Fade In')}</span>
                        <ScrubbableInput label={t('fade_in')} value={cf?.fadeInDuration ?? 0} onChange={(v) => updateAudioScope(scope.id, { crossfadeSettings: { fadeInDuration: v, fadeOutDuration: cf?.fadeOutDuration ?? 0 } })} min={0} max={10} step={0.1} className="bg-stone-900/50 rounded-xl px-3 py-2 border border-white/5" />
                    </div>
                    <div className="bg-black/40 p-4 rounded-3xl border border-white/5 space-y-3 group hover:border-white/10 transition-colors">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-stone-600 block px-0.5">{t('fade_out', 'Fade Out')}</span>
                        <ScrubbableInput label={t('fade_out')} value={cf?.fadeOutDuration ?? 0} onChange={(v) => updateAudioScope(scope.id, { crossfadeSettings: { fadeOutDuration: v, fadeInDuration: cf?.fadeInDuration ?? 0 } })} min={0} max={10} step={0.1} className="bg-stone-900/50 rounded-xl px-3 py-2 border border-white/5" />
                    </div>
                </div>
            </div>

            <div className="pt-6 border-t border-white/5 px-1">
                <button
                    onClick={() => {
                        openModal(ModalType.CONFIRM, {
                            title: t('confirm_delete', 'Confirm Delete'),
                            message: t('remove_audio_confirm', 'Are you sure you want to remove this audio clip?'),
                            variant: 'danger',
                            onSelection: async (confirmed: boolean) => {
                                if (confirmed) {
                                    await removeAudioScope(scope.id);
                                    selectAudioScope(null);
                                }
                            }
                        });
                    }}
                    className="w-full flex items-center justify-center gap-3 p-5 rounded-3xl bg-red-500/5 border border-red-500/10 text-red-500 hover:bg-red-500/10 hover:border-red-500/20 transition-all font-black uppercase tracking-[0.2em] text-[10px] cursor-pointer group"
                >
                    <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />{t('remove_audio', 'Remove Audio')}
                </button>
            </div>
        </div>
    );
};
