import React from 'react';
import { toast as sonnerToast } from 'sonner';
import { Check, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from './cn';

interface ToastProps {
    title: string;
    description?: string;
    type: 'success' | 'error' | 'info' | 'warning';
    toastId?: string | number;
}

const PremiumToast = ({ title, description, type, toastId }: ToastProps) => {
    const icons = {
        success: <Check className="w-5 h-5 text-accent" />,
        error: <AlertCircle className="w-5 h-5 text-red-400" />,
        info: <Info className="w-5 h-5 text-blue-400" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    };

    return (
        <div className={cn(
            "group relative flex items-center gap-3 p-4 min-w-[320px] max-w-[420px]",
            "bg-stone-900/40 backdrop-blur-2xl rounded-3xl border border-white/5 shadow-2xl overflow-hidden",
            "animate-in fade-in slide-in-from-top-4 duration-500",
            "after:absolute after:inset-px after:rounded-[inherit] after:bg-linear-to-b after:from-white/8 after:to-transparent after:pointer-events-none"
        )}>
            {/* Theme-colored glow effect */}
            <div className={cn(
                "absolute -left-12 -top-12 w-24 h-24 blur-2xl opacity-20 transition-colors duration-500 rounded-full pointer-events-none",
                type === 'success' && "bg-accent",
                type === 'error' && "bg-red-500",
                type === 'info' && "bg-blue-500",
                type === 'warning' && "bg-amber-500"
            )} />

            {/* Icon Container */}
            <div className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-2xl shrink-0 border transition-all duration-500",
                type === 'success' && "bg-accent/10 border-accent/20 shadow-[0_0_20px_rgba(var(--accent),0.1)]",
                type === 'error' && "bg-red-500/10 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]",
                type === 'info' && "bg-blue-500/10 border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]",
                type === 'warning' && "bg-amber-500/10 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
            )}>
                {icons[type]}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-1">
                <h3 className="text-sm font-bold text-white tracking-tight leading-tight">
                    {title}
                </h3>
                {description && (
                    <p className="text-[11px] text-stone-400 leading-relaxed font-medium">
                        {description}
                    </p>
                )}
            </div>

            {/* Close Button - subtle */}
            <button
                onClick={() => {
                    if (toastId !== undefined) {
                        sonnerToast.dismiss(toastId);
                    } else {
                        sonnerToast.dismiss();
                    }
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/5 rounded-lg text-stone-600 hover:text-stone-300 absolute top-3 right-3"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};

export const toast = {
    success: (title: string, description?: string) => {
        sonnerToast.custom((t) => (
            <PremiumToast title={title} description={description} type="success" toastId={t} />
        ));
    },
    error: (title: string, description?: string) => {
        sonnerToast.custom((t) => (
            <PremiumToast title={title} description={description} type="error" toastId={t} />
        ));
    },
    info: (title: string, description?: string) => {
        sonnerToast.custom((t) => (
            <PremiumToast title={title} description={description} type="info" toastId={t} />
        ));
    },
    warning: (title: string, description?: string) => {
        sonnerToast.custom((t) => (
            <PremiumToast title={title} description={description} type="warning" toastId={t} />
        ));
    },
    promise: <T,>(
        promise: Promise<T>,
        { loading, success, error }: {
            loading: string;
            success: (data: T) => string;
            error: (err: any) => string;
        }
    ) => {
        return sonnerToast.promise(promise, {
            loading: loading,
            success: (data: T) => {
                const title = success(data);
                return <PremiumToast title={title} type="success" />;
            },
            error: (err: any) => {
                const title = error(err);
                return <PremiumToast title={title} type="error" />;
            },
        });
    }
};
