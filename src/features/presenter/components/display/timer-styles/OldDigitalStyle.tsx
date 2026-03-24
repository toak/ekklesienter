import React from 'react';
import { ITimerSettings } from '@/core/types';
import { getFillColor, TimerFill } from './TimerStyleUtils';

const SegmentDigit = ({ digit, activeColor = '#ef4444' }: { digit: string, activeColor?: string }) => {
    const num = parseInt(digit);

    const getActiveSegments = (n: number) => {
        const map: Record<number, number[]> = {
            0: [1, 1, 1, 1, 1, 1, 0],
            1: [0, 1, 1, 0, 0, 0, 0],
            2: [1, 1, 0, 1, 1, 0, 1],
            3: [1, 1, 1, 1, 0, 0, 1],
            4: [0, 1, 1, 0, 0, 1, 1],
            5: [1, 0, 1, 1, 0, 1, 1],
            6: [1, 0, 1, 1, 1, 1, 1],
            7: [1, 1, 1, 0, 0, 0, 0],
            8: [1, 1, 1, 1, 1, 1, 1],
            9: [1, 1, 1, 1, 0, 1, 1]
        };
        return map[isNaN(n) ? 8 : n];
    };

    const active = getActiveSegments(num);
    const shadowColor = `${activeColor}ff`;
    const offColor = `${activeColor}1a`;

    return (
        <svg viewBox="0 0 40 70" className="h-full w-auto">
            <polygon points="12,5 28,5 25,9 15,9" fill={active[0] ? activeColor : offColor} style={{ filter: active[0] ? `drop-shadow(0 0 12px ${shadowColor})` : 'none' }} className="transition-colors duration-200" />
            <polygon points="29,6 33,10 33,32 29,34 26,30 26,10" fill={active[1] ? activeColor : offColor} style={{ filter: active[1] ? `drop-shadow(0 0 12px ${shadowColor})` : 'none' }} className="transition-colors duration-200" />
            <polygon points="29,36 33,38 33,64 29,65 26,60 26,40" fill={active[2] ? activeColor : offColor} style={{ filter: active[2] ? `drop-shadow(0 0 12px ${shadowColor})` : 'none' }} className="transition-colors duration-200" />
            <polygon points="12,65 28,65 25,61 15,61" fill={active[3] ? activeColor : offColor} style={{ filter: active[3] ? `drop-shadow(0 0 12px ${shadowColor})` : 'none' }} className="transition-colors duration-200" />
            <polygon points="11,36 7,38 7,64 11,65 14,60 14,40" fill={active[4] ? activeColor : offColor} style={{ filter: active[4] ? `drop-shadow(0 0 12px ${shadowColor})` : 'none' }} className="transition-colors duration-200" />
            <polygon points="11,6 7,10 7,32 11,34 14,30 14,10" fill={active[5] ? activeColor : offColor} style={{ filter: active[5] ? `drop-shadow(0 0 12px ${shadowColor})` : 'none' }} className="transition-colors duration-200" />
            <polygon points="13,35 15,33 25,33 27,35 25,37 15,37" fill={active[6] ? activeColor : offColor} style={{ filter: active[6] ? `drop-shadow(0 0 12px ${shadowColor})` : 'none' }} className="transition-colors duration-200" />
        </svg>
    );
};

interface TimerStyleProps {
    formattedTime: string;
    settings: ITimerSettings;
}

export const OldDigitalStyle: React.FC<TimerStyleProps> = ({ formattedTime, settings }) => {
    const chars = formattedTime.split('');

    const panelFill = settings.customFills?.old_digital_panel;
    const borderFill = settings.customFills?.old_digital_border;
    const timerTextFill = settings.customFills?.old_digital_timerText;
    const titleFill = settings.customFills?.old_digital_title;
    const subtitleFill = settings.customFills?.old_digital_subtitle;

    const timerTextColor = getFillColor(timerTextFill, '#ef4444');
    const panelColor = getFillColor(panelFill, '#0a0202');
    const borderColor = getFillColor(borderFill, '#1a1a1a');
    const titleColor = getFillColor(titleFill, timerTextColor);
    const subtitleColor = getFillColor(subtitleFill, timerTextColor);

    return (
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] z-10 pointer-events-none" />

            <div className="relative z-0">
                <TimerFill
                    className="px-24 py-16 rounded-[4rem] border-12 shadow-[inset_0_0_80px_rgba(0,0,0,1),0_0_50px_rgba(0,0,0,0.3)] flex flex-col items-center"
                    style={{ backgroundColor: panelColor, borderColor: borderColor }}
                    fill={panelFill}
                >
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[6px_6px] pointer-events-none rounded-[3.5rem]" />

                    {settings.prefix && (
                        <span className="text-sm font-mono tracking-widest uppercase mb-12 font-bold opacity-30" style={{ color: titleColor }}>
                            {settings.prefix}
                        </span>
                    )}

                    <div className="flex items-center gap-8 h-64">
                        {chars.map((char: string, i: number) => {
                            if (char === ':') {
                                return (
                                    <svg key={i} viewBox="0 0 10 70" className="h-full w-8">
                                        <circle cx="5" cy="25" r="4" fill={timerTextColor} className="animate-pulse" style={{ filter: `drop-shadow(0 0 12px ${timerTextColor})` }} />
                                        <circle cx="5" cy="45" r="4" fill={timerTextColor} className="animate-pulse" style={{ filter: `drop-shadow(0 0 12px ${timerTextColor})` }} />
                                    </svg>
                                );
                            }
                            return <SegmentDigit key={i} digit={char} activeColor={timerTextColor} />;
                        })}
                    </div>

                    {settings.subtitle && (
                        <span className="text-sm font-mono tracking-widest uppercase mt-12 font-bold opacity-30" style={{ color: subtitleColor }}>
                            {settings.subtitle}
                        </span>
                    )}
                </TimerFill>
            </div>
        </div>
    );
};
