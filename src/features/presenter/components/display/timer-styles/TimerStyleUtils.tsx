import React from 'react';
import { IStyleLayer } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { SlideBackground } from '../SlideBackground';

export const getFillColor = (fill?: IStyleLayer[], fallback: string = '#ffffff'): string => {
    if (!fill || fill.length === 0) return fallback;
    const firstLayer = fill.find(l => l.visible);
    if (!firstLayer) return fallback;
    if (firstLayer.type === 'color') return firstLayer.color || fallback;
    if (firstLayer.type === 'gradient') return firstLayer.gradient?.from || fallback;
    return fallback;
};

interface TimerFillProps {
    fill?: IStyleLayer[];
    className?: string;
    children?: React.ReactNode;
    style?: React.CSSProperties;
}

export const TimerFill: React.FC<TimerFillProps> = ({ fill, className, children, style }) => {
    if (!fill || fill.length === 0) return <div className={className} style={style}>{children}</div>;
    return (
        <div className={cn("relative overflow-hidden", className)} style={style}>
            <SlideBackground background={fill} />
            <div className="relative z-10 w-full h-full flex items-center justify-center">
                {children}
            </div>
        </div>
    );
};
