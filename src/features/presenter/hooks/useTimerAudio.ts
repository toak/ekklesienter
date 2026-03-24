import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { ITimerSettings, IMediaItem, IAudioScope } from '@/core/types';
import { audioService } from '@/features/presenter/services/AudioService';

export const useTimerAudio = (id: string, settings: ITimerSettings, isLive: boolean) => {
    const [currentSongIndex, setCurrentSongIndex] = useState(0);
    const lastPlayedFileRef = useRef<string | null>(null);
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
        }
    }, [isLive, settings.duration]);

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

            if (!isCrossFade && lastPlayedFileRef.current === songItem.path) {
                return;
            }
            lastPlayedFileRef.current = songItem.path;

            const nextIndex = (index + 1) % playlistItems.length;

            const scope: IAudioScope = {
                id: crypto.randomUUID(),
                presentationId: 'timer-temp',
                startSlideId: 'timer',
                endSlideId: 'timer',
                fileId: songItem.path,
                volume: 1,
                loop: false,
                crossfadeSettings: { fadeInDuration: 0, fadeOutDuration: 0 }
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
                        playTrack(nextIndex, true);
                    }
                }, nextTriggerDelay);
            } catch (err) {
                console.error('Timer Audio Failure:', err);
                crossFadeTimeoutRef.current = setTimeout(() => {
                    if (isLive && isActive) {
                        setCurrentSongIndex(nextIndex);
                        playTrack(nextIndex, false);
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
    }, [isLive, id, playlistItems.length, settings.playlist]);

    useEffect(() => {
        if (!isLive) {
            settings.playlist?.forEach((_, index) => {
                audioService.stopScope(`timer-audio-${id}-${index}`, 0.5);
            });
            lastPlayedFileRef.current = null;
        }
    }, [isLive, id]);

    return { currentSongIndex };
};
