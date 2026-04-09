import { scan } from 'react-scan';
import { useEffect } from 'react';

/**
 * PerformanceMonitor Component
 * Integrates react-scan for visual render tracking.
 * Only initializes in development or if explicitly enabled.
 */
export const PerformanceMonitor = () => {
    useEffect(() => {
        if (import.meta.env.DEV) {
            // Disabled as diagnostic for blob:file:/// errors
            /*
            scan({
                enabled: false,
                showToolbar: true,
                showFPS: true,
                log: true,
            });
            */
        }
    }, []);

    return null;
};
