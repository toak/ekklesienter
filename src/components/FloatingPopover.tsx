import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { GripHorizontal, X } from 'lucide-react';
import { cn } from '@/core/utils/cn';

interface FloatingPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRef: React.RefObject<HTMLElement | null>;
    title?: string;
    children: React.ReactNode;
    width?: number;
}

export const FloatingPopover: React.FC<FloatingPopoverProps> = ({
    isOpen,
    onClose,
    anchorRef,
    title,
    children,
    width = 300
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });
    const [isInitialized, setIsInitialized] = useState(false);

    // Initial positioning - use layout effect to calculate before paint
    useLayoutEffect(() => {
        if (isOpen && anchorRef.current && !isInitialized) {
            const anchorRect = anchorRef.current.getBoundingClientRect();
            // Try to position to the left of the anchor, with some gap
            let newX = anchorRect.left - width - 16;
            let newY = anchorRect.top;

            // Constrain to screen bounds
            if (newX < 16) newX = 16;
            if (newY < 16) newY = 16;
            if (newY + 400 > window.innerHeight) newY = Math.max(16, window.innerHeight - 450);

            setPosition({ x: newX, y: newY });
            setIsInitialized(true);
        }
    }, [isOpen, anchorRef, width, isInitialized]);

    // Reset init when closed
    useEffect(() => {
        if (!isOpen) setIsInitialized(false);
    }, [isOpen]);

    // Click outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target as Node) &&
                anchorRef.current &&
                !anchorRef.current.contains(e.target as Node)
            ) {
                // To support nested popovers, we shouldn't close if a click is within another popover
                const targetNode = e.target as HTMLElement;
                if (targetNode.closest('.floating-popover')) {
                    // It's clicking another floating-popover (likely nested)
                    return;
                }
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, anchorRef]);

    // Dragging logic
    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            panelX: position.x,
            panelY: position.y
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;

        let newX = dragStartRef.current.panelX + dx;
        let newY = dragStartRef.current.panelY + dy;

        // Bound validation
        if (anchorRef.current) {
            const anchorRect = anchorRef.current.getBoundingClientRect();
            // Don't overlap the anchor's left edge
            if (newX + width > anchorRect.left - 8) {
                newX = anchorRect.left - width - 8;
            }
        }

        // Screen bounds
        if (newX < 16) newX = 16;
        if (newY < 16) newY = 16;
        if (popoverRef.current) {
            const rect = popoverRef.current.getBoundingClientRect();
            if (newY + rect.height > window.innerHeight - 16) {
                newY = window.innerHeight - rect.height - 16;
            }
        }

        setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            ref={popoverRef}
            className={cn(
                "floating-popover fixed z-9999 flex flex-col bg-stone-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-opacity duration-75",
                isInitialized ? "opacity-100 animate-in fade-in zoom-in-95 duration-200" : "opacity-0 pointer-events-none"
            )}
            style={{
                left: position.x,
                top: position.y,
                width: width,
            }}
        >
            {/* Drag Handle / Header */}
            <div
                className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5 cursor-move"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <div className="flex items-center gap-2 text-stone-400 pointer-events-none select-none">
                    <GripHorizontal className="w-4 h-4" />
                    {title && <span className="text-[10px] font-bold uppercase tracking-widest">{title}</span>}
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="p-1 hover:bg-white/10 rounded-lg text-stone-400 hover:text-white transition-colors cursor-pointer"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[80vh] overflow-y-auto no-scrollbar">
                {children}
            </div>
        </div>,
        document.body
    );
};
