import { useEffect } from 'react';
import { usePresentationStore } from '../store/presentationStore';
import { WakeLockService } from '@/core/services/wakeLockService';

/**
 * Hook to manage screen wake lock based on the live presentation state.
 * Prevents the screen from sleeping while a slide is "Live".
 */
export const useWakeLock = () => {
    const liveSlideId = usePresentationStore(state => state.liveSlideId);

    useEffect(() => {
        const isLive = !!liveSlideId;
        
        WakeLockService.setWakeLock(isLive).catch(err => {
            console.error('[useWakeLock] Error toggling wake lock:', err);
        });

        // Cleanup on unmount (though usually contextually tied to App)
        return () => {
            if (isLive) {
                WakeLockService.setWakeLock(false).catch(err => {
                    console.error('[useWakeLock] Error releasing wake lock on cleanup:', err);
                });
            }
        };
    }, [liveSlideId]);
};
