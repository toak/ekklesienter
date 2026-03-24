import { useState, useLayoutEffect, useCallback, useRef, useEffect } from 'react';

interface UseTextFitOptions {
    text: string;
    containerRef: React.RefObject<HTMLDivElement | null>;
    minFontSize?: number; // in px
    maxFontSize?: number; // in px
    precision?: number;
    safetyMargin?: number; // in pixels
}

/**
 * Hook for calculating the largest font size that fits within a container using binary search.
 * Includes a debounce mechanism to prevent layout thrashing during window resize.
 */
export function useTextFit({
    text,
    containerRef,
    minFontSize = 8,      // 0.5rem * 16
    maxFontSize = 1600,   // 100rem * 16
    precision = 0.5,      // 0.5px is enough for visual smoothness
    safetyMargin = 8,
}: UseTextFitOptions) {
    const [fontSize, setFontSize] = useState(maxFontSize);
    const [isReady, setIsReady] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const calculateFit = useCallback(() => {
        const container = containerRef.current;
        const content = contentRef.current;
        if (!container || !content) return;

        const availableHeight = container.clientHeight - safetyMargin;
        const availableWidth = container.clientWidth - safetyMargin;

        // Защита от монтирования в скрытом превью (размеры 0х0)
        if (availableHeight <= 0 || availableWidth <= 0) {
            setIsReady(false);
            return;
        }

        let lo = minFontSize;
        let hi = maxFontSize;

        // Сохраняем оригинальные стили перед мутациями
        const originalFontSize = content.style.fontSize;
        const originalMaxWidth = content.style.maxWidth;
        const originalWidth = content.style.width;

        // Форсируем ширину для корректного замера переносов
        content.style.width = `${availableWidth}px`;
        content.style.maxWidth = `${availableWidth}px`;

        // Бинарный поиск оптимального размера
        while (hi - lo > precision) {
            const mid = (lo + hi) / 2;
            content.style.fontSize = `${mid}px`;

            const fits = content.scrollHeight <= availableHeight && content.scrollWidth <= availableWidth;

            if (fits) {
                lo = mid; // Текст влез, пробуем сделать больше
            } else {
                hi = mid; // Текст не влез, нужно уменьшать
            }
        }

        // Возвращать стили на место, чтобы не ломать поток рендеринга React
        content.style.fontSize = originalFontSize;
        content.style.width = originalWidth;
        content.style.maxWidth = originalMaxWidth;

        setFontSize(lo);
        setIsReady(true);
    }, [text, containerRef, minFontSize, maxFontSize, precision, safetyMargin]);

    useLayoutEffect(() => {
        calculateFit();
    }, [calculateFit]);

    // Реактивный расчет: следит за физическим размером контейнера
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let timeoutId: NodeJS.Timeout;
        let lastWidth = container.clientWidth;
        let lastHeight = container.clientHeight;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;

            const { width, height } = entry.contentRect;

            // AI Performance Optimization: Only recalculate if size has changed meaningfully (> 2px)
            if (Math.abs(width - lastWidth) < 2 && Math.abs(height - lastHeight) < 2) return;

            lastWidth = width;
            lastHeight = height;

            clearTimeout(timeoutId);

            // Increase delay slightly for better batching
            timeoutId = setTimeout(() => {
                requestAnimationFrame(() => calculateFit());
            }, 200);
        });

        observer.observe(container);

        return () => {
            observer.disconnect();
            clearTimeout(timeoutId);
        };
    }, [calculateFit, containerRef]);


    return { fontSize, isReady, contentRef };
}
