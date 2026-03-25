import { useEffect } from 'react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { audioService } from '@/features/presenter/services/AudioService';

/**
 * Hook to synchronize audio state with the current live slide and presentation.
 */
export function useAudioSync() {
    const { liveSlideId, activePresentationId } = usePresentationStore();

    // Audio Sync — use DB data directly for reliability (store's activePresentation can be stale)
    const audioPresentationSlides = useLiveQuery(
        () => activePresentationId ? db.presentationFiles.get(activePresentationId).then(p => p?.slides || []) : [],
        [activePresentationId]
    );

    useEffect(() => {
        if (!activePresentationId || !audioPresentationSlides?.length) {
            // Small delay to avoid stopping when switching presentations if the new one is still loading
            const timer = setTimeout(() => {
                if (!activePresentationId || !audioPresentationSlides?.length) {
                    audioService.stopAll(1.0);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
        audioService.sync(liveSlideId, audioPresentationSlides);
    }, [liveSlideId, audioPresentationSlides, activePresentationId]);
}
