import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { ITimerSettings, IStyleLayer, IMediaItem } from '@/core/types';

const getFillColor = (fill?: IStyleLayer[], fallback: string = '#ffffff'): string => {
    if (!fill || fill.length === 0) return fallback;
    const firstLayer = fill.find(l => l.visible);
    if (!firstLayer) return fallback;
    if (firstLayer.type === 'color') return firstLayer.color || fallback;
    if (firstLayer.type === 'gradient') return firstLayer.gradient?.from || fallback;
    return fallback; // For image/video, we can't easily get a single color without canvas analysis
};
import { cn } from '@/core/utils/cn';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useSetAtom } from 'jotai';
import { activeOverrideAtom, OverrideType } from '@/core/store/uiAtoms';
import { audioService } from '@/features/presenter/services/AudioService';
import { IAudioScope } from '@/core/types';

interface TimerSlideRendererProps {
    id: string;
    settings: ITimerSettings;
    isPreview?: boolean;
    isLive?: boolean;
}

import { SlideBackground } from '../display/SlideBackground';
import { ensureLayers } from '@/core/utils/styleMigration';
import { useTextFit } from '@/core/hooks/useTextFit';

const TimerFill = ({ fill, className, children, style }: { fill?: IStyleLayer[], className?: string, children?: React.ReactNode, style?: React.CSSProperties }) => {
    if (!fill || fill.length === 0) return <div className={className} style={style}>{children}</div>;
    return (
        <div className={cn("relative overflow-hidden", className)} style={style}>
            <SlideBackground background={fill} />
            <div className="relative z-10 w-full h-full flex items-center justify-center">
                {children}
            </div>
        </div>
    );
};


