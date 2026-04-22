import React from 'react';
import { cn } from '@/core/utils/cn';
import { Volume2 } from 'lucide-react';
import { IAudioScope } from '@/core/types';
import { gainToDb } from '@/core/utils/audioUtils';

interface AudioVolumeBadgeProps {
    scope: IAudioScope;
    isEditingVolume: boolean;
    volumeInputValue: string;
    onVolumeBadgeDown: (e: React.PointerEvent) => void;
    onToggleMute: (e: React.MouseEvent) => void;
    onVolumeClick: (e: React.MouseEvent) => void;
    onVolumeInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onVolumeBlur: () => void;
    onVolumeKeyDown: (e: React.KeyboardEvent) => void;
}

export const AudioVolumeBadge: React.FC<AudioVolumeBadgeProps> = ({
    scope, isEditingVolume, volumeInputValue,
    onVolumeBadgeDown, onToggleMute, onVolumeClick,
    onVolumeInputChange, onVolumeBlur, onVolumeKeyDown
}) => {
    return (
        <div
            onPointerDown={onVolumeBadgeDown}
            className={cn(
                "bg-stone-900/60 h-7 px-2 rounded-lg border border-white/5 backdrop-blur-xl shadow-lg flex items-center gap-2 cursor-ew-resize transition-all hover:bg-stone-800/80 hover:border-white/10 select-none group/vol",
                isEditingVolume && "ring-2 ring-purple-500/50"
            )}
        >
            <button
                onClick={onToggleMute}
                className={cn(
                    "transition-colors cursor-pointer",
                    scope.isMuted ? "text-red-400" : "text-purple-300 hover:text-white"
                )}
            >
                <Volume2 className="w-3 h-3" />
            </button>

            {isEditingVolume ? (
                <input
                    autoFocus
                    value={volumeInputValue}
                    onChange={onVolumeInputChange}
                    onBlur={onVolumeBlur}
                    onKeyDown={onVolumeKeyDown}
                    className="w-10 bg-transparent text-[10px] font-black text-white outline-none text-center"
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <span
                    onClick={onVolumeClick}
                    className={cn(
                        "text-[10px] font-black tracking-tighter transition-colors cursor-text hover:text-white",
                        scope.isMuted ? "text-red-400/50" : "text-purple-100"
                    )}
                >
                    {gainToDb(scope.volume)}
                </span>
            )}
        </div>
    );
};

interface AudioFadeHandlesProps {
    onFadeInDown: (e: React.PointerEvent) => void;
    onFadeOutDown: (e: React.PointerEvent) => void;
    onLeftHandleDown: (e: React.PointerEvent) => void;
    onRightHandleDown: (e: React.PointerEvent) => void;
    fadeInActive: boolean;
    fadeOutActive: boolean;
    fadeInTitle: string;
    fadeOutTitle: string;
}

export const AudioFadeHandles: React.FC<AudioFadeHandlesProps> = ({
    onFadeInDown, onFadeOutDown, onLeftHandleDown, onRightHandleDown,
    fadeInActive, fadeOutActive, fadeInTitle, fadeOutTitle
}) => {
    return (
        <div className="absolute inset-0 pointer-events-none z-10">
            {/* Left Side */}
            <div className="absolute left-0 top-0 w-8 h-full">
                <button
                    onPointerDown={onFadeInDown}
                    className={cn(
                        "absolute top-0 left-0 w-8 h-8 transition-all flex items-start justify-start p-1 rounded-br-lg pointer-events-auto cursor-pointer",
                        fadeInActive ? "text-amber-500 hover:text-amber-400" : "text-purple-300/40 hover:text-purple-100"
                    )}
                    title={fadeInTitle}
                >
                    <div className={cn("w-2.5 h-2.5 border-t-2 border-l-2", fadeInActive ? "border-amber-500" : "border-current")} />
                </button>
                <div onPointerDown={onLeftHandleDown} className="absolute left-0 top-6 bottom-0 w-3 cursor-ew-resize flex items-center justify-center hover:bg-purple-500/30 transition-colors touch-none pointer-events-auto group/handle-l">
                    <div className="w-1 h-6 bg-purple-400/50 group-hover/handle-l:bg-purple-400 rounded-full shadow-sm transition-colors" />
                </div>
            </div>

            {/* Right Side */}
            <div className="absolute right-0 top-0 w-8 h-full">
                <button
                    onPointerDown={onFadeOutDown}
                    className={cn(
                        "absolute top-0 right-0 w-8 h-8 transition-all flex items-start justify-end p-1 rounded-bl-lg pointer-events-auto cursor-pointer",
                        fadeOutActive ? "text-amber-500 hover:text-amber-400" : "text-purple-300/40 hover:text-purple-100"
                    )}
                    title={fadeOutTitle}
                >
                    <div className={cn("w-2.5 h-2.5 border-t-2 border-r-2", fadeOutActive ? "border-amber-500" : "border-current")} />
                </button>
                <div onPointerDown={onRightHandleDown} className="absolute right-0 top-6 bottom-0 w-3 cursor-ew-resize flex items-center justify-center hover:bg-purple-500/30 transition-colors touch-none pointer-events-auto group/handle-r">
                    <div className="w-1 h-6 bg-purple-400/50 group-hover/handle-r:bg-purple-400 rounded-full shadow-sm transition-colors" />
                </div>
            </div>
        </div>
    );
};
