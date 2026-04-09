import { Verse, ISlide, ILogo, PresenterSettings } from '../types';
import { IpcService } from '../services/IpcService';

/**
 * Service to centralize IPC communication with the Projector window.
 */
export const LiveSyncService = {
    /**
     * Send a verse to the projector
     */
    showVerse(verse: Verse, secondTranslationId: string | null = null) {
        IpcService.send('projector-command', 'show-verse', {
            verse,
            secondTranslationId
        });
    },

    /**
     * Send multiple selected verses to the projector
     */
    showMultiVerses(verses: Verse[], secondTranslationId: string | null = null) {
        IpcService.send('projector-command', 'show-multiverses', {
            verses,
            secondTranslationId
        });
    },

    showAppMode(mode: 'scripture' | 'presentation') {
        IpcService.send('projector-command', 'set-app-mode', mode);
    },

    /**
     * Send a slide to the projector
     */
    showSlide(slide: ISlide) {
        IpcService.send('projector-command', 'show-slide', { slide });
    },

    /**
     * Send a preview slide to the projector (for preloading)
     */
    showPreviewSlide(slide: ISlide | null) {
        IpcService.send('projector-command', 'show-preview-slide', { slide });
    },

    /**
     * Set live override mode (blackout, whiteout, logo)
     */
    setOverride(type: 'blackout' | 'whiteout' | 'logo' | null, logo: ILogo | null = null) {
        IpcService.send('projector-command', 'set-override', { type, logo });
    },

    /**
     * Clear the projector screen
     */
    clear() {
        IpcService.send('projector-command', 'clear');
    },

    /**
     * Synchronize full settings state with the projector
     */
    syncSettings(settings: PresenterSettings) {
        IpcService.send('projector-command', 'update-settings', settings);
    },

    /**
     * Send a video playback command to the projector
     */
    sendVideoCommand(slideId: string, command: 'play' | 'pause' | 'seek' | 'speed' | 'volume' | 'mute', value?: number | boolean) {
        IpcService.send('projector-command', 'video-command', { slideId, command, value });
    },

    /**
     * Send current video playback status from projector back to controller
     */
    sendVideoStatus(slideId: string, currentTime: number, isPlaying: boolean, duration: number) {
        IpcService.send('projector-command', 'video-status', { slideId, currentTime, isPlaying, duration });
    },

    onVideoCommand(callback: (data: { slideId: string; command: string; value?: number | boolean }) => void) {
        // Since the Main process relays commands via 'projector-command', we listen on that channel
        // and filter for 'video-command' actions.
        return IpcService.on('projector-command', (command, payload) => {
            if (command === 'video-command') {
                callback(payload);
            }
        });
    },

    onVideoStatus(callback: (data: { slideId: string; currentTime: number; isPlaying: boolean; duration: number }) => void) {
        return IpcService.on('projector-command', (command, payload) => {
            if (command === 'video-status') {
                callback(payload);
            }
        });
    }
};
