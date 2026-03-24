import React, { useRef } from 'react';
import { ITimerSettings } from '@/core/types';
import { getFillColor, TimerFill } from './TimerStyleUtils';
import { useTextFit } from '@/core/hooks/useTextFit';

interface TimerStyleProps {
    timeLeft: number;
    settings: ITimerSettings;
}

export const BrutalistStyle: React.FC<TimerStyleProps> = ({ timeLeft, settings }) => {
    const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const seconds = (timeLeft % 60).toString().padStart(2, '0');

    const rightPanelFill = settings.customFills?.brutalist_rightPanel;
    const badgeFill = settings.customFills?.brutalist_badge;
    const borderFill = settings.customFills?.brutalist_border;
    const timerTextFill = settings.customFills?.brutalist_timerText;
    const titleFill = settings.customFills?.brutalist_title;
    const subtitleFill = settings.customFills?.brutalist_subtitle;

    const badgeColor = getFillColor(badgeFill, '#ff4b4b');
    const borderColor = getFillColor(borderFill, '#111');
    const timerTextColor = getFillColor(timerTextFill, '#111');
    const titleColor = getFillColor(titleFill, '#ffffff');
    const subtitleColor = getFillColor(subtitleFill, '#111');

    const minContainerRef = useRef<HTMLDivElement>(null);
    const secContainerRef = useRef<HTMLDivElement>(null);

    const { fontSize: minFontSize, contentRef: minContentRef } = useTextFit({
        text: "88",
        containerRef: minContainerRef,
        maxFontSize: 800,
        safetyMargin: 40
    });

    const { fontSize: secFontSize, contentRef: secContentRef } = useTextFit({
        text: "88",
        containerRef: secContainerRef,
        maxFontSize: 800,
        safetyMargin: 40
    });

    return (
        <div className="absolute inset-0 grid grid-cols-2 uppercase tracking-tighter border-12" style={{ borderColor: borderColor, color: timerTextColor }}>
            <div className="flex flex-col justify-between border-r-12 p-10 pb-0 overflow-hidden relative" style={{ borderColor: borderColor }}>
                <span className="text-6xl z-10 font-black">MIN</span>
                <div ref={minContainerRef} className="flex-1 flex items-end justify-center overflow-hidden">
                    <div
                        ref={minContentRef}
                        className="font-black leading-[0.7] whitespace-nowrap text-center w-full tabular-nums"
                        style={{ fontSize: `${minFontSize}px` }}
                    >
                        {minutes}
                    </div>
                </div>
            </div>
            <TimerFill className="flex flex-col justify-between p-10 pb-0 overflow-hidden relative" fill={rightPanelFill} style={{ backgroundColor: '#ffea00' }}>
                <span className="text-6xl z-10 font-black">SEC</span>
                <div ref={secContainerRef} className="flex-1 flex items-end justify-center overflow-hidden w-full">
                    <div
                        ref={secContentRef}
                        className="font-black leading-[0.7] whitespace-nowrap text-center w-full tabular-nums"
                        style={{ fontSize: `${secFontSize}px` }}
                    >
                        {seconds}
                    </div>
                </div>
            </TimerFill>

            {settings.prefix && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                    <TimerFill
                        className="px-12 py-5 text-6xl border-[6px] -rotate-3 whitespace-nowrap hover:rotate-0 transition-transform shadow-[12px_12px_0px_rgba(0,0,0,1)] font-black"
                        style={{
                            borderColor: borderColor,
                            boxShadow: `12px 12px 0px ${badgeColor}`,
                            backgroundColor: badgeColor,
                            color: titleColor
                        }}
                        fill={badgeFill}
                    >
                        {settings.prefix}
                    </TimerFill>
                </div>
            )}
            {settings.subtitle && (
                <div className="absolute bottom-10 left-10 z-10">
                    <span className="text-4xl font-black bg-white px-4 py-1 border-4" style={{ borderColor: borderColor, color: subtitleColor }}>
                        {settings.subtitle}
                    </span>
                </div>
            )}
        </div>
    );
};
