import React from 'react';
import { ITimerSettings } from '@/core/types';
import { useTimerAudio } from '@/features/presenter/hooks/useTimerAudio';
import { useTimerCore } from '@/features/presenter/hooks/useTimerCore';
import { getFillColor } from './timer-styles/TimerStyleUtils';

// Modular Styles
import { MinimalRingStyle } from './timer-styles/MinimalRingStyle';
import { BoldDigitalStyle } from './timer-styles/BoldDigitalStyle';
import { SereneStyle } from './timer-styles/SereneStyle';
import { BrutalistStyle } from './timer-styles/BrutalistStyle';
import { NeonStyle } from './timer-styles/NeonStyle';
import { AuroraStyle } from './timer-styles/AuroraStyle';
import { OldDigitalStyle } from './timer-styles/OldDigitalStyle';
import { FlipClockStyle } from './timer-styles/FlipClockStyle';
import { NeoBrutalistStyle } from './timer-styles/NeoBrutalistStyle';
import { VhsCrtStyle } from './timer-styles/VhsCrtStyle';

interface TimerSlideRendererProps {
    id: string;
    settings: ITimerSettings;
    isPreview?: boolean;
    isLive?: boolean;
}

/**
 * Main renderer for Timer slides.
 * Orchestrates audio playback, countdown logic, and visual styles.
 */
const TimerSlideRenderer: React.FC<TimerSlideRendererProps> = ({ id, settings, isLive = false }) => {
    // Audio Logic (Playlist, Cross-fading)
    useTimerAudio(id, settings, isLive);

    // Core Logic (Countdown, Triggers, Flash)
    const { timeLeft, showFlash, formatTime } = useTimerCore(id, settings, isLive);

    const renderStyle = () => {
        const timeStr = formatTime(timeLeft);

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
                return (
                    <div
                        className="text-[120px] font-black tracking-tighter"
                        style={{ color: getFillColor(settings.themeFill, '#f97316') }}
                    >
                        {timeStr}
                    </div>
                );
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
