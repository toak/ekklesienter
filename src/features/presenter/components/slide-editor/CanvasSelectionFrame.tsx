import React from 'react';
import { cn } from '@/core/utils/cn';

interface CanvasSelectionFrameProps {
    isSelected: boolean;
    isEditing: boolean;
}

export const CanvasSelectionFrame: React.FC<CanvasSelectionFrameProps> = ({ isSelected, isEditing }) => {
    if (!isSelected || isEditing) return null;
    
    return (
        <div className="absolute inset-0 border-[1.5px] border-accent pointer-events-none z-40" />
    );
};
