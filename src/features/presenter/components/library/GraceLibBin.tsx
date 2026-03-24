import React from 'react';
import { LucideIcon, ChevronRight } from 'lucide-react';
import { cn } from '@/core/utils/cn';

interface GraceLibBinProps {
    id: string;
    name: string;
    icon: LucideIcon;
    count?: number;
    isActive?: boolean;
    onClick: () => void;
    className?: string;
    description?: string;
    onContextMenu?: (e: React.MouseEvent) => void;
}

export const GraceLibBin: React.FC<GraceLibBinProps> = ({
    name,
    icon: Icon,
    count,
    isActive,
    onClick,
    className,
    description,
    onContextMenu
}) => {
    return (
        <button
            onClick={onClick}
            onContextMenu={onContextMenu}
            className={cn(
                "w-full flex items-center gap-3 p-3 rounded-2xl border transition-all group active:scale-[0.98] shadow-lg shadow-black/10",
                isActive
                    ? "bg-accent/10 border-accent/40"
                    : "bg-stone-900/40 border-white/5 hover:border-accent/40 hover:bg-stone-800/60",
                className
            )}
        >
            <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 group-hover:scale-110 transition-transform",
                isActive ? "bg-accent/20 border-accent/20" : "bg-stone-800/50 border-white/5"
            )}>
                <Icon className={cn("w-5 h-5", isActive ? "text-accent" : "text-stone-400 group-hover:text-accent transition-colors")} />
            </div>
            <div className="flex flex-col text-left min-w-0 flex-1">
                <span className={cn(
                    "text-xs font-bold truncate uppercase tracking-tight transition-colors",
                    isActive ? "text-accent" : "text-stone-200"
                )}>
                    {name}
                </span>
                {description && (
                    <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest truncate">
                        {description}
                    </span>
                )}
            </div>
            {count !== undefined && (
                <div className="px-2 py-0.5 rounded-full bg-white/5 border border-white/5 shrink-0">
                    <span className="text-[10px] font-bold text-stone-500 group-hover:text-stone-300">{count}</span>
                </div>
            )}
            {isActive && (
                <ChevronRight className="w-3.5 h-3.5 text-accent animate-pulse" />
            )}
        </button>
    );
};
