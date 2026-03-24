import React from 'react';
import { cn } from '@/core/utils/cn';

interface CanvasSelectionFrameProps {
    isSelected: boolean;
    isEditing: boolean;
}

export const CanvasSelectionFrame: React.FC<CanvasSelectionFrameProps> = ({ isSelected, isEditing }) => {
    if (!isSelected || isEditing) return null;
    
    return (
        <div className="absolute inset-0 ring-[1.5px] ring-accent ring-offset-0 pointer-events-none z-40" />
    );
};
