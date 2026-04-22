import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { ITimerSettings, IMediaItem, IAudioScope } from '@/core/types';
import { audioService } from '@/features/presenter/services/AudioService';
import { LiveSyncService } from '@/core/services/liveSyncService';

export const useTimerAudio = (id: string, settings: ITimerSettings, isLive: boolean, isTimerPaused: boolean = false) => {
    const [currentSongIndex, setCurrentSongIndex] = useState(0);
    const lastPlayedFileRef = useRef<string | null>(null);
    const lastInitiatedIndexRef = useRef<number | null>(null);
    const crossFadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const playlistItems = useLiveQuery(
        async () => {
            if (!settings.playlist?.length) return [];
            const items = await db.mediaPool.where('id').anyOf(settings.playlist).toArray();
            return settings.playlist.map(id => items.find(item => item.id === id)).filter(Boolean) as IMediaItem[];
        },
        [settings.playlist]
    ) || [];

    useEffect(() => {
        if (!isLive) {
            setCurrentSongIndex(0);
            lastPlayedFileRef.current = null;
            lastInitiatedIndexRef.current = null;
        }
    }, [isLive]);

    useEffect(() => {
        let isActive = true;

        if (!isLive || !settings.playlist || settings.playlist.length === 0 || playlistItems.length === 0) {
            lastPlayedFileRef.current = null;
            return;
        }

        const playTrack = async (index: number, isCrossFade: boolean = false) => {
            if (!isActive) return;

            const songItem = playlistItems[index];
            if (!songItem) return;

            // Guard: Don't restart the same track if we are already playing it (respects pause)
            if (!isCrossFade && lastInitiatedIndexRef.current === index && lastPlayedFileRef.current === songItem.path) {
                return;
            }

            lastPlayedFileRef.current = songItem.path;
            lastInitiatedIndexRef.current = index;

            const nextIndex = (index + 1) % playlistItems.length;
            const stableScopeId = `timer-audio-${id}`;

            const scope: IAudioScope = {
                id: stableScopeId,
                presentationId: 'timer-temp',
                startSlideId: id,
                endSlideId: id,
                fileId: songItem.path,
                volume: 1,
                loop: false,
                crossfadeSettings: { fadeInDuration: 1.5, fadeOutDuration: 1.5 }
            };

            try {
                const playback = await audioService.playScope(scope);
                if (!playback || !isActive) return;

                const { duration } = playback;
                const crossFadeDuration = 5;
                const nextTriggerDelay = Math.max(1000, (duration - crossFadeDuration) * 1000);

                if (crossFadeTimeoutRef.current) clearTimeout(crossFadeTimeoutRef.current);

                crossFadeTimeoutRef.current = setTimeout(() => {
                    if (isLive && isActive) {
                        setCurrentSongIndex(nextIndex);
                    }
                }, nextTriggerDelay);
            } catch (err) {
                console.error('Timer Audio Failure:', err);
                crossFadeTimeoutRef.current = setTimeout(() => {
                    if (isLive && isActive) {
                        setCurrentSongIndex(nextIndex);
                    }
                }, 5000);
            }
        };

        playTrack(currentSongIndex);

        return () => {
            isActive = false;
            if (crossFadeTimeoutRef.current) clearTimeout(crossFadeTimeoutRef.current);
            crossFadeTimeoutRef.current = null;
        };
    }, [isLive, id, playlistItems.length, settings.playlist?.join(','), currentSongIndex]);

    // Command Listener for manual skips and Play/Pause (from LiveMediaToolbar)
    useEffect(() => {
        if (!isLive) return;

        const unsub = LiveSyncService.onPlaylistCommand(({ slideId, command }) => {
            if (slideId !== id || !playlistItems.length) return;

            if (command === 'next') {
                setCurrentSongIndex(prev => (prev + 1) % playlistItems.length);
            } else if (command === 'prev') {
                setCurrentSongIndex(prev => (prev - 1 + playlistItems.length) % playlistItems.length);
            }
            
            // Force reset last played ref to allow restarting same file if needed
            lastPlayedFileRef.current = null;
        });

        const unsubAudio = LiveSyncService.onAudioCommand(({ scopeId, command }) => {
            // Only respond if the command targets our stable scope ID
            const stableScopeId = `timer-audio-${id}`;
            if (scopeId !== stableScopeId) return;

            if (command === 'play') {
                audioService.playTrack(stableScopeId);
            } else if (command === 'pause') {
                audioService.pauseTrack(stableScopeId);
            } else if (command === 'toggle') {
                const progress = audioService.getTrackProgress(stableScopeId);
                if (progress?.isPlaying) audioService.pauseTrack(stableScopeId);
                else audioService.playTrack(stableScopeId);
            }
        });

        return () => {
            unsub();
            unsubAudio();
        };
    }, [isLive, id, playlistItems.length]);

    useEffect(() => {
        if (!isLive) {
            const stableScopeId = `timer-audio-${id}`;
            audioService.stopScope(stableScopeId, 0.5);
            lastPlayedFileRef.current = null;
            lastInitiatedIndexRef.current = null;
        }
    }, [isLive, id]);

    // Synchronize with timer pause state
    useEffect(() => {
        if (!isLive) return;
        
        const stableScopeId = `timer-audio-${id}`;
        if (isTimerPaused) {
            audioService.pauseTrack(stableScopeId);
        } else {
            // Only resume if it was actually playing/initiated
            if (lastInitiatedIndexRef.current !== null) {
                audioService.playTrack(stableScopeId);
            }
        }
    }, [isTimerPaused, isLive, id]);

    return { currentSongIndex };
};
