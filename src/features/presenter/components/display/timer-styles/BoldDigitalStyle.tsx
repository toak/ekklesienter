import React from 'react';
import { ITimerSettings } from '@/core/types';
import { getFillColor, TimerFill } from './TimerStyleUtils';

interface TimerStyleProps {
    timeLeft: number;
    totalTime: number;
    formattedTime: string;
    settings: ITimerSettings;
}

export const BoldDigitalStyle: React.FC<TimerStyleProps> = ({ timeLeft, totalTime, formattedTime, settings }) => {
    const progressPercent = (timeLeft / (totalTime || 1)) * 100;

    const accentFill = settings.customFills?.modern_bold_accent;
    const timerTextFill = settings.customFills?.modern_bold_timerText;
    const titleFill = settings.customFills?.modern_bold_title;
    const subtitleFill = settings.customFills?.modern_bold_subtitle;

    const accentColor = getFillColor(accentFill, '#3b82f6');
    const timerTextColor = getFillColor(timerTextFill, '#ffffff');
    const titleColor = getFillColor(titleFill, accentColor);
    const subtitleColor = getFillColor(subtitleFill, 'rgba(255,255,255,0.6)');

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center transition-colors duration-700">
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] blur-[120px] rounded-full pointer-events-none opacity-20"
                style={{ backgroundColor: accentColor }}
            />

            <div className="z-10 flex flex-col items-center">
                {settings.prefix && (
                    <h2 className="text-4xl font-semibold tracking-[0.4em] uppercase mb-8" style={{ color: titleColor }}>
                        {settings.prefix}
                    </h2>
                )}
                <div className="text-[18rem] font-black tracking-tighter tabular-nums leading-none drop-shadow-2xl" style={{ color: timerTextColor }}>
                    {formattedTime}
                </div>
                {settings.subtitle && (
                    <p className="text-2xl font-medium tracking-[0.2em] uppercase mt-8 opacity-60" style={{ color: subtitleColor }}>
                        {settings.subtitle}
                    </p>
                )}
            </div>

            <div className="absolute bottom-0 left-0 w-full h-4 bg-white/5">
                <TimerFill
                    className="h-full shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-1000 linear"
                    style={{
                        width: `${progressPercent}%`,
                        boxShadow: `0 0 20px ${accentColor}`
                    }}
                    fill={accentFill}
                />
            </div>
        </div>
    );
};
