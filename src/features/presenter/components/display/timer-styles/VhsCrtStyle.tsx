import React from 'react';
import { ITimerSettings } from '@/core/types';
import { getFillColor } from './TimerStyleUtils';

interface TimerStyleProps {
    timeLeft: number;
    formattedTime: string;
    settings: ITimerSettings;
}

export const VhsCrtStyle: React.FC<TimerStyleProps> = ({ timeLeft, formattedTime, settings }) => {
    const timerTextFill = settings.customFills?.vhs_timerText;
    const titleFill = settings.customFills?.vhs_title;
    const accentFill = settings.customFills?.vhs_accent;

    const timerTextColor = getFillColor(timerTextFill, '#ffffff');
    const titleColor = getFillColor(titleFill, timerTextColor);
    const accentColor = getFillColor(accentFill, '#00ff00');

    return (
        <div className="absolute inset-0 overflow-hidden flex flex-col items-center justify-center font-mono uppercase">
            <div className="absolute inset-0 bg-black/60 pointer-events-none" />
            <div className="absolute inset-0 pointer-events-none z-50 opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-size-[100%_4px,3px_100%]" />
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
