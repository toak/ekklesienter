import { useCallback, useRef } from 'react';

/**
 * A hook that returns a throttled version of the provided callback.
 * 
 * @param callback The function to throttle
 * @param delay The throttle delay in milliseconds
 * @returns A throttled version of the callback
 */
export function useThrottle<T extends (...args: any[]) => any>(
    callback: T,
    delay: number
): T {
    const lastRun = useRef(0);
    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastArgs = useRef<any[]>([]);

    return useCallback(((...args: any[]) => {
        const now = Date.now();
        lastArgs.current = args;

        const run = () => {
            lastRun.current = now;
            if (timeout.current) {
                clearTimeout(timeout.current);
                timeout.current = null;
            }
            callback(...lastArgs.current);
        };

        if (now - lastRun.current >= delay) {
            run();
        } else if (!timeout.current) {
            timeout.current = setTimeout(() => {
                run();
            }, delay - (now - lastRun.current));
        }
    }) as T, [callback, delay]);
}
