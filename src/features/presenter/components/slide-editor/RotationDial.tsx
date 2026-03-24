import React, { useState, useEffect, useRef } from 'react';
import { Compass } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';

interface RotationDialProps {
    label: React.ReactNode;
    value: number | 'mixed';
    onChange: (value: number) => void;
    className?: string;
    t?: any;
}

/**
 * Premium Rotation Dial matching the GradientPicker's compass style.
 */
export const RotationDial: React.FC<RotationDialProps> = ({
    label,
    value,
    onChange,
    className,
    t
}) => {
    const dialRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleRotationChange = (e: MouseEvent | TouchEvent) => {
        if (!dialRef.current) return;
        const rect = dialRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - centerX;
        const deltaY = clientY - centerY;

        // Match the GradientPicker logic: atan2 + 90deg offset
        let deg = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
        if (deg < 0) deg += 360;

        onChange(Math.round(deg));
    };

    useEffect(() => {
        if (!isDragging) return;

        const onMove = (e: MouseEvent | TouchEvent) => {
            if (e.cancelable) e.preventDefault();
            handleRotationChange(e);
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
    }, [isDragging]);

    const displayValue = value === 'mixed' ? 0 : value;
    const isMixed = value === 'mixed';

    return (
        <div className={cn("flex flex-col items-center gap-1.5", className)}>
            <label className="text-[8px] font-black text-stone-500 uppercase tracking-[0.2em] mb-0.5">{label}</label>
            <div
                ref={dialRef}
                onMouseDown={async () => {
                    if (isMixed) return;
                    const { takeSnapshot, previewSlideId } = usePresentationStore.getState();
                    if (previewSlideId) await takeSnapshot(previewSlideId);
                    setIsDragging(true);
                }}
                onTouchStart={async () => {
                    if (isMixed) return;
                    const { takeSnapshot, previewSlideId } = usePresentationStore.getState();
                    if (previewSlideId) await takeSnapshot(previewSlideId);
                    setIsDragging(true);
                }}
                onDoubleClick={() => !isMixed && onChange(0)}
                className={cn(
                    "relative w-14 h-14 rounded-full bg-black/20 border transition-all shadow-inner",
                    isMixed
                        ? "border-white/5 cursor-default opacity-50"
                        : "border-white/5 cursor-crosshair group hover:border-accent/30 active:scale-95"
                )}
                title={isMixed ? "Multiple values" : "Drag to rotate, Double-click to reset"}
            >
                {/* Dial Marks */}
                {[0, 90, 180, 270].map(deg => (
                    <div
                        key={deg}
                        className="absolute top-1/2 left-1/2 w-0.5 h-1 bg-white/10 -translate-x-1/2"
                        style={{ transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-21px)` }}
                    />
                ))}

                {/* Indicator Needle */}
                {!isMixed && (
                    <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-75"
                        style={{ transform: `rotate(${displayValue - 90}deg)` }}
                    >
                        <div className="w-4 h-0.5 bg-accent rounded-full shadow-[0_0_8px_rgba(var(--accent-rgb),0.5)] translate-x-2.5" />
                    </div>
                )}

                {/* Value Badge */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className={cn(
                        "text-[9px] font-bold transition-colors",
                        isMixed ? "text-stone-600 italic" : "text-stone-400 group-hover:text-accent"
                    )}>
                        {isMixed ? 'Mixed' : `${displayValue}°`}
                    </span>
                </div>
            </div>
        </div>
    );
};
