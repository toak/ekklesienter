import { Verse, ISlide, ILogo } from '../types';
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
    }
};
