import React from 'react';
import { ITimerSettings } from '@/core/types';
import { getFillColor, TimerFill } from './TimerStyleUtils';

interface TimerStyleProps {
    formattedTime: string;
    settings: ITimerSettings;
}

export const NeoBrutalistStyle: React.FC<TimerStyleProps> = ({ formattedTime, settings }) => {
    const badgeFill = settings.customFills?.neo_brutalist_badge;
    const borderFill = settings.customFills?.neo_brutalist_border;
    const cardBackgroundFill = settings.customFills?.neo_brutalist_cardBackground;
    const shadowFill = settings.customFills?.neo_brutalist_shadow;
    const timerTextFill = settings.customFills?.neo_brutalist_timerText;
    const titleFill = settings.customFills?.neo_brutalist_title;
    const subtitleFill = settings.customFills?.neo_brutalist_subtitle;

    const badgeColor = getFillColor(badgeFill, '#fbbf24');
    const borderColor = getFillColor(borderFill, '#000000');
    const cardBackgroundColor = getFillColor(cardBackgroundFill, '#ffffff');
    const shadowColor = getFillColor(shadowFill, '#000000');
    const timerTextColor = getFillColor(timerTextFill, '#000000');
    const titleColor = getFillColor(titleFill, '#000000');
    const subtitleColor = getFillColor(subtitleFill, '#000000');

    return (
        <div className="absolute inset-0 flex items-center justify-center p-8 overflow-hidden" style={{ color: timerTextColor }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,currentColor_3px,transparent_3px)] bg-size-[40px_40px] opacity-[0.1]" />

            <div className="relative z-10 flex flex-col items-center">
                {settings.prefix && (
                    <div className="z-20 -mb-10">
                        <TimerFill
                            className="border-8 px-10 py-4 text-5xl shadow-[8px_8px_0px_rgba(0,0,0,1)] -rotate-3 whitespace-nowrap tracking-tight font-black"
                            style={{
                                backgroundColor: badgeColor,
                                borderColor: borderColor,
                                color: titleColor,
                                boxShadow: `8px 8px 0px ${shadowColor}`
                            }}
                            fill={badgeFill}
                        >
                            {settings.prefix}
                        </TimerFill>
                    </div>
                )}

                <div
                    className="border-14 px-20 py-16 flex flex-col items-center transform transition-transform hover:scale-[1.01] duration-300 relative min-w-[600px]"
                    style={{
                        borderColor: borderColor,
                        boxShadow: `24px 24px 0px ${shadowColor}`,
                    }}
                >
                    <TimerFill className="absolute inset-0 -z-10" fill={cardBackgroundFill} style={{ backgroundColor: cardBackgroundColor }} />
                    <div className="text-[18rem] font-black leading-[0.85] tracking-tighter tabular-nums text-center px-8" style={{ color: timerTextColor }}>
                        {formattedTime}
                    </div>

                    <div className="w-full border-b-10 my-10" style={{ borderColor: borderColor }} />

                    {settings.subtitle && (
                        <div className="text-5xl tracking-[0.2em] font-black w-full flex justify-between items-center px-8" style={{ color: subtitleColor }}>
                            <span>{settings.subtitle}</span>
                            <span className="animate-pulse">▶</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
