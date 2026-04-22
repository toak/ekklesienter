import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, Compass } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { CompactColorPicker } from './CompactColorPicker';

interface GradientPickerProps {
    from: string;
    to: string;
    angle: number;
    onChange: (from: string, to: string, angle: number) => void;
}

/**
 * Premium Gradient Picker with Visual Angle Selector
 */
export const GradientPicker: React.FC<GradientPickerProps> = ({ from, to, angle, onChange }) => {
    const dialRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleAngleChange = (e: MouseEvent | TouchEvent) => {
        if (!dialRef.current) return;
        const rect = dialRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - centerX;
        const deltaY = clientY - centerY;
        let deg = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
        if (deg < 0) deg += 360;

        onChange(from, to, Math.round(deg));
    };

    useEffect(() => {
        if (!isDragging) return;

        const onMove = (e: MouseEvent | TouchEvent) => {
            e.preventDefault();
            handleAngleChange(e);
        };
        const onUp = () => setIsDragging(false);

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);

        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
        };
    }, [isDragging, from, to]);

    const swapColors = () => onChange(to, from, angle);

    const QUICK_ANGLES = [0, 90, 135, 180, 270];

    const { t } = useTranslation();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Angle & Preview Section */}
            <div className="flex items-center gap-6">
                {/* Visual Dial */}
                <div className="flex flex-col items-center gap-2">
                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">{t('gradient_angle')}</label>
                    <div
                        ref={dialRef}
                        onMouseDown={() => setIsDragging(true)}
                        onTouchStart={() => setIsDragging(true)}
                        className="relative w-20 h-20 rounded-full bg-black/40 border-2 border-white/5 flex items-center justify-center cursor-crosshair group active:scale-95 transition-transform"
                    >
                        {/* Dial Marks */}
                        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                            <div
                                key={deg}
                                className="absolute top-1/2 left-1/2 w-0.5 h-1.5 bg-white/10 -translate-x-1/2"
                                style={{ transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-32px)` }}
                            />
                        ))}

                        {/* Indicator Needle */}
                        <div
                            className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-75"
                            style={{ transform: `rotate(${angle - 90}deg)` }}
                        >
                            <div className="w-8 h-1 bg-accent rounded-full shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)] translate-x-4" />
                        </div>

                        {/* Center Dot */}
                        <div className="w-2 h-2 rounded-full bg-stone-700 border border-white/20 z-10" />

                        {/* Angle Text Badge */}
                        <div className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-accent text-accent-foreground text-[8px] font-bold rounded-md shadow-lg border border-white/10">
                            {angle}°
                        </div>
                    </div>
                </div>

                {/* Gradient Preview Bar */}
                <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-1">{t('gradient_preview')}</label>
                    <div
                        className="h-20 w-full rounded-2xl border-2 border-white/10 shadow-inner relative overflow-hidden group"
                        style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }}
                    >
                        {/* Swap Button */}
                        <button
                            onClick={swapColors}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-90"
                            title={t('swap_colors')}
                        >
                            <ArrowRightLeft className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Angle Buttons */}
            <div className="flex flex-wrap gap-1.5">
                {QUICK_ANGLES.map(a => (
                    <button
                        key={a}
                        onClick={() => onChange(from, to, a)}
                        className={cn(
                            "px-2 py-1 rounded-lg text-[9px] font-bold transition-all border",
                            angle === a
                                ? "bg-accent/20 border-accent/40 text-accent"
                                : "bg-white/5 border-white/5 text-stone-500 hover:text-stone-300"
                        )}
                    >
                        {a}°
                    </button>
                ))}
            </div>

            {/* Color Swatches - Compact Grid */}
            <div className="grid grid-cols-1 gap-3 pt-1">
                <CompactColorPicker
                    label="From (Start)"
                    color={from}
                    onChange={(color) => onChange(color, to, angle)}
                />
                <CompactColorPicker
                    label="To (End)"
                    color={to}
                    onChange={(color) => onChange(from, color, angle)}
                />
            </div>
        </div>
    );
};
