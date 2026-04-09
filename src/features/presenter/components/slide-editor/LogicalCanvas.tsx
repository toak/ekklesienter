import React, { useEffect, useRef, useState } from 'react';
import { useDisplayStore } from '@/core/store/displayStore';
import { cn } from '@/core/utils/cn';

interface LogicalCanvasProps {
    children: React.ReactNode;
    className?: string;
    containerClassName?: string;
    logicalWidth?: number;
    aspectRatioOverride?: number;
    autoFill?: boolean;
    style?: React.CSSProperties;
    zoom?: number;
    offset?: { x: number, y: number };
    viewportPadding?: { top: number; bottom: number; left: number; right: number };
}

/**
 * LogicalCanvas provides a resolution-independent 16:9 (or custom ratio) canvas
 * that automatically scales to fit its container using high-performance DOM updates.
 */
export const LogicalCanvas: React.FC<LogicalCanvasProps> = ({
    children,
    className,
    containerClassName,
    style,
    logicalWidth = 1920,
    aspectRatioOverride,
    autoFill = false,
    zoom = 1.0,
    offset = { x: 0, y: 0 },
    viewportPadding = { top: 0, bottom: 0, left: 0, right: 0 },
}) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const boundingBoxRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    
    // We still keep scale state for initial render and for some edge-case React sub-components
    const [scale, setScale] = useState(1);
    const [containerRatio, setContainerRatio] = useState<number | null>(null);

    const { aspectRatio, initElectronListener } = useDisplayStore();

    // Ratio logic
    const safeRatio = aspectRatioOverride || (autoFill ? containerRatio : null) || (aspectRatio && aspectRatio > 0 ? aspectRatio : 16 / 9);
    const logicalHeight = logicalWidth / safeRatio;

    // Initialize Electron listener on mount
    useEffect(() => {
        const result = initElectronListener();
        const unsub = typeof result === 'function' ? result : undefined;
        return () => {
            if (unsub) unsub();
        };
    }, [initElectronListener]);

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                if (width === 0 || height === 0) continue;

                const safeW = Math.max(0, width - (viewportPadding.left + viewportPadding.right));
                const safeH = Math.max(0, height - (viewportPadding.top + viewportPadding.bottom));

                const targetScaleX = safeW / logicalWidth;
                const targetScaleY = safeH / logicalHeight;
                const newScale = Math.min(targetScaleX, targetScaleY);
                
                // 🚀 PERFORMANCE: Update DOM directly during animation to avoid React render lag
                if (boundingBoxRef.current) {
                    boundingBoxRef.current.style.width = `${logicalWidth * newScale}px`;
                    boundingBoxRef.current.style.height = `${logicalHeight * newScale}px`;
                }
                if (innerRef.current) {
                    innerRef.current.style.transform = `translate(-50%, -50%) scale(${newScale})`;
                }

                // Batch the state update to avoid frame drop
                setScale(newScale);

                if (!aspectRatioOverride) {
                    setContainerRatio(safeW / safeH);
                }
            }
        });

        observer.observe(wrapper);
        return () => observer.disconnect();
    }, [logicalWidth, logicalHeight, aspectRatioOverride, viewportPadding]);

    // Multiplier for final scale: if zoom is 1.0, it fits to container (adaptive). 
    // If zoom is != 1.0, it uses that scale at the moment of zoom-start * zoom.
    const lastFitScale = useRef(scale);
    useEffect(() => {
        if (zoom === 1.0) {
            lastFitScale.current = scale;
        }
    }, [scale, zoom]);

    const effectiveScale = zoom === 1.0 ? scale : lastFitScale.current * zoom;
    
    // Calculate base offset to center the slide in the safe area
    const safeOffsetX = (viewportPadding.left - viewportPadding.right) / 2;
    const safeOffsetY = (viewportPadding.top - viewportPadding.bottom) / 2;

    const effectiveOffset = zoom === 1.0 
        ? { x: safeOffsetX, y: safeOffsetY } 
        : { x: offset.x + safeOffsetX, y: offset.y + safeOffsetY };

    return (
        <div
            ref={wrapperRef}
            className="w-full h-full flex items-center justify-center overflow-hidden"
        >
            <div
                ref={boundingBoxRef}
                className={cn(
                    "relative overflow-hidden shrink-0",
                    zoom === 1.0 && "transition-all duration-300 ease-in-out", // Only animate in adaptive mode
                    containerClassName
                )}
                style={{
                    width: `${logicalWidth * effectiveScale}px`,
                    height: `${logicalHeight * effectiveScale}px`,
                    transform: `translate(${effectiveOffset.x}px, ${effectiveOffset.y}px)`,
                    ...style
                }}
            >
                {/* СЛОЙ 3: Логический холст */}
                <div
                    ref={innerRef}
                    className={cn(
                        "absolute top-1/2 left-1/2 origin-center",
                        zoom === 1.0 && "transition-transform duration-300 ease-in-out", // Only animate in adaptive mode
                        className
                    )}
                    style={{
                        width: `${logicalWidth}px`,
                        height: `${logicalHeight}px`,
                        transform: `translate(-50%, -50%) scale(${effectiveScale})`,
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
};

export default LogicalCanvas;
