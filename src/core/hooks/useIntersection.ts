import { useState, useEffect, useRef, RefObject } from 'react';

interface UseIntersectionOptions extends IntersectionObserverInit {
    freezeOnceVisible?: boolean;
}

/**
 * Hook to detect when an element is visible in the viewport.
 * Useful for lazy loading components or data fetching.
 */
export function useIntersection(
    elementRef: RefObject<Element | null>,
    {
        threshold = 0,
        root = null,
        rootMargin = '0px',
        freezeOnceVisible = false,
    }: UseIntersectionOptions = {}
): IntersectionObserverEntry | undefined {
    const [entry, setEntry] = useState<IntersectionObserverEntry>();

    const frozen = entry?.isIntersecting && freezeOnceVisible;

    const updateEntry = ([nextEntry]: IntersectionObserverEntry[]): void => {
        setEntry(nextEntry);
    };

    useEffect(() => {
        const node = elementRef?.current; // DOM node
        const hasIOSupport = !!window.IntersectionObserver;

        if (!hasIOSupport || frozen || !node) return;

        const observerParams = { threshold, root, rootMargin };
        const observer = new IntersectionObserver(updateEntry, observerParams);

        observer.observe(node);

        return () => observer.disconnect();
    }, [elementRef, threshold, root, rootMargin, frozen]);

    return entry;
}
