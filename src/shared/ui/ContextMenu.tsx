import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/core/utils/cn';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    children: React.ReactNode;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, children }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = React.useState({ top: y, left: x });
    const [isVisible, setIsVisible] = React.useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        // Slight delay to avoid immediate close from the triggering click
        setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    React.useLayoutEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            const margin = 16;

            let left = x;
            let top = y;

            // Adjust horizontal
            if (left + rect.width > screenWidth - margin) {
                left = Math.max(margin, screenWidth - rect.width - margin);
            } else if (left < margin) {
                left = margin;
            }

            // Adjust vertical
            if (top + rect.height > screenHeight - margin) {
                top = Math.max(margin, screenHeight - rect.height - margin);
            } else if (top < margin) {
                top = margin;
            }

            setPos({ top, left });
            setIsVisible(true);
        }
    }, [x, y]);

    return createPortal(
        <div
            ref={menuRef}
            className={cn(
                "fixed z-100 min-w-[200px] bg-stone-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl py-2 overflow-hidden transition-opacity duration-200",
                isVisible ? "opacity-100" : "opacity-0",
                "animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200"
            )}
            style={{ top: pos.top, left: pos.left }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none" />
            <div className="relative z-10">
                {children}
            </div>
        </div>,
        document.body
    );
};

export const ContextMenuItem: React.FC<{
    icon?: React.ReactNode;
    label: string;
    onClick: () => void;
    shortcut?: string;
    danger?: boolean;
    disabled?: boolean;
}> = ({ icon, label, onClick, shortcut, danger, disabled }) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onClick();
        }}
        disabled={disabled}
        className={cn(
            "group w-full text-left px-4 py-2.5 text-xs font-bold transition-all duration-200 flex items-center gap-3 relative overflow-hidden",
            disabled
                ? "opacity-40 cursor-not-allowed text-stone-500"
                : danger
                    ? "text-red-400 hover:bg-red-500/10 hover:text-red-300 pointer-events-auto"
                    : "text-stone-300 hover:bg-accent/10 hover:text-accent pointer-events-auto"
        )}
    >
        {/* Hover Indicator */}
        {!danger && !disabled && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-accent rounded-r-full scale-y-0 group-hover:scale-y-100 transition-transform duration-200" />
        )}

        {icon && (
            <span className={cn(
                "w-4 h-4 transition-transform duration-200",
                !disabled && "group-hover:scale-110",
                disabled ? "text-stone-600" : danger ? "text-red-400 opacity-80" : "text-stone-500 group-hover:text-accent"
            )}>
                {icon}
            </span>
        )}
        <span className="flex-1 tracking-wide">{label}</span>
        {shortcut && (
            <span className={cn(
                "text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md transition-colors",
                disabled
                    ? "text-stone-700 bg-white/2"
                    : "text-stone-600 bg-white/5 group-hover:bg-accent/20 group-hover:text-accent"
            )}>
                {shortcut}
            </span>
        )}
    </button>
);

export default ContextMenu;
