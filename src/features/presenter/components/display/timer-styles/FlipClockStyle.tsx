import React, { useState, useEffect, useRef } from 'react';
import { ITimerSettings } from '@/core/types';
import { getFillColor } from './TimerStyleUtils';

const FlipTextSvg = ({ text, isTop, color }: { text: string, isTop: boolean, color: string }) => (
    <div
        className="absolute left-0 w-full h-[200%] pointer-events-none"
        style={{ top: isTop ? '0' : '-100%' }}
    >
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="textGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} />
                    <stop offset="100%" stopColor={color} stopOpacity="0.8" />
                </linearGradient>
            </defs>
            <text
                x="50"
                y="50"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="85"
                fontWeight="900"
                fill="url(#textGradient)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
            >
                {text}
            </text>
        </svg>
    </div>
);

const AnimatedFlipDigit = ({ digit, color, panelColor }: { digit: string, color: string, panelColor: string }) => {
    const [currentDisplay, setCurrentDisplay] = useState(digit);
    const [nextDisplay, setNextDisplay] = useState(digit);
    const [isFlipping, setIsFlipping] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (digit !== currentDisplay) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setNextDisplay(digit);
            setIsFlipping(true);

            timeoutRef.current = setTimeout(() => {
                handleAnimationEnd();
            }, 600);
        }
    }, [digit]);

    const handleAnimationEnd = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setCurrentDisplay(nextDisplay);
        setIsFlipping(false);
    };

    return (
        <div
            className="relative w-full h-full rounded-2xl md:rounded-3xl shadow-2xl bg-black perspective-1000 overflow-hidden ring-1 ring-white/5 transform-[translateZ(0)]"
            style={{ perspective: '1000px', backgroundColor: panelColor }}
        >
            <div className="absolute top-0 left-0 w-full h-[50%] overflow-hidden transform-[translateZ(0)]">
                <FlipTextSvg text={nextDisplay} isTop={true} color={color} />
                <div className="absolute inset-0 bg-linear-to-b from-black/20 to-transparent pointer-events-none" />
            </div>

            <div className="absolute bottom-0 left-0 w-full h-[50%] overflow-hidden transform-[translateZ(0)]">
                <FlipTextSvg text={currentDisplay} isTop={false} color={color} />
                <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent pointer-events-none" />
            </div>

            {isFlipping && (
                <div
                    className="absolute top-0 left-0 w-full h-[50%] z-20 preserve-3d animate-flip-down origin-bottom"
                    onAnimationEnd={handleAnimationEnd}
                >
                    <div className="absolute inset-0 backface-hidden overflow-hidden" style={{ backgroundColor: panelColor }}>
                        <FlipTextSvg text={currentDisplay} isTop={true} color={color} />
                        <div className="absolute inset-0 bg-linear-to-b from-black/20 to-transparent pointer-events-none" />
                        <div className="absolute inset-0 bg-black animate-flip-shadow pointer-events-none" />
                    </div>

                    <div className="absolute inset-0 backface-hidden overflow-hidden transform-[rotateX(180deg)]" style={{ backgroundColor: panelColor }}>
                        <FlipTextSvg text={nextDisplay} isTop={false} color={color} />
                        <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent pointer-events-none" />
                        <div className="absolute inset-0 bg-white animate-flip-shine pointer-events-none" />
                    </div>
                </div>
            )}

            <div className="absolute top-1/2 left-0 w-full h-px md:h-[2px] bg-black/60 -translate-y-1/2 z-30 shadow-[0_1px_1px_rgba(255,255,255,0.05)]" />
            <div className="absolute inset-0 border border-white/5 pointer-events-none z-40" />
        </div>
    );
};

interface TimerStyleProps {
    timeLeft: number;
    settings: ITimerSettings;
}

export const FlipClockStyle: React.FC<TimerStyleProps> = ({ timeLeft, settings }) => {
    const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const seconds = (timeLeft % 60).toString().padStart(2, '0');

    const timerTextFill = settings.customFills?.flip_clock_timerText;
    const panelFill = settings.customFills?.flip_clock_panel;
    const titleFill = settings.customFills?.flip_clock_title;
    const subtitleFill = settings.customFills?.flip_clock_subtitle;

    const timerTextColor = getFillColor(timerTextFill, '#e4e4e7');
    const panelColor = getFillColor(panelFill, '#1a1a1a');
    const titleColor = getFillColor(titleFill, '#ffffff');
    const subtitleColor = getFillColor(subtitleFill, '#ffffff');

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#52525b_2px,transparent_2px)] bg-size-[24px_24px]" />
            <div className="absolute inset-0 bg-linear-to-b from-transparent to-black/40" />

            <div className="z-10 flex flex-col items-center w-full max-w-[1200px] p-4 md:p-8">
                {settings.prefix && (
                    <div className="mb-8 md:mb-12">
                        <span className="text-3xl md:text-5xl font-black uppercase tracking-[0.3em]" style={{ color: titleColor }}>{settings.prefix}</span>
                    </div>
                )}

                <div className="flex items-center justify-center w-full gap-4 md:gap-8 lg:gap-12">
                    <div className="flex gap-2 md:gap-4 justify-end items-center">
                        <div className="w-[18vw] max-w-[180px] aspect-3/4"><AnimatedFlipDigit digit={minutes[0]} color={timerTextColor} panelColor={panelColor} /></div>
                        <div className="w-[18vw] max-w-[180px] aspect-3/4"><AnimatedFlipDigit digit={minutes[1]} color={timerTextColor} panelColor={panelColor} /></div>
                    </div>

                    <div className="flex flex-col gap-4 md:gap-8">
                        <div className="w-4 h-4 md:w-6 md:h-6 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)]" style={{ backgroundColor: timerTextColor }} />
                        <div className="w-4 h-4 md:w-6 md:h-6 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)]" style={{ backgroundColor: timerTextColor }} />
                    </div>

                    <div className="flex gap-2 md:gap-4 justify-start items-center">
                        <div className="w-[18vw] max-w-[180px] aspect-3/4"><AnimatedFlipDigit digit={seconds[0]} color={timerTextColor} panelColor={panelColor} /></div>
                        <div className="w-[18vw] max-w-[180px] aspect-3/4"><AnimatedFlipDigit digit={seconds[1]} color={timerTextColor} panelColor={panelColor} /></div>
                    </div>
                </div>

                {settings.subtitle && (
                    <div className="mt-8 md:mt-12">
                        <span className="text-xl md:text-3xl font-bold uppercase tracking-[0.5em] opacity-50" style={{ color: subtitleColor }}>{settings.subtitle}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
