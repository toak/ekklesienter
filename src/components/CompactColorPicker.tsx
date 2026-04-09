import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/core/utils/cn';
import { FloatingPopover } from './FloatingPopover';

interface CompactColorPickerProps {
    color: string;
    onChange: (color: string) => void;
    label?: string;
    className?: string;
}

interface ColorPickerPanelProps {
    color: string;
    onChange: (color: string) => void;
}

// Reuse HSV conversion helpers
const hexToHsv = (hex: string) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, v: v * 100 };
};

const hsvToHex = (h: number, s: number, v: number) => {
    h /= 360; s /= 100; v /= 100;
    let r = 0, g = 0, b = 0;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    const toHex = (n: number) => {
        const hx = Math.round(n * 255).toString(16);
        return hx.length === 1 ? '0' + hx : hx;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

export const CompactColorPicker: React.FC<CompactColorPickerProps> = ({
    color,
    onChange,
    label,
    className
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            {label && (
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest px-1">
                    {label}
                </label>
            )}

            <button
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all hover:scale-110 active:scale-95 shadow-sm relative group",
                    isOpen ? "border-accent ring-4 ring-accent/20" : "border-white/20 hover:border-white/40"
                )}
                style={{ backgroundColor: color }}
            >
                <div className="absolute inset-0 rounded-full bg-linear-to-tr from-black/20 to-transparent pointer-events-none" />
            </button>

            <FloatingPopover
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                anchorRef={triggerRef}
                title="Pick Color"
                width={280}
            >
                <div className="p-1">
                    <ColorPickerPanel color={color} onChange={onChange} />
                </div>
            </FloatingPopover>
        </div>
    );
};

const ColorPickerPanel: React.FC<ColorPickerPanelProps> = ({
    color,
    onChange
}) => {
    const [hsv, setHsv] = useState(hexToHsv(color || '#FFFFFF'));
    const [isDraggingWheel, setIsDraggingWheel] = useState(false);
    const [isDraggingValue, setIsDraggingValue] = useState(false);

    const wheelRef = useRef<HTMLDivElement>(null);
    const valueRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const newHsv = hexToHsv(color || '#FFFFFF');
        if (hsvToHex(hsv.h, hsv.s, hsv.v) !== color.toUpperCase()) {
            setHsv(newHsv);
        }
    }, [color]);

    const handleWheelMove = useCallback((e: PointerEvent | React.PointerEvent) => {
        if (!wheelRef.current) return;
        const rect = wheelRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const x = e.clientX - rect.left - centerX;
        const y = e.clientY - rect.top - centerY;

        let hue = Math.atan2(y, x) * (180 / Math.PI) + 90;
        if (hue < 0) hue += 360;

        const dist = Math.sqrt(x * x + y * y);
        const saturation = Math.min(100, (dist / centerX) * 100);

        const newHsv = { ...hsv, h: hue, s: saturation };
        setHsv(newHsv);
        onChange(hsvToHex(newHsv.h, newHsv.s, newHsv.v));
    }, [hsv, onChange]);

    const handleValueMove = useCallback((e: PointerEvent | React.PointerEvent) => {
        if (!valueRef.current) return;
        const rect = valueRef.current.getBoundingClientRect();
        const value = Math.max(0, Math.min(100, (1 - (e.clientY - rect.top) / rect.height) * 100));

        const newHsv = { ...hsv, v: value };
        setHsv(newHsv);
        onChange(hsvToHex(newHsv.h, newHsv.s, newHsv.v));
    }, [hsv, onChange]);

    useEffect(() => {
        if (!isDraggingWheel) return;
        const onMove = (e: PointerEvent) => handleWheelMove(e);
        const onUp = () => setIsDraggingWheel(false);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [isDraggingWheel, handleWheelMove]);

    useEffect(() => {
        if (!isDraggingValue) return;
        const onMove = (e: PointerEvent) => handleValueMove(e);
        const onUp = () => setIsDraggingValue(false);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [isDraggingValue, handleValueMove]);

    const PRESET_UI_COLORS = [
        '#FFFFFF', '#A8A29E', '#44403C', '#000000',
        '#F87171', '#FB923C', '#FBBF24', '#34D399',
        '#60A5FA', '#818CF8'
    ];

    return (
        <div className="bg-stone-900/40 rounded-xl p-3 border border-white/5 shadow-inner space-y-4">
            <div className="flex gap-4">
                {/* Color Wheel (Hue + Saturation) */}
                <div
                    ref={wheelRef}
                    className="relative w-28 h-28 rounded-full cursor-crosshair select-none touch-none group ring-1 ring-white/10"
                    style={{
                        background: 'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                    }}
                    onPointerDown={(e) => {
                        setIsDraggingWheel(true);
                        handleWheelMove(e);
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                >
                    <div className="absolute inset-0 rounded-full bg-radial-at-center from-white to-transparent opacity-100" />
                    <div
                        className="absolute w-3.5 h-3.5 border-2 border-white rounded-full shadow-lg -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-[left,top] duration-75"
                        style={{
                            left: `${50 + (hsv.s / 2) * Math.cos((hsv.h - 90) * (Math.PI / 180))}%`,
                            top: `${50 + (hsv.s / 2) * Math.sin((hsv.h - 90) * (Math.PI / 180))}%`,
                        }}
                    />
                </div>

                {/* Value/Brightness Slider */}
                <div
                    ref={valueRef}
                    className="relative w-5 h-28 rounded-full cursor-pointer select-none touch-none overflow-hidden ring-1 ring-white/10"
                    style={{
                        background: `linear-gradient(to top, #000, ${hsvToHex(hsv.h, hsv.s, 100)})`,
                    }}
                    onPointerDown={(e) => {
                        setIsDraggingValue(true);
                        handleValueMove(e);
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                >
                    <div
                        className="absolute left-0 right-0 h-1.5 bg-white border border-black/20 shadow-md -translate-y-1/2 pointer-events-none transition-[top] duration-75"
                        style={{ top: `${100 - hsv.v}%` }}
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                <input
                    type="text"
                    value={color.toUpperCase()}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (/^#[0-9A-F]{0,6}$/i.test(val)) onChange(val);
                    }}
                    className="flex-1 bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-[10px] font-mono text-stone-300 focus:outline-none focus:border-accent/40 text-center"
                    placeholder="#FFF"
                />
                <div className="w-8 h-8 rounded-lg border border-white/10 shadow-inner" style={{ backgroundColor: color }} />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
                {PRESET_UI_COLORS.map(p => (
                    <button
                        key={p}
                        onClick={() => onChange(p)}
                        className={cn(
                            "w-5 h-5 rounded-full border border-white/10 transition-all hover:scale-125 hover:shadow-lg",
                            color.toUpperCase() === p && "ring-2 ring-accent ring-offset-2 ring-offset-stone-900"
                        )}
                        style={{ backgroundColor: p }}
                    />
                ))}
            </div>
        </div>
    );
};
