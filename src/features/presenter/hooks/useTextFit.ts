import { useLayoutEffect, useState, useRef, RefObject } from 'react';
import { useAtomValue } from 'jotai';
import { slideEditorDragActiveAtom } from '@/core/store/uiAtoms';

interface UseTextFitProps {
    containerRef: RefObject<HTMLElement | null>;
    textRef: RefObject<HTMLElement | null>;
    resizingMode: string;
    originalFontSize: number;
    content: string;
    fontFamily?: string;
}

/**
 * Automatically calculates the best font size for 'shrink-to-fit' mode
 * using a binary search approach.
 */
export function useTextFit({
    containerRef,
    textRef,
    resizingMode,
    originalFontSize,
    content,
    fontFamily = 'Inter',
}: UseTextFitProps) {
    const [fittedFontSize, setFittedFontSize] = useState(originalFontSize);
    const fittedRef = useRef(originalFontSize);

    // If the original size changes from outside, reset the fitted size.
    useLayoutEffect(() => {
        if (resizingMode !== 'shrink-to-fit') {
            setFittedFontSize(originalFontSize);
            fittedRef.current = originalFontSize;
        }
    }, [originalFontSize, resizingMode]);

    const dragActive = useAtomValue(slideEditorDragActiveAtom);

    useLayoutEffect(() => {
        if (resizingMode !== 'shrink-to-fit' || dragActive) return;

        const container = containerRef.current;
        const textElement = textRef.current;
        if (!container || !textElement) return;

        // Temporarily reset styles to measure
        textElement.style.fontSize = `${originalFontSize}px`;

        const containerW = container.clientWidth;
        const containerH = container.clientHeight;

        let minSize = 8; // minimum readable font size
        let maxSize = 1000; // Large maximum for upscaling
        let bestFit = minSize;

        // Binary search for the largest font size that fits
        while (minSize <= maxSize) {
            const mid = Math.floor((minSize + maxSize) / 2);
            textElement.style.fontSize = `${mid}px`;

            if (textElement.scrollWidth <= containerW + 1 && textElement.scrollHeight <= containerH + 1) {
                bestFit = mid;
                minSize = mid + 1; // Try bigger
            } else {
                maxSize = mid - 1; // Try smaller
            }
        }

        // Restore element style from ref (not state) to prevent layout thrashing
        textElement.style.fontSize = `${fittedRef.current}px`;

        if (fittedRef.current !== bestFit) {
            fittedRef.current = bestFit;
            setFittedFontSize(bestFit);
        }

    }, [resizingMode, originalFontSize, content, fontFamily, containerRef, textRef, dragActive]);

    return resizingMode === 'shrink-to-fit' ? fittedFontSize : originalFontSize;
}
