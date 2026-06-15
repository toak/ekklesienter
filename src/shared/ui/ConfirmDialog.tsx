import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { cn } from '@/core/utils/cn';

interface ConfirmDialogProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    children?: React.ReactNode;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onConfirm,
    onCancel,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    children,
}) => {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel();
                return;
            }
            if (e.key === 'Enter') {
                const target = e.target as HTMLElement;
                const isInput = target && (
                    target.tagName === 'INPUT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.isContentEditable
                );
                if (isInput) return;
                onConfirm();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onCancel, onConfirm]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-10010 flex items-center justify-center bg-black/60 backdrop-blur-lg animate-in fade-in duration-200"
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div
                ref={panelRef}
                className={cn(
                    "relative w-full max-w-sm rounded-[24px] border shadow-2xl overflow-hidden",
                    "animate-in zoom-in-95 slide-in-from-bottom-4 duration-300",
                    danger
                        ? "bg-stone-900 border-red-500/20"
                        : "bg-stone-900 border-white/10"
                )}
            >
                {/* Glow effect */}
                <div className={cn(
                    "absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-32 rounded-full blur-3xl opacity-15 pointer-events-none",
                    danger ? "bg-red-500" : "bg-accent"
                )} />

                {/* Glass inner highlight */}
                <div className="absolute inset-px rounded-[inherit] bg-linear-to-b from-white/5 to-transparent pointer-events-none" />

                <div className="relative z-10 p-6">
                    {/* Icon + Title */}
                    <div className="flex items-start gap-4 mb-4">
                        <div className={cn(
                            "flex items-center justify-center w-11 h-11 rounded-2xl shrink-0 border",
                            danger
                                ? "bg-red-500/10 border-red-500/20"
                                : "bg-accent/10 border-accent/20"
                        )}>
                            {danger
                                ? <Trash2 className="w-5 h-5 text-red-400" />
                                : <AlertTriangle className="w-5 h-5 text-accent" />
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-black text-white uppercase tracking-wide leading-tight">
                                {title}
                            </h3>
                            {description && (
                                <p className="text-[11px] text-stone-400 mt-1.5 leading-relaxed font-medium">
                                    {description}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="p-1.5 rounded-xl hover:bg-white/5 text-stone-600 hover:text-stone-300 transition-colors shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Optional children slot (e.g. template picker, block selector) */}
                    {children && (
                        <div className="mb-5 pl-[60px]">
                            {children}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pl-[60px]">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-stone-400 hover:text-stone-200 font-bold uppercase text-[10px] tracking-wider transition-all border border-white/5"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            className={cn(
                                "flex-1 px-4 py-2.5 rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all border",
                                danger
                                    ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 border-red-500/20 hover:border-red-500/30"
                                    : "bg-accent/90 hover:bg-accent text-stone-900 border-accent/20"
                            )}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConfirmDialog;