// --- 1. MINIMAL RING STYLE ---
const MinimalRingStyle = ({ timeLeft, totalTime, formattedTime, settings }: { timeLeft: number, totalTime: number, formattedTime: string, settings: ITimerSettings }) => {
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

// --- 2. MODERN BOLD STYLE ---
const BoldDigitalStyle = ({ timeLeft, totalTime, formattedTime, settings }: { timeLeft: number, totalTime: number, formattedTime: string, settings: ITimerSettings }) => {
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

// --- 3. SERENE STYLE ---
const SereneStyle = ({ formattedTime, settings }: { formattedTime: string, settings: ITimerSettings }) => {
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

// --- 4. BRUTALIST STYLE ---
const BrutalistStyle = ({ timeLeft, settings }: { timeLeft: number, settings: ITimerSettings }) => {
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

// --- 5. NEON CYBER STYLE ---
const NeonStyle = ({ formattedTime, settings }: { formattedTime: string, settings: ITimerSettings }) => {
    const accentFill = settings.customFills?.neon_cyber_accent;
    const timerTextFill = settings.customFills?.neon_cyber_timerText;
    const titleFill = settings.customFills?.neon_cyber_title;
    const subtitleFill = settings.customFills?.neon_cyber_subtitle;

    const accentColor = getFillColor(accentFill, '#2563eb');
    const color1 = '#06b6d4'; // Fallback base color
    const timerTextColor = getFillColor(timerTextFill, '#d946ef');
    const titleColor = getFillColor(titleFill, timerTextColor);
    const subtitleColor = getFillColor(subtitleFill, timerTextColor);

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Subtle backdrop for neon contrast */}
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
                        color: timerTextColor // used as base if backgroundImage fails
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

// --- 6. AURORA STYLE ---
const AuroraStyle = ({ formattedTime, settings }: { formattedTime: string, settings: ITimerSettings }) => {
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
            {/* Base gradient for aurora atmosphere */}
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

// --- 7. OLD DIGITAL STYLE ---
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

    // Convert hex to rgba for the off state
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

const OldDigitalStyle = ({ formattedTime, settings }: { formattedTime: string, settings: ITimerSettings }) => {
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

// --- 8. FLIP CLOCK STYLE ---
// --- 8. FLIP CLOCK STYLE (Refined) ---
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

            // Safety fallback to close the flip if onAnimationEnd fails
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
            {/* 1. LAYERED BACKGROUNDS */}
            {/* Top Back: Shows NEXT digit top half */}
            <div className="absolute top-0 left-0 w-full h-[50%] overflow-hidden transform-[translateZ(0)]">
                <FlipTextSvg text={nextDisplay} isTop={true} color={color} />
                <div className="absolute inset-0 bg-linear-to-b from-black/20 to-transparent pointer-events-none" />
            </div>

            {/* Bottom Back: Shows CURRENT digit bottom half */}
            <div className="absolute bottom-0 left-0 w-full h-[50%] overflow-hidden transform-[translateZ(0)]">
                <FlipTextSvg text={currentDisplay} isTop={false} color={color} />
                <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent pointer-events-none" />
            </div>

            {/* 2. THE FLIPPING FLAP (Middle Layer) */}
            {isFlipping && (
                <div
                    className="absolute top-0 left-0 w-full h-[50%] z-20 preserve-3d animate-flip-down origin-bottom"
                    onAnimationEnd={handleAnimationEnd}
                >
                    {/* Front: Current Top Half */}
                    <div className="absolute inset-0 backface-hidden overflow-hidden" style={{ backgroundColor: panelColor }}>
                        <FlipTextSvg text={currentDisplay} isTop={true} color={color} />
                        {/* Match the static top background's shadow exactly */}
                        <div className="absolute inset-0 bg-linear-to-b from-black/20 to-transparent pointer-events-none" />
                        {/* Shadow that darkens as it flips away */}
                        <div className="absolute inset-0 bg-black animate-flip-shadow pointer-events-none" />
                    </div>

                    {/* Back: Next Bottom Half (rotated to be upright after flip) */}
                    <div className="absolute inset-0 backface-hidden overflow-hidden transform-[rotateX(180deg)]" style={{ backgroundColor: panelColor }}>
                        {/* We use isTop=false because it's the bottom half of the next digit */}
                        <FlipTextSvg text={nextDisplay} isTop={false} color={color} />
                        {/* Match the static bottom background's shadow exactly */}
                        <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent pointer-events-none" />
                        {/* Light shine that appears as it lands */}
                        <div className="absolute inset-0 bg-white animate-flip-shine pointer-events-none" />
                    </div>
                </div>
            )}

            {/* CENTER DIVIDER LINE */}
            <div className="absolute top-1/2 left-0 w-full h-px md:h-[2px] bg-black/60 -translate-y-1/2 z-30 shadow-[0_1px_1px_rgba(255,255,255,0.05)]" />

            {/* Subtle gloss overlay */}
            <div className="absolute inset-0 border border-white/5 pointer-events-none z-40" />
        </div>
    );
};

const FlipClockStyle = ({ timeLeft, settings }: { timeLeft: number, settings: ITimerSettings }) => {
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
            {/* Global background will show through, but we add the pattern overlay */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#52525b_2px,transparent_2px)] bg-size-[24px_24px]" />
            <div className="absolute inset-0 bg-linear-to-b from-transparent to-black/40" />

            <div className="z-10 flex flex-col items-center w-full max-w-[1200px] p-4 md:p-8">
                {settings.prefix && (
                    <div className="mb-8 md:mb-12">
                        <span className="text-3xl md:text-5xl font-black uppercase tracking-[0.3em]" style={{ color: titleColor }}>{settings.prefix}</span>
                    </div>
                )}

                <div className="flex items-center justify-center w-full gap-4 md:gap-8 lg:gap-12">
                    {/* Minutes Block */}
                    <div className="flex gap-2 md:gap-4 justify-end items-center">
                        <div className="w-[18vw] max-w-[180px] aspect-3/4"><AnimatedFlipDigit digit={minutes[0]} color={timerTextColor} panelColor={panelColor} /></div>
                        <div className="w-[18vw] max-w-[180px] aspect-3/4"><AnimatedFlipDigit digit={minutes[1]} color={timerTextColor} panelColor={panelColor} /></div>
                    </div>

                    {/* Colons */}
                    <div className="flex flex-col gap-4 md:gap-8">
                        <div className="w-4 h-4 md:w-6 md:h-6 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)]" style={{ backgroundColor: timerTextColor }} />
                        <div className="w-4 h-4 md:w-6 md:h-6 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)]" style={{ backgroundColor: timerTextColor }} />
                    </div>

                    {/* Seconds Block */}
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

// --- 9. NEO BRUTALIST STYLE ---
const NeoBrutalistStyle = ({ formattedTime, settings }: { formattedTime: string, settings: ITimerSettings }) => {
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

const TimerSlideRenderer: React.FC<TimerSlideRendererProps> = ({ id, settings, isPreview = false, isLive = false }) => {
    const [timeLeft, setTimeLeft] = useState(settings.duration);
    const [isStarted, setIsStarted] = useState(false);
    const [showFlash, setShowFlash] = useState(false);
    const setOverride = useSetAtom(activeOverrideAtom as any);
    const firedTriggers = useRef<Set<string>>(new Set());

    const [currentSongIndex, setCurrentSongIndex] = useState(0);

    const playlistItems = useLiveQuery(
        async () => {
            if (!settings.playlist?.length) return [];
            const items = await db.mediaPool.where('id').anyOf(settings.playlist).toArray();
            return settings.playlist.map(id => items.find(item => item.id === id)).filter(Boolean) as IMediaItem[];
        },
        [settings.playlist]
    ) || [];

    // Sync with duration changes
    useEffect(() => {
        if (!isLive) {
            setTimeLeft(settings.duration);
            firedTriggers.current.clear();
            setCurrentSongIndex(0);
        }
    }, [settings.duration, isLive]);

    const crossFadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // AI Fix: Keep track of currently playing file and playback state to avoid redundant restarts
    const lastPlayedFileRef = useRef<string | null>(null);

    // Playlist logic - Start/Stop/Cross-fade audio
    useEffect(() => {
        let isActive = true;

        if (!isLive || !settings.playlist || settings.playlist.length === 0) {
            lastPlayedFileRef.current = null;
            return;
        }

        const playTrack = async (index: number, isCrossFade: boolean = false) => {
            if (!isActive) return;

            const songItem = playlistItems[index];
            if (!songItem) return;

            // AI Fix: If this song is already "scheduled" or playing, don't restart it
            if (!isCrossFade && lastPlayedFileRef.current === songItem.path) {
                return;
            }
            lastPlayedFileRef.current = songItem.path;

            const nextIndex = (index + 1) % playlistItems.length;
            const crossFadeDuration = 5;
            const fadeIn = isCrossFade ? crossFadeDuration : 1;
            const fadeOut = crossFadeDuration;

            const scope: IAudioScope = {
                id: crypto.randomUUID(),
                presentationId: 'timer-temp', // Temporary ID for timer audio
                startSlideId: 'timer',
                endSlideId: 'timer',
                fileId: songItem.path,
                volume: 1,
                loop: false,
                crossfadeSettings: { fadeInDuration: 0, fadeOutDuration: 0 }
            };

            try {
                const playback = await audioService.playScope(scope);
                if (!playback || !isActive) return;

                const { duration } = playback;
                // AI Fix: Ensure we don't trigger an infinite loop if duration is 0 or very small
                // Minimum 1 second delay between tracks even if something goes wrong
                const crossFadeDuration = 5;
                const nextTriggerDelay = Math.max(1000, (duration - crossFadeDuration) * 1000);

                if (crossFadeTimeoutRef.current) clearTimeout(crossFadeTimeoutRef.current);

                crossFadeTimeoutRef.current = setTimeout(() => {
                    if (isLive && isActive) {
                        setCurrentSongIndex(nextIndex);
                        playTrack(nextIndex, true);
                    }
                }, nextTriggerDelay);
            } catch (err) {
                console.error('Timer Audio Failure:', err);
                crossFadeTimeoutRef.current = setTimeout(() => {
                    if (isLive && isActive) {
                        setCurrentSongIndex(nextIndex);
                        playTrack(nextIndex, false);
                    }
                }, 5000);
            }

        };

        // Initial start
        playTrack(currentSongIndex);

        return () => {
            isActive = false;
            if (crossFadeTimeoutRef.current) clearTimeout(crossFadeTimeoutRef.current);
            crossFadeTimeoutRef.current = null;
        };
    }, [isLive, id, playlistItems.length]); // Optimized dependencies

    // Separate cleanup effect for full stop
    useEffect(() => {
        if (!isLive) {
            settings.playlist?.forEach((_, index) => {
                audioService.stopScope(`timer-audio-${id}-${index}`, 0.5);
            });
            lastPlayedFileRef.current = null;
        }
    }, [isLive, id]);



    // Timer logic
    useEffect(() => {
        if (!isLive) return;

        const startTime = Date.now();
        const initialTime = timeLeft;
        const duration = settings.duration;

        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = Math.max(0, initialTime - elapsed);

            // Only update state if value actually changed to prevent excessive re-renders
            setTimeLeft(prev => {
                if (prev === remaining) return prev;
                return remaining;
            });

            // Trigger Logic
            if (settings.triggers) {
                settings.triggers.forEach(trigger => {
                    let shouldFire = false;
                    const elapsedFromStart = duration - remaining;

                    switch (trigger.type) {
                        case 'start':
                            if (elapsedFromStart <= 0.1) shouldFire = true;
                            break;
                        case 'finish':
                            if (remaining <= 0.1) shouldFire = true;
                            break;
                        case 'remaining':
                            if (remaining <= trigger.value && remaining > trigger.value - 1) shouldFire = true;
                            break;
                        case 'elapsed':
                            if (elapsedFromStart >= trigger.value && elapsedFromStart < trigger.value + 1) shouldFire = true;
                            break;
                        case 'percentage':
                            const currentPct = (elapsedFromStart / duration) * 100;
                            if (currentPct >= trigger.value) shouldFire = true;
                            break;
                    }

                    if (shouldFire && !firedTriggers.current.has(trigger.id)) {
                        firedTriggers.current.add(trigger.id);
                        executeActions(trigger.actions);
                    }
                });
            }

            if (remaining === 0) {
                clearInterval(interval);
                handleEndAction();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isLive, settings.triggers, settings.duration, settings.endAction]); // Removed timeLeft from dependencies to prevent interval recreation every second

    const executeActions = (actions: any[]) => {
        actions.forEach(action => {
            switch (action.type) {
                case 'next_slide':
                    usePresentationStore.getState().navigateNext();
                    break;
                case 'blackout':
                    setOverride('blackout');
                    break;
                case 'play_sound':
                    // Simple synthesized beep for now
                    try {
                        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
                        gain.gain.setValueAtTime(0.1, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                        osc.start();
                        osc.stop(ctx.currentTime + 0.5);
                    } catch (e) {
                        console.error('Failed to play trigger sound:', e);
                    }
                    break;
                case 'flash':
                    setShowFlash(true);
                    setTimeout(() => setShowFlash(false), 500);
                    break;
                case 'change_bg':
                    if (action.payload?.background) {
                        usePresentationStore.getState().updateSlideBackground(id, action.payload.background);
                    }
                    break;
                case 'volume_fade':
                    const volume = action.payload?.volume ?? 0;
                    const fadeDuration = action.payload?.duration ?? 0.1;

                    // Directly call audioService stop with fade if target is 0
                    if (volume === 0) {
                        audioService.stopAll(fadeDuration);
                    } else {
                        // For non-zero volume updates, we'd need to update the current gain node
                        // Since audioService doesn't expose public volume control yet, we'll just stop
                        // but let's assume we want to stop for most timer use cases
                        audioService.stopAll(fadeDuration);
                    }
                    break;
            }
        });
    };

    const handleEndAction = () => {
        if (!isLive) return;

        if (settings.endAction === 'loop') {
            setTimeLeft(settings.duration);
        } else if (settings.endAction === 'next') {
            const { navigateNext } = usePresentationStore.getState();
            navigateNext();
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = settings.duration > 0 ? (timeLeft / settings.duration) : 0;

    // Visual Styles
    // --- 10. VHS CRT STYLE ---
    const VhsCrtStyle = ({ timeLeft, formattedTime, settings }: { timeLeft: number, formattedTime: string, settings: ITimerSettings }) => {
        const timerTextFill = settings.customFills?.vhs_timerText;
        const titleFill = settings.customFills?.vhs_title;
        const accentFill = settings.customFills?.vhs_accent;

        const timerTextColor = getFillColor(timerTextFill, '#ffffff');
        const titleColor = getFillColor(titleFill, timerTextColor);
        const accentColor = getFillColor(accentFill, '#00ff00');

        return (
            <div className="absolute inset-0 overflow-hidden flex flex-col items-center justify-center font-mono uppercase">
                {/* CRT Tape black level overlay */}
                <div className="absolute inset-0 bg-black/60 pointer-events-none" />
                {/* Scanlines overlay */}
                <div className="absolute inset-0 pointer-events-none z-50 opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-size-[100%_4px,3px_100%]" />

                {/* Static/Noise effect */}
                <div className="absolute inset-0 pointer-events-none z-40 opacity-[0.03] bg-[url('https://media.giphy.com/media/oEI9uWUeez9ZK/giphy.gif')] bg-repeat" />

                <div className="relative z-10 w-full h-full p-20 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-4 text-4xl font-bold tracking-widest" style={{ color: accentColor }}>
                                <span className="animate-pulse">▶</span>
                                <span>PLAY</span>
                            </div>
                            <div className="text-2xl opacity-70" style={{ color: titleColor }}>
                                {settings.prefix || 'TIMER'}
                            </div>
                        </div>
                        <div className="text-4xl font-bold tracking-tighter" style={{ color: timerTextColor }}>
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}
                        </div>
                    </div>

                    <div className="flex flex-col items-center">
                        <div
                            className="text-[22rem] font-bold tabular-nums tracking-[-0.05em] relative pr-[1.2em]"
                            style={{
                                color: timerTextColor,
                                textShadow: `2px 0 0 rgba(255,0,0,0.5), -2px 0 0 rgba(0,0,255,0.5)`,
                                filter: 'blur(0.5px)'
                            }}
                        >
                            {formattedTime}
                            <span className="text-6xl align-top absolute ml-4 opacity-50">-{Math.floor((timeLeft % 1) * 100).toString().padStart(2, '0')}</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-end text-3xl opacity-80" style={{ color: timerTextColor }}>
                        <div className="flex flex-col">
                            <span>SP</span>
                            <span>0:00:00</span>
                        </div>
                        <div className="text-right">
                            <div>CH 03</div>
                            <div className="mt-2 h-2 w-48 bg-white/20 relative overflow-hidden">
                                <div
                                    className="absolute inset-y-0 left-0 bg-white/60 transition-all duration-1000"
                                    style={{ width: `${(timeLeft / (settings.duration || 1)) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] z-60" />
            </div>
        );
    };

    const renderStyle = () => {
        const timeStr = formatTime(timeLeft);
        const color = getFillColor(settings.themeFill, '#f97316');
        const [mins, secs] = timeStr.split(':');

        switch (settings.style) {
            case 'minimal_ring':
                return <MinimalRingStyle timeLeft={timeLeft} totalTime={settings.duration} formattedTime={timeStr} settings={settings} />;
            case 'modern_bold':
                return <BoldDigitalStyle timeLeft={timeLeft} totalTime={settings.duration} formattedTime={timeStr} settings={settings} />;
            case 'serene':
                return <SereneStyle formattedTime={timeStr} settings={settings} />;
            case 'brutalist':
                return <BrutalistStyle timeLeft={timeLeft} settings={settings} />;
            case 'neon_cyber':
                return <NeonStyle formattedTime={timeStr} settings={settings} />;
            case 'aurora':
                return <AuroraStyle formattedTime={timeStr} settings={settings} />;
            case 'old_digital':
                return <OldDigitalStyle formattedTime={timeStr} settings={settings} />;
            case 'flip_clock':
                return <FlipClockStyle timeLeft={timeLeft} settings={settings} />;
            case 'neo_brutalist':
                return <NeoBrutalistStyle formattedTime={timeStr} settings={settings} />;
            case 'vhs_crt':
                return <VhsCrtStyle timeLeft={timeLeft} formattedTime={timeStr} settings={settings} />;
            default:
                return <div className="text-[120px] text-white font-black tracking-tighter">{timeStr}</div>;
        }
    };

    return (
        <div
            className="w-full h-full flex items-center justify-center relative transition-colors duration-500"
            style={{
                backgroundColor: `rgba(0, 0, 0, ${settings.backgroundOpacity ?? 0})`
            }}
        >
            {renderStyle()}
            {showFlash && (
                <div className="absolute inset-0 bg-white animate-out fade-out duration-500 pointer-events-none z-50" />
            )}
        </div>
    );
};

export default TimerSlideRenderer;
