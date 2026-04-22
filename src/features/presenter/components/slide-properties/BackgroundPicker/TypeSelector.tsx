import React from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, Image as ImageIcon, Video, Layers, Hash } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { IStyleLayer } from '@/core/types';

interface TypeSelectorProps {
    activeLayer: IStyleLayer | undefined;
    onTypeChange: (type: IStyleLayer['type']) => void;
}

export const TypeSelector: React.FC<TypeSelectorProps> = ({ activeLayer, onTypeChange }) => {
    const { t } = useTranslation();

    const types = [
        { id: 'color', icon: Palette, label: t('bg_solid_short', 'Solid') },
        { id: 'gradient', icon: Layers, label: t('bg_gradient_short', 'Grad') },
        { id: 'image', icon: ImageIcon, label: t('bg_photo_short', 'Photo') },
        { id: 'video', icon: Video, label: t('bg_motion_short', 'Motion') },

    ];

    return (
        <div className="grid grid-cols-4 gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
            {types.map(type => (
                <button
                    key={type.id}
                    onClick={() => onTypeChange(type.id as any)}
                    className={cn(
                        "flex flex-col items-center gap-1.5 py-2.5 rounded-lg transition-all active:scale-95",
                        activeLayer?.type === type.id 
                            ? "bg-white/5 text-accent shadow-lg ring-1 ring-white/10" 
                            : "text-stone-600 hover:bg-white/5 hover:text-stone-400"
                    )}
                    title={type.label}
                >
                    <type.icon className="w-4 h-4" />
                    <span className="text-[7px] font-black uppercase tracking-tighter opacity-50">{type.label}</span>
                </button>
            ))}
        </div>
    );
};
