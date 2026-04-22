import { useEffect } from 'react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { audioService } from '@/features/presenter/services/AudioService';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { IpcService } from '@/core/services/IpcService';
import { ISlide, IAudioScope } from '@/core/types';

/**
 * Hook to synchronize audio state with the current live slide and presentation.
 * This hook runs in both Controller and Projector windows with different roles.
 */
export function useAudioSync(isProjector: boolean = false) {
    const liveSlideId = usePresentationStore(s => s.liveSlideId);
    const activePresentationId = usePresentationStore(s => s.activePresentationId);
    const rootPresentationId = usePresentationStore(s => s.rootPresentationId);

    // 1. DATA SOURCE (Both windows) — Watch DB for slides and audio scopes
    const audioData = useLiveQuery(
        async () => {
            if (!activePresentationId) return { slides: [], scopes: [], rootSlides: [], rootScopes: [] };
            
            // Current Presentation (might be nested)
            const pres = await db.presentationFiles.get(activePresentationId);
            const scopes = await db.audioScopes.where('presentationId').equals(activePresentationId).toArray();
            
            // Root Presentation (for background audio inheritance)
            let rootSlides: ISlide[] = [];
            let rootScopes: IAudioScope[] = [];
            
            if (rootPresentationId && rootPresentationId !== activePresentationId) {
                const rootPres = await db.presentationFiles.get(rootPresentationId);
                rootSlides = rootPres?.slides || [];
                rootScopes = await db.audioScopes.where('presentationId').equals(rootPresentationId).toArray();
            }

            return { 
                slides: pres?.slides || [], 
                scopes,
                rootSlides,
                rootScopes
            };
        },
        [activePresentationId, rootPresentationId]
    );

    // Controller: Still sync metadata to projector as a fallback/trigger
    useEffect(() => {
        if (!isProjector && activePresentationId && audioData) {
            LiveSyncService.syncAudioMetadata(audioData.slides, audioData.scopes);
        }
    }, [isProjector, activePresentationId, audioData]);

    // Safety: Stop all audio if presentation is closed (Both windows, but primarily projector)
    useEffect(() => {
        if (!activePresentationId) {
            const timer = setTimeout(() => {
                if (!activePresentationId) audioService.stopAll(1.0);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [activePresentationId]);

    // Projector: Perform the actual service sync using local DB data (Source of Truth)
    useEffect(() => {
        if (!isProjector || !audioData) return;

        if (audioData.slides.length === 0) {
            // Only stop if we are SURE there is no active presentation anymore
            if (!activePresentationId) {
                audioService.stopAll(1.0);
            }
            return;
        }
        
        // Debug: Ensure projector is syncing
        console.debug('🔊 [AudioSync] Triggering AudioService.sync', {
            liveSlideId,
            presentationId: activePresentationId,
            rootId: rootPresentationId,
            slideCount: audioData.slides.length,
            scopeCount: audioData.scopes.length
        });
        
        // Ensure context is ready
        audioService.resume();

        audioService.sync(
            liveSlideId, 
            audioData.slides, 
            audioData.scopes,
            usePresentationStore.getState().navigationParentSlideId,
            audioData.rootSlides,
            audioData.rootScopes
        );
    }, [isProjector, liveSlideId, audioData, activePresentationId, rootPresentationId]);

    // 3. Audio Heartbeat — broadcast status to toolbar/remote (Projector ONLY)
    useEffect(() => {
        if (!isProjector) return;

        const interval = setInterval(() => {
            const activeId = audioService.targetScopeId;
            if (activeId) {
                const progress = audioService.getTrackProgress(activeId);
                const track = audioService.activeTracks.get(activeId);
                if (progress && track) {
                    LiveSyncService.sendAudioStatus(
                        activeId,
                        progress.currentTime,
                        progress.isPlaying,
                        progress.duration,
                        track.scope.fileId
                    );
                }
            } else {
                // Check if we have ANY active tracks to report (e.g. fading out)
                const firstTrackId = Array.from(audioService.activeTracks.keys())[0];
                if (!firstTrackId) {
                    // Only send "none" if we're actually silent
                    LiveSyncService.sendAudioStatus('', 0, false, 0, '');
                }
            }
        }, 500);
        return () => clearInterval(interval);
    }, [isProjector]);

    // 4. Audio Command Relay — handle commands from toolbar/remote (Projector ONLY)
    useEffect(() => {
        if (!isProjector) return;

        const unsub = LiveSyncService.onAudioCommand(({ scopeId, command, value }) => {
            const targetId = scopeId || audioService.targetScopeId;
            
            if (command === 'request-status') {
                const actualId = targetId || Array.from(audioService.activeTracks.keys())[0];
                if (actualId) {
                    const progress = audioService.getTrackProgress(actualId);
                    const track = audioService.activeTracks.get(actualId);
                    if (progress && track) {
                        LiveSyncService.sendAudioStatus(actualId, progress.currentTime, progress.isPlaying, progress.duration, track.scope.fileId);
                    }
                }
                return;
            }

            if (!targetId) return;

            switch (command) {
                case 'play': audioService.playTrack(targetId); break;
                case 'pause': audioService.pauseTrack(targetId); break;
                case 'toggle': {
                    const progress = audioService.getTrackProgress(targetId);
                    if (progress?.isPlaying) audioService.pauseTrack(targetId);
                    else audioService.playTrack(targetId);
                    break;
                }
                case 'seek': 
                    if (typeof value === 'number') audioService.seekTrack(targetId, value);
                    break;
            }
        });
        return () => unsub();
    }, []);
}
