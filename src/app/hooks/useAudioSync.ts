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
    const audioData = useLiveQuery(
        async () => {
            if (!activePresentationId) return { slides: [], scopes: [] };
            const pres = await db.presentationFiles.get(activePresentationId);
            const scopes = await db.audioScopes.where('presentationId').equals(activePresentationId).toArray();
            return { slides: pres?.slides || [], scopes };
        },
        [activePresentationId]
    );

    useEffect(() => {
        if (!activePresentationId || !audioData?.slides?.length) {
            // Small delay to avoid stopping when switching presentations if the new one is still loading
            const timer = setTimeout(() => {
                if (!activePresentationId || !audioData?.slides?.length) {
                    audioService.stopAll(1.0);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
        audioService.sync(liveSlideId, audioData.slides, audioData.scopes);
    }, [liveSlideId, audioData, activePresentationId]);
}
