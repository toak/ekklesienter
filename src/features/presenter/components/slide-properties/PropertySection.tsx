import React, { useState } from 'react';
import {
    ChevronDown,
    AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd,
    AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
} from 'lucide-react';
import { cn } from '@/core/utils/cn';

// ─── Alignment Tools ───────────────────────────────────────────────────
interface IAlignmentToolsProps {
    onAlign: (type: 'left' | 'h-center' | 'right' | 'top' | 'v-middle' | 'bottom') => void;
}

export const AlignmentTools: React.FC<IAlignmentToolsProps> = ({ onAlign }) => {
    const tools = [
        { type: 'left' as const, icon: AlignHorizontalJustifyStart, label: 'Left' },
        { type: 'h-center' as const, icon: AlignHorizontalJustifyCenter, label: 'H-Center' },
        { type: 'right' as const, icon: AlignHorizontalJustifyEnd, label: 'H-Right' },
        { type: 'top' as const, icon: AlignVerticalJustifyStart, label: 'Top' },
        { type: 'v-middle' as const, icon: AlignVerticalJustifyCenter, label: 'V-Middle' },
        { type: 'bottom' as const, icon: AlignVerticalJustifyEnd, label: 'Bottom' },
    ];

    return (
        <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
            {tools.map(({ type, icon: Icon, label }) => (
                <button
                    key={type}
                    onClick={() => onAlign(type)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="flex-1 py-1.5 flex items-center justify-center rounded-lg hover:bg-white/5 text-stone-500 hover:text-stone-200 transition-all cursor-pointer group"
                    title={`Align ${label} `}
                >
                    <Icon className="w-3.5 h-3.5" />
                </button>
            ))}
        </div>
    );
};

// ─── Property Section (Accordion) ──────────────────────────────────────
interface IPropertySectionProps {
    title?: string;
    label?: string;
    icon: React.ElementType;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

export const PropertySection: React.FC<IPropertySectionProps> = ({ title, label, icon: Icon, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const displayTitle = title || label || '';

    return (
        <div className="bg-black/40 rounded-2xl border border-white/5 overflow-hidden transition-colors hover:border-white/10 shadow-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                onMouseDown={(e) => e.preventDefault()}
                className="w-full flex items-center justify-between px-3 py-2.5 text-stone-500 hover:text-stone-300 transition-colors cursor-pointer group"
            >
                <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-stone-400 group-hover:text-accent transition-colors" />
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] opacity-80">{displayTitle}</span>
                </div>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isOpen ? "" : "-rotate-90 opacity-40")} />
            </button>
            <div className={cn(
                "px-3 pb-3 transition-all duration-300 origin-top overflow-hidden",
                isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
            )}>
                <div className="pt-1 space-y-3">
                    {children}
                </div>
            </div>
        </div>
    );
};
