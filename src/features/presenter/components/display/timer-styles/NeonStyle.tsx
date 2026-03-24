import React from 'react';
import { ITimerSettings } from '@/core/types';
import { getFillColor } from './TimerStyleUtils';

interface TimerStyleProps {
    formattedTime: string;
    settings: ITimerSettings;
}

export const NeonStyle: React.FC<TimerStyleProps> = ({ formattedTime, settings }) => {
    const accentFill = settings.customFills?.neon_cyber_accent;
    const timerTextFill = settings.customFills?.neon_cyber_timerText;
    const titleFill = settings.customFills?.neon_cyber_title;
    const subtitleFill = settings.customFills?.neon_cyber_subtitle;

    const accentColor = getFillColor(accentFill, '#2563eb');
    const color1 = '#06b6d4';
    const timerTextColor = getFillColor(timerTextFill, '#d946ef');
    const titleColor = getFillColor(titleFill, timerTextColor);
    const subtitleColor = getFillColor(subtitleFill, timerTextColor);

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[50px_50px] pointer-events-none" />

            <div className="z-10 flex flex-col items-center relative">
                {settings.prefix && (
                    <h2
                        className="font-mono tracking-[0.5em] mb-6 text-3xl"
                        style={{
                            color: titleColor,
                            textShadow: `0 0 15px ${titleColor}99`
                        }}
                    >
                        {settings.prefix}
                    </h2>
                )}

                <div
                    className="text-[17rem] font-bold tracking-widest tabular-nums text-transparent bg-clip-text bg-linear-to-b"
                    style={{
                        backgroundImage: `linear-gradient(to bottom, ${color1}, ${accentColor})`,
                        filter: `drop-shadow(0 0 30px ${color1}80) drop-shadow(0 0 10px ${color1}cc)`,
                        color: timerTextColor
                    }}
                >
                    {formattedTime}
                </div>

                {settings.subtitle && (
                    <p className="mt-6 text-xl font-mono tracking-widest" style={{ color: subtitleColor, textShadow: `0 0 10px ${subtitleColor}66` }}>
                        {settings.subtitle}
                    </p>
                )}
            </div>
        </div>
    );
};
