import React from 'react';
import { ITimerSettings } from '@/core/types';
import { getFillColor } from './TimerStyleUtils';

interface TimerStyleProps {
    formattedTime: string;
    settings: ITimerSettings;
}

export const SereneStyle: React.FC<TimerStyleProps> = ({ formattedTime, settings }) => {
    const accentFill = settings.customFills?.serene_accent;
    const timerTextFill = settings.customFills?.serene_timerText;
    const titleFill = settings.customFills?.serene_title;
    const subtitleFill = settings.customFills?.serene_subtitle;

    const accentColor = getFillColor(accentFill, '#8a735c');
    const timerTextColor = getFillColor(timerTextFill, '#4a3f35');
    const titleColor = getFillColor(titleFill, accentColor);
    const subtitleColor = getFillColor(subtitleFill, accentColor);

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center transition-colors duration-700">
            <div className="absolute inset-6 border rounded-3xl pointer-events-none" style={{ borderColor: `${accentColor}33` }} />
            <div className="absolute inset-8 border rounded-[1.25rem] pointer-events-none" style={{ borderColor: `${accentColor}1a` }} />

            <div className="z-10 flex flex-col items-center text-center px-8">
                {settings.prefix && (
                    <p className="text-4xl font-serif italic mb-12" style={{ color: titleColor }}>
                        {settings.prefix}
                    </p>
                )}
                <div
                    className="text-[14rem] font-serif tabular-nums leading-none tracking-wider drop-shadow-sm"
                    style={{
                        color: timerTextColor,
                    }}
                >
                    {formattedTime}
                </div>
                {settings.subtitle && (
                    <div className="mt-12 flex items-center gap-6">
                        <div className="h-px w-24" style={{ backgroundColor: `${accentColor}66` }} />
                        <p className="text-lg font-medium tracking-[0.3em] uppercase" style={{ color: subtitleColor }}>
                            {settings.subtitle}
                        </p>
                        <div className="h-px w-24" style={{ backgroundColor: `${accentColor}66` }} />
                    </div>
                )}
            </div>
        </div>
    );
};
