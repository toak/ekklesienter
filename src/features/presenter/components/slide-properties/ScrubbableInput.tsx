import React, { useState, useRef, useMemo, useEffect } from 'react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { cn } from '@/core/utils/cn';

interface IScrubbableInputProps {
    label?: React.ReactNode;
    value: number | 'mixed';
    onChange: (v: number) => void;
    step?: number;
    min?: number;
    max?: number;
    formatter?: (v: number) => number | string;
    className?: string;
    name?: string;
    suffix?: string;
    variant?: 'default' | 'minimal';
    onMouseDown?: (e: React.MouseEvent) => void;
}

export const ScrubbableInput: React.FC<IScrubbableInputProps> = ({
    label,
    value,
    onChange,
    step = 1,
    min = -9999,
    max = 9999,
    formatter = (v: number) => Math.round(v * 10) / 10,
    className,
    name,
    onMouseDown
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [localValue, setLocalValue] = useState(value === 'mixed' ? 'Mixed' : formatter(value).toString());
    const startY = useRef(0);
    const startVal = useRef(typeof value === 'number' ? value : 0);

    // Use refs for unstable functions to prevent infinite loops in effects
    const formatterRef = useRef(formatter);
    const onChangeRef = useRef(onChange);

    useEffect(() => {
        formatterRef.current = formatter;
        onChangeRef.current = onChange;
    }, [formatter, onChange]);

    const inputId = useMemo(() => {
        if (name) return `scrubber-${name}`;
        if (typeof label === 'string') return `scrubber-${label}`;
        return `scrubber-${Math.random().toString(36).substr(2, 9)}`;
    }, [name, label]);

    useEffect(() => {
        if (!isDragging && document.activeElement?.id !== inputId) {
            const nextValue = value === 'mixed' ? 'Mixed' : formatterRef.current(value).toString();
            if (nextValue !== localValue) {
                setLocalValue(nextValue);
            }
        }
    }, [value, isDragging, inputId, localValue]);

    const { takeSnapshot, previewSlideId } = usePresentationStore();

    const handlePointerDown = async (e: React.PointerEvent) => {
        if (value === 'mixed') return;
        if (previewSlideId) await takeSnapshot(previewSlideId);
        setIsDragging(true);
        startY.current = e.clientY;
        startVal.current = typeof value === 'number' ? value : 0;
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMove = (e: PointerEvent) => {
            const delta = startY.current - e.clientY;
            let newVal = startVal.current + (delta * step);
            newVal = Math.max(min, Math.min(max, newVal));
            const inv = 1.0 / step;
            newVal = Math.round(newVal * inv) / inv;
            setLocalValue(formatterRef.current(newVal).toString());
            onChangeRef.current(newVal);
        };

        const handleUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };
    }, [isDragging, step, min, max]);

    const handleBlur = () => {
        let parsed = parseFloat(localValue);
        if (isNaN(parsed)) {
            setLocalValue(value === 'mixed' ? 'Mixed' : formatterRef.current(typeof value === 'number' ? value : 0).toString());
            return;
        }
        parsed = Math.max(min, Math.min(max, parsed));
        setLocalValue(formatterRef.current(parsed).toString());
        onChangeRef.current(parsed);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    return (
        <div
            className={cn("flex items-center gap-1.5 bg-black/40 px-2 py-1.5 rounded-lg border border-white/5 flex-1 min-w-0 group hover:border-white/20 transition-colors", className)}
            onPointerDown={handlePointerDown}
            style={{ cursor: value === 'mixed' ? 'default' : 'ns-resize' }}
            title={value === 'mixed' ? 'Multiple values' : 'Drag vertically to adjust, or click to type'}
        >
            {label && (
                <span className="text-[9px] font-black text-stone-500 uppercase min-w-[12px] shrink-0 select-none pointer-events-none group-hover:text-stone-300 transition-colors flex items-center justify-center">{label}</span>
            )}
            <input
                id={inputId}
                type="text"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onFocus={async (e) => {
                    if (previewSlideId) await takeSnapshot(previewSlideId);
                    if (value === 'mixed') e.target.select();
                }}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onPointerDown={(e) => e.stopPropagation()}
                className={cn(
                    "w-full bg-transparent text-[10px] text-white font-mono focus:outline-none min-w-0 text-right",
                    value === 'mixed' && "text-stone-500 italic"
                )}
                style={{ cursor: 'text' }}
            />
        </div>
    );
};
