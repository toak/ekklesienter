import React from 'react';
import { ITimerSettings } from '@/core/types';
import { getFillColor } from './TimerStyleUtils';

interface TimerStyleProps {
    timeLeft: number;
    totalTime: number;
    formattedTime: string;
    settings: ITimerSettings;
}

export const MinimalRingStyle: React.FC<TimerStyleProps> = ({ timeLeft, totalTime, formattedTime, settings }) => {
    const radius = 48;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (timeLeft / (totalTime || 1)) * circumference;

    const ringFill = settings.customFills?.minimal_ring_ring;
    const timerTextFill = settings.customFills?.minimal_ring_timerText;
    const titleFill = settings.customFills?.minimal_ring_title;

    const ringColor = getFillColor(ringFill, '#2563eb');
    const timerTextColor = getFillColor(timerTextFill, '#ffffff');
    const titleColor = getFillColor(titleFill, 'rgba(255,255,255,0.4)');

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center transition-colors duration-700">
            <div className="relative flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-[60vh] h-[60vh] -rotate-90 overflow-visible">
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className="opacity-10 text-white"
                    />
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        style={{
                            strokeDashoffset,
                            transition: 'stroke-dashoffset 1s linear'
                        }}
                        className="drop-shadow-md"
                    />
                </svg>
                <div className="absolute flex flex-col items-center">
                    <span className="text-[12rem] font-light tracking-tighter tabular-nums leading-none overflow-hidden" style={{ color: timerTextColor }}>
                        {formattedTime}
                    </span>
                    {settings.prefix && (
                        <span className="text-2xl font-medium tracking-[0.3em] uppercase mt-4" style={{ color: titleColor }}>
                            {settings.prefix}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
