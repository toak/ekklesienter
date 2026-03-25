import React, { useState } from 'react';
import { Image as ImageIcon, Trash2, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ILogo, ILogoGroup } from '@/core/types';
import { useLogoUrl } from '@/core/hooks/useLogoUrl';
import { MoveDropdown } from './MoveDropdown';

export interface LogoCardProps {
    logo: ILogo;
    isActive: boolean;
    onSelect: () => void;
    onRemove?: () => void;
    allGroups: ILogoGroup[];
    onMove: (logoId: string, targetGroupId: string | null) => void;
}

export const LogoCard: React.FC<LogoCardProps> = ({ logo, isActive, onSelect, onRemove, allGroups, onMove }) => {
    const [showMove, setShowMove] = useState(false);
    const [imgError, setImgError] = useState(false);
    const displayUrl = useLogoUrl(logo);

    return (
        <div
            className={cn(
                "group relative aspect-square bg-stone-900/80 border overflow-hidden transition-all duration-300 rounded-3xl cursor-pointer",
                isActive ? "border-accent ring-4 ring-accent/10 shadow-lg shadow-accent/5" : "border-white/5 hover:border-white/20"
            )}
            onClick={onSelect}
        >
            {imgError ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
                    <ImageIcon className="w-8 h-8 text-stone-700" />
                    <span className="text-[9px] text-stone-600 font-medium text-center leading-tight">
                        {logo.name}
                    </span>
                </div>
            ) : (
                <img
                    src={displayUrl}
                    alt={logo.name}
                    className="w-full h-full object-contain p-5"
                    onError={() => setImgError(true)}
                />
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                <span className="text-[10px] text-white font-bold text-center line-clamp-2">{logo.name}</span>
                <div className="flex items-center gap-1.5">
                    {!logo.isPreloaded && allGroups.length > 0 && (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setShowMove(!showMove); }}
                                className="p-1.5 bg-stone-800/80 hover:bg-accent/30 text-stone-400 hover:text-accent rounded-lg transition-colors border border-white/10 cursor-pointer"
                                aria-label="Move to group"
                            >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                            {showMove && (
                                <MoveDropdown
                                    groups={allGroups}
                                    currentGroupId={logo.groupId}
                                    onMove={(targetId) => onMove(logo.id, targetId)}
                                    onClose={() => setShowMove(false)}
                                />
                            )}
                        </div>
                    )}
                    {onRemove && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onRemove(); }}
                            className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded-lg transition-colors border border-red-500/20 cursor-pointer"
                            aria-label="Remove logo"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Active check */}
            {isActive && (
                <div className="absolute top-3 right-3 p-1.5 bg-accent text-accent-foreground rounded-full shadow-lg">
                    <CheckCircle2 className="w-4 h-4" />
                </div>
            )}
        </div>
    );
};
