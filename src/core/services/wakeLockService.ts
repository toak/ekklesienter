import { ipcService } from './ipcService';

let wakeLock: WakeLockSentinel | null = null;
let isEnabled = false;
let boundVisibilityChange: (() => Promise<void>) | null = null;

/**
 * Service to manage screen wake lock (preventing sleep).
 * Supports both standard Web Screen Wake Lock API and Electron powerSaveBlocker.
 */
export const wakeLockService = {
    /**
     * Set the wake lock state.
     */
    async setWakeLock(enabled: boolean): Promise<void> {
        isEnabled = enabled;

        if (ipcService.isElectron()) {
            await wakeLockService.setElectronWakeLock(enabled);
        } else {
            await wakeLockService.setWebWakeLock(enabled);
        }
    },

    /**
     * Electron-specific wake lock via powerSaveBlocker.
     */
    async setElectronWakeLock(enabled: boolean): Promise<void> {
        try {
            await ipcService.power.setWakeLock(enabled);
        } catch (error) {
            console.error('[WakeLockService] Failed to set Electron wake lock:', error);
        }
    },

    /**
     * Web-specific wake lock via Screen Wake Lock API.
     */
    async setWebWakeLock(enabled: boolean): Promise<void> {
        if (!('wakeLock' in navigator)) {
            console.warn('[WakeLockService] Screen Wake Lock API not supported in this browser.');
            return;
        }

        try {
            if (enabled) {
                if (!wakeLock) {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('[WakeLockService] Web wake lock acquired');
                    
                    // Re-acquire if visibility changes
                    wakeLock.addEventListener('release', () => {
                        console.log('[WakeLockService] Web wake lock released');
                        wakeLock = null;
                    });
                }

                // Add visibilitychange event listener dynamically when lock is acquired
                if (typeof document !== 'undefined' && !boundVisibilityChange) {
                    boundVisibilityChange = () => wakeLockService.handleVisibilityChange();
                    document.addEventListener('visibilitychange', boundVisibilityChange);
                }
            } else {
                if (wakeLock) {
                    await wakeLock.release();
                    wakeLock = null;
                }

                // Remove visibilitychange listener when lock is fully released
                if (typeof document !== 'undefined' && boundVisibilityChange) {
                    document.removeEventListener('visibilitychange', boundVisibilityChange);
                    boundVisibilityChange = null;
                }
            }
        } catch (error) {
            console.error('[WakeLockService] Failed to set Web wake lock:', error);
        }
    },

    /**
     * Re-acquires the wake lock if it was enabled and lost (e.g., due to tab switching).
     */
    async handleVisibilityChange(): Promise<void> {
        if (isEnabled && !ipcService.isElectron() && !wakeLock && document.visibilityState === 'visible') {
            await wakeLockService.setWebWakeLock(true);
        }
    }
};

/** @deprecated Use wakeLockService instead. */
export const WakeLockService = wakeLockService;
