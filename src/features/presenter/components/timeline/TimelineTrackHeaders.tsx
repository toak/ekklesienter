import React from 'react';
import { Monitor, Music } from 'lucide-react';
import { TFunction } from 'i18next';

interface TimelineTrackHeadersProps {
    t: TFunction;
    hasSlides: boolean;
}

export const TimelineTrackHeaders: React.FC<TimelineTrackHeadersProps> = ({ t, hasSlides }) => {
    return (
        <div className="w-20 shrink-0 border-r border-white/5 bg-stone-950/40 flex flex-col z-20 backdrop-blur-md">
            {/* Slides Track Header */}
            <div className="h-[98px] flex flex-col items-center justify-center p-2 opacity-50 hover:opacity-100 transition-opacity">
                <Monitor className="w-5 h-5 mb-1 text-stone-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-stone-500 text-center">
                    {t('slides', 'Slides')}
                </span>
            </div>
            {/* Audio Track Header */}
            {hasSlides && (
                <div className="h-[98px] shrink-0 flex flex-col items-center justify-center p-2 bg-purple-500/5 hover:bg-purple-500/10 transition-colors border-t border-white/5">
                    <Music className="w-4 h-4 mb-1 text-purple-400/70" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-purple-500/70 text-center">
                        {t('audio', 'Audio')}
                    </span>
                </div>
            )}
        </div>
    );
};
