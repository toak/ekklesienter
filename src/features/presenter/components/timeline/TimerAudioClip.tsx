import React from 'react';
import { cn } from '@/core/utils/cn';
import { ISlide, IMediaItem, ITimerSlide } from '@/core/types';
import { Music, Timer } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';

interface TimerAudioClipProps {
    slide: ISlide;
    x: number;
    width: number;
}

const TimerAudioClip: React.FC<TimerAudioClipProps> = ({ slide, x, width }) => {
    const timerSlide = slide.type === 'timer' ? slide as ITimerSlide : null;
    const canvasSlideSettings = slide.type === 'normal' ? (slide as any).timerSettings : null;
    const playlist = timerSlide?.playlist || canvasSlideSettings?.playlist || [];

    const playlistItems = useLiveQuery(
        async () => {
            if (playlist.length === 0) return [];
            const items = await db.mediaPool.where('id').anyOf(playlist).toArray();
            return playlist.map(id => items.find(item => item.id === id)).filter(Boolean) as IMediaItem[];
        },
        [playlist]
    ) || [];

    if (playlist.length === 0) return null;

    // Use the first song as a placeholder for the timeline view
    // In the future, we could sync the "current" index if live
    const currentSongName = playlistItems[0]?.name || '...';

    return (
        <div
            className="absolute top-0 h-[72px] flex items-center group/timer-audio"
            style={{ left: x, width }}
        >
            <div className={cn(
                "relative w-full h-full rounded-xl bg-orange-500/10 border-2 border-orange-500/20 flex flex-col justify-end p-2 overflow-hidden backdrop-blur-sm transition-all hover:bg-orange-500/15 hover:border-orange-500/30"
            )}>
                {/* Badge with count */}
                <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-orange-500/20 border border-orange-500/20 text-[8px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-1 z-20">
                    <Music className="w-2.5 h-2.5" />
                    {playlist.length} {playlist.length === 1 ? 'Song' : 'Songs'}
                </div>

                {/* Background Icon */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] group-hover/timer-audio:opacity-[0.05] transition-opacity">
                    <Timer className="w-16 h-16 text-orange-500" strokeWidth={1} />
                </div>

                {/* Subtitle / Footer */}
                <div className="relative z-10 flex items-center gap-1.5 opacity-60">
                    <Music className="w-2.5 h-2.5 text-orange-400 shrink-0" />
                    <span className="text-[10px] font-black text-white truncate uppercase tracking-tight">
                        {currentSongName}
                    </span>
                </div>

                {/* Decorative Progress (Static in timeline) */}
                <div className="absolute bottom-0 left-0 h-0.5 bg-orange-500/30 w-full" />
            </div>
        </div>
    );
};

export default React.memo(TimerAudioClip);
