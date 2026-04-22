import { Verse, ISlide, ILogo, PresenterSettings } from '../types';
import { IpcService } from '../services/IpcService';

/**
 * Service to centralize IPC communication with the Projector window.
 */
export const LiveSyncService = {
    /**
     * Send a verse to the projector
     */
    showVerse(verse: Verse, secondTranslationId: string | null = null, translationId?: string) {
        IpcService.send('projector-command', 'show-verse', {
            verse,
            secondTranslationId,
            translationId
        });
    },

    /**
     * Send multiple selected verses to the projector
     */
    showMultiVerses(verses: Verse[], secondTranslationId: string | null = null, translationId?: string) {
        IpcService.send('projector-command', 'show-multiverses', {
            verses,
            secondTranslationId,
            translationId
        });
    },

    showAppMode(mode: 'scripture' | 'presentation') {
        IpcService.send('projector-command', 'set-app-mode', mode);
    },

    /**
     * Send a slide to the projector
     */
    showSlide(slide: ISlide, presentationId?: string, rootPresentationId?: string, navigationParentSlideId?: string | null) {
        IpcService.send('projector-command', 'show-slide', { 
            slide, 
            presentationId,
            rootPresentationId,
            navigationParentSlideId
        });
    },

    /**
     * Send a preview slide to the projector (for preloading)
     */
    showPreviewSlide(slide: ISlide | null, presentationId?: string, rootPresentationId?: string, navigationParentSlideId?: string | null) {
        IpcService.send('projector-command', 'show-preview-slide', { 
            slide, 
            presentationId,
            rootPresentationId,
            navigationParentSlideId
        });
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
    sendVideoCommand(slideId: string, command: 'play' | 'pause' | 'toggle' | 'seek' | 'speed' | 'volume' | 'mute', value?: number | boolean) {
        IpcService.send('projector-command', 'video-command', { slideId, command, value });
    },

    /**
     * Send current video playback status from projector back to controller
     */
    sendVideoStatus(slideId: string, currentTime: number, isPlaying: boolean, duration: number) {
        IpcService.send('projector-command', 'video-status', { slideId, currentTime, isPlaying, duration });
    },

    /**
     * Request current video playback status from the projector (Pull model)
     */
    requestVideoStatus() {
        IpcService.send('projector-command', 'request-video-status');
    },

    /**
     * Send current audio playback status from controller to anyone watching (toolbar/remote)
     */
    sendAudioStatus(scopeId: string, currentTime: number, isPlaying: boolean, duration: number, fileId: string) {
        IpcService.send('projector-command', 'audio-status', { scopeId, currentTime, isPlaying, duration, fileId });
    },

    syncAudioMetadata(slides: any[], scopes: any[]) {
        IpcService.send('projector-command', 'sync-audio-metadata', { slides, scopes });
    },

    /**
     * Sends an audio control command (play/pause/seek) to the projector
     */
    sendAudioCommand(scopeId: string, command: 'play' | 'pause' | 'toggle' | 'seek', value?: number) {
        IpcService.send('projector-command', 'audio-command', { scopeId, command, value });
    },

    /**
     * Sends a playlist control command (next/prev) to the projector
     */
    sendPlaylistCommand(slideId: string, command: 'next' | 'prev') {
        IpcService.send('projector-command', 'playlist-command', { slideId, command });
    },

    sendTimerCommand(slideId: string, command: 'toggle' | 'pause' | 'resume') {
        IpcService.send('projector-command', 'timer-command', { slideId, command });
    },

    sendTimerAction(action: 'next_slide' | 'prev_slide' | 'navigate_to' | 'override', payload?: any) {
        IpcService.send('projector-command', 'timer-action', { action, payload });
    },

    onVideoCommand(callback: (data: { slideId: string; command: string; value?: number | boolean }) => void) {
        // Since the Main process relays commands via 'projector-command', we listen on that channel
        // and filter for 'video-command' actions.
        return IpcService.on('projector-command', (command: any, payload: any) => {
            if (command === 'video-command') {
                callback(payload);
            }
        });
    },

    onVideoStatus(callback: (data: { slideId: string; currentTime: number; isPlaying: boolean; duration: number }) => void) {
        return IpcService.on('projector-command', (command: any, payload: any) => {
            if (command === 'video-status') {
                callback(payload);
            }
        });
    },

    /**
     * Listener for status requests (used by projector)
     */
    onVideoStatusRequest(callback: () => void) {
        return IpcService.on('projector-command', (command: any) => {
            if (command === 'request-video-status') {
                callback();
            }
        });
    },

    onAudioStatus(callback: (data: { scopeId: string; currentTime: number; isPlaying: boolean; duration: number; fileId: string }) => void) {
        return IpcService.on('projector-command', (command: any, payload: any) => {
            if (command === 'audio-status') {
                callback(payload);
            }
        });
    },

    onAudioCommand(callback: (data: { scopeId: string; command: string; value?: number | boolean }) => void) {
        return IpcService.on('projector-command', (command: any, payload: any) => {
            if (command === 'audio-command') {
                callback(payload);
            }
        });
    },

    onPlaylistCommand(callback: (data: { slideId: string; command: 'next' | 'prev' }) => void) {
        return IpcService.on('projector-command', (command: any, payload: any) => {
            if (command === 'playlist-command') {
                callback(payload);
            }
        });
    },

    onTimerCommand(callback: (data: { slideId: string; command: 'toggle' | 'pause' | 'resume' }) => void) {
        return IpcService.on('projector-command', (command: any, payload: any) => {
            if (command === 'timer-command') {
                callback(payload);
            }
        });
    },

    onTimerAction(callback: (data: { action: 'next_slide' | 'prev_slide' | 'navigate_to' | 'override'; payload?: any }) => void) {
        return IpcService.on('projector-command', (command: any, payload: any) => {
            if (command === 'timer-action') {
                callback(payload);
            }
        });
    }
};
