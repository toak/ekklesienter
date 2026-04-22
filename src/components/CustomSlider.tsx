import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/core/utils/cn';

interface CustomSliderProps {
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    label?: string;
    unit?: string;
    className?: string;
    formatValue?: (value: number) => string;
    defaultValue?: number;
}

export const CustomSlider: React.FC<CustomSliderProps> = ({
    value,
    min,
    max,
    step = 1,
    onChange,
    label,
    unit = '',
    className,
    formatValue,
    defaultValue
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const calculateValue = useCallback((clientX: number) => {
        if (!containerRef.current) return value;
        const rect = containerRef.current.getBoundingClientRect();
        const offsetX = clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, offsetX / rect.width));
        const rawValue = min + percentage * (max - min);

        // Round to nearest step
        const steppedValue = Math.round(rawValue / step) * step;
        const finalValue = Math.max(min, Math.min(max, steppedValue));

        // Format to fix floating point issues if step is decimal
        return parseFloat(finalValue.toFixed(4));
    }, [min, max, step, value]);

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        onChange(calculateValue(e.clientX));
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging) {
            onChange(calculateValue(e.clientX));
        }
    };

    const handlePointerUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e: PointerEvent) => onChange(calculateValue(e.clientX));
        const onUp = () => setIsDragging(false);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [isDragging, calculateValue, onChange]);

    const percentage = ((value - min) / (max - min)) * 100;
    const stops = [0, 20, 40, 60, 80, 100];

    return (
        <div className={cn("space-y-3 w-full", className)}>
            {label && (
                <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">{label}</label>
                    <span className="text-xs font-mono text-accent">
                        {formatValue ? formatValue(value) : (unit === '%' ? Math.round(percentage) : value) + unit}
                    </span>
                </div>
            )}

            <div
                ref={containerRef}
                className="relative h-10 w-full bg-black/40 rounded-xl overflow-hidden cursor-pointer group active:scale-[0.99] transition-transform select-none"
                onPointerDown={handlePointerDown}
                onDoubleClick={() => {
                    if (defaultValue !== undefined) {
                        onChange(defaultValue);
                        setIsDragging(false);
                    }
                }}
            >
                {/* Track Fill */}
                <div
                    className={cn(
                        "absolute inset-0 bg-accent/20",
                        !isDragging && "transition-all duration-150"
                    )}
                    style={{ width: `${percentage}%` }}
                />

                {/* Main Fill Gradient (more bold) */}
                <div
                    className={cn(
                        "absolute inset-y-0 left-0 bg-accent shadow-[0_0_20px_rgba(var(--accent),0.3)]",
                        !isDragging && "transition-all duration-150"
                    )}
                    style={{ width: `${percentage}%` }}
                />

                {/* Stops */}
                <div className="absolute inset-0 flex justify-between px-0 pointer-events-none">
                    {stops.map((stop) => (
                        <div
                            key={stop}
                            className={cn(
                                "h-full w-px transition-colors duration-300",
                                percentage >= stop ? "bg-accent-foreground/20" : "bg-white/5"
                            )}
                            style={{
                                position: 'absolute',
                                left: `${stop}%`,
                                transform: stop === 100 ? 'translateX(-100%)' : stop === 0 ? 'none' : 'translateX(-50%)'
                            }}
                        />
                    ))}
                </div>

                {/* Subtle Glass Highlight */}
                <div className="absolute inset-0 bg-linear-to-b from-white/5 to-transparent pointer-events-none" />

                {/* Interaction Label (optional, subtle) */}
                <div className="absolute inset-x-0 bottom-0.5 flex justify-between px-2 pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
                    <span className="text-[8px] font-bold text-white uppercase">0%</span>
                    <span className="text-[8px] font-bold text-white uppercase">100%</span>
                </div>
            </div>
        </div>
    );
};
