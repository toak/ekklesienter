import React from 'react';
import { ITimerSettings } from '@/core/types';
import { getFillColor } from './TimerStyleUtils';

interface TimerStyleProps {
    formattedTime: string;
    settings: ITimerSettings;
}

export const AuroraStyle: React.FC<TimerStyleProps> = ({ formattedTime, settings }) => {
    const accentFill = settings.customFills?.aurora_accent;
    const accent2Fill = settings.customFills?.aurora_accent2;
    const timerTextFill = settings.customFills?.aurora_timerText;
    const titleFill = settings.customFills?.aurora_title;
    const subtitleFill = settings.customFills?.aurora_subtitle;

    const accentColor = getFillColor(accentFill, '#9333ea');
    const accent2Color = getFillColor(accent2Fill, '#14b8a6');
    const timerTextColor = getFillColor(timerTextFill, '#ffffff');
    const titleColor = getFillColor(titleFill, 'rgba(255,255,255,0.6)');
    const subtitleColor = getFillColor(subtitleFill, 'rgba(255,255,255,0.5)');

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-black/40" />
            <div
                className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] mix-blend-screen opacity-30"
                style={{ backgroundColor: accent2Color }}
            />
            <div
                className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] mix-blend-screen opacity-30"
                style={{ backgroundColor: accentColor }}
            />

            <div className="z-10 bg-white/5 border border-white/10 backdrop-blur-3xl px-24 py-20 rounded-[4rem] flex flex-col items-center shadow-2xl">
                {settings.prefix && (
                    <span className="uppercase tracking-[0.4em] text-lg font-medium mb-8" style={{ color: titleColor }}>
                        {settings.prefix}
                    </span>
                )}
                <div className="text-[13rem] font-light tabular-nums leading-none tracking-tight drop-shadow-md" style={{ color: timerTextColor }}>
                    {formattedTime}
                </div>
                {settings.subtitle && (
                    <p className="mt-8 text-xl font-medium tracking-[0.2em] uppercase opacity-60" style={{ color: subtitleColor }}>
                        {settings.subtitle}
                    </p>
                )}
            </div>
        </div>
    );
};
