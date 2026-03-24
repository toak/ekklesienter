import React, { useEffect, useRef, useState } from 'react';
import { useDisplayStore } from '@/core/store/displayStore';
import { cn } from '@/core/utils/cn';

interface LogicalCanvasProps {
    children: React.ReactNode;
    className?: string;
    containerClassName?: string;
    logicalWidth?: number;
    aspectRatioOverride?: number; // ДОБАВЛЕНО: для форсирования 16:9 в презентациях
    autoFill?: boolean; // ДОБАВЛЕНО: разрешить заполнение всего контейнера (для проектора)
    style?: React.CSSProperties;
}

export const LogicalCanvas: React.FC<LogicalCanvasProps> = ({
    children,
    className,
    containerClassName,
    style,
    logicalWidth = 1920,
    aspectRatioOverride,
    autoFill = false,
}) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [containerRatio, setContainerRatio] = useState<number | null>(null);

    const { aspectRatio, initElectronListener } = useDisplayStore();

    // МАГИЯ АДАПТАЦИИ:
    // МАГИЯ АДАПТАЦИИ:
    // 1. Если передан override (режим презентации), жестко используем его (например, 16:9).
    // 2. Если включен autoFill (режим проектора), используем замер реального окна.
    // 3. Иначе (режим превью), используем системный aspectRatio (соответствует проектору).
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

                const scaleX = width / logicalWidth;
                const scaleY = height / logicalHeight;
                setScale(Math.min(scaleX, scaleY));

                // If not overriding, remember the physical ratio to perfectly fill it
                if (!aspectRatioOverride) {
                    setContainerRatio(width / height);
                }
            }
        });

        observer.observe(wrapper);
        return () => observer.disconnect();
    }, [logicalWidth, logicalHeight]);

    // Точные физические размеры слайда на экране превью (для рамки)
    const physicalWidth = logicalWidth * scale;
    const physicalHeight = logicalHeight * scale;

    return (
        <div
            ref={wrapperRef}
            className="w-full h-full flex items-center justify-center overflow-hidden"
        >
            {/* СЛОЙ 2: Bounding Box (Рамка). Размером ровно со сжатый слайд. */}
            <div
                className={cn("relative bg-black overflow-hidden shrink-0", containerClassName)}
                style={{
                    width: `${physicalWidth}px`,
                    height: `${physicalHeight}px`,
                    ...style
                }}
            >
                {/* СЛОЙ 3: Логический холст (1920 x Height). */}
                <div
                    className={cn("absolute top-0 left-0 origin-top-left", className)}
                    style={{
                        width: `${logicalWidth}px`,
                        height: `${logicalHeight}px`,
                        transform: `scale(${scale})`,
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
};

export default LogicalCanvas;
