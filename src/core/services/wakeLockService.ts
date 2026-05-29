import { IpcService } from './IpcService';

/**
 * Service to manage screen wake lock (preventing sleep).
 * Supports both standard Web Screen Wake Lock API and Electron powerSaveBlocker.
 */
export class WakeLockService {
    private static wakeLock: WakeLockSentinel | null = null;
    private static isEnabled = false;

    /**
     * Set the wake lock state.
     */
    static async setWakeLock(enabled: boolean): Promise<void> {
        this.isEnabled = enabled;

        if (IpcService.isElectron()) {
            await this.setElectronWakeLock(enabled);
        } else {
            await this.setWebWakeLock(enabled);
        }
    }

    /**
     * Electron-specific wake lock via powerSaveBlocker.
     */
    private static async setElectronWakeLock(enabled: boolean): Promise<void> {
        try {
            await IpcService.power.setWakeLock(enabled);
        } catch (error) {
            console.error('[WakeLockService] Failed to set Electron wake lock:', error);
        }
    }

    /**
     * Web-specific wake lock via Screen Wake Lock API.
     */
    private static async setWebWakeLock(enabled: boolean): Promise<void> {
        if (!('wakeLock' in navigator)) {
            console.warn('[WakeLockService] Screen Wake Lock API not supported in this browser.');
            return;
        }

        try {
            if (enabled) {
                if (!this.wakeLock) {
                    this.wakeLock = await navigator.wakeLock.request('screen');
                    console.log('[WakeLockService] Web wake lock acquired');
                    
                    // Re-acquire if visibility changes
                    this.wakeLock.addEventListener('release', () => {
                        console.log('[WakeLockService] Web wake lock released');
                        this.wakeLock = null;
                    });
                }
            } else {
                if (this.wakeLock) {
                    await this.wakeLock.release();
                    this.wakeLock = null;
                }
            }
        } catch (error) {
            console.error('[WakeLockService] Failed to set Web wake lock:', error);
        }
    }

    /**
     * Re-acquires the wake lock if it was enabled and lost (e.g., due to tab switching).
     */
    static async handleVisibilityChange(): Promise<void> {
        if (this.isEnabled && !IpcService.isElectron() && !this.wakeLock && document.visibilityState === 'visible') {
            await this.setWebWakeLock(true);
        }
    }
}

// Global listener for web visibility change
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        WakeLockService.handleVisibilityChange();
    });
}
