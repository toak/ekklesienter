import { useState, useRef, useCallback, useEffect } from 'react';
import { IVideoSettings } from '@/core/types';
import { LiveSyncService } from '@/core/services/liveSyncService';

interface IVideoPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
}

interface IVideoPlaybackActions {
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
}

interface UseVideoPlaybackOptions {
  settings: IVideoSettings;
  isPreview: boolean;
  isLive: boolean;
  isPreloading?: boolean;
  slideId: string;
  /** When true, skip auto-play and volume sync effects (toolbar control-only mode) */
  controlOnly?: boolean;
  isRemote?: boolean;
}

/** Duration in seconds for the fade-out when a video slide is being unmounted */
const UNMOUNT_FADE_DURATION = 0.4;

/**
 * Custom hook to manage video playback state across preview and projector.
 * Handles trim boundaries, delay strategy, and projector synchronization.
 */
export const useVideoPlayback = ({
  settings,
  isPreview,
  isLive,
  isPreloading,
  slideId,
  controlOnly = false,
  isRemote = false,
}: UseVideoPlaybackOptions): {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  state: IVideoPlaybackState;
  actions: IVideoPlaybackActions;
} => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Track the latest volume/muted settings in a ref so the cleanup
  // fade-out can read them without a stale closure.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [state, setState] = useState<IVideoPlaybackState>({
    isPlaying: false,
    currentTime: settings.trimStart || 0,
    duration: 0,
    buffered: 0,
  });

  // ── Volume & property sync ────────────────────────────────────────────────
  // Skip if controlOnly (the LiveMediaToolbar's hidden muted video doesn't
  // need its own volume management — it just sends commands).
  useEffect(() => {
    if (controlOnly) return;
    const video = videoRef.current;
    if (!video) return;

    const updateVolume = () => {
      if (settings.muted || isPreloading) {
        video.volume = 0;
        return;
      }

      const fadeInDuration = settings.fadeInSeconds || 0;
      const fadeOutDuration = settings.fadeOutSeconds || 0;
      const trimStart = settings.trimStart || 0;
      const trimEnd = settings.trimEnd || video.duration || 0;
      
      const currentTime = video.currentTime;
      let fadeMultiplier = 1.0;

      // Fade In logic
      if (fadeInDuration > 0 && currentTime < trimStart + fadeInDuration) {
        fadeMultiplier = Math.max(0, (currentTime - trimStart) / fadeInDuration);
      }
      // Fade Out logic
      else if (fadeOutDuration > 0 && trimEnd > 0 && currentTime > trimEnd - fadeOutDuration) {
        fadeMultiplier = Math.max(0, (trimEnd - currentTime) / fadeOutDuration);
      }

      const targetVolume = settings.volume * fadeMultiplier;
      // Precision check: avoid redundant updates
      if (Math.abs(video.volume - targetVolume) > 0.001) {
        video.volume = targetVolume;
      }
    };

    video.playbackRate = settings.speed;
    // Always disable native loop so we can handle it manually with trimming
    video.loop = false;
    video.muted = settings.muted;

    // Initial volume calculation
    updateVolume();

    // If fades are enabled, we need to update volume on every time tick
    if (settings.fadeInSeconds || settings.fadeOutSeconds) {
      video.addEventListener('timeupdate', updateVolume);
      return () => video.removeEventListener('timeupdate', updateVolume);
    }
  }, [settings.speed, settings.volume, settings.loop, settings.muted, settings.fadeInSeconds, settings.fadeOutSeconds, settings.trimStart, settings.trimEnd, isPreloading, controlOnly]);

  // ── Event listeners for state tracking ────────────────────────────────────
  useEffect(() => {
    if (controlOnly) return;
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const trimStart = settings.trimStart || 0;
      const trimEnd = settings.trimEnd || video.duration;

      // Physically seek to the start point if we're behind it
      if (video.currentTime < trimStart) {
        video.currentTime = trimStart;
      }

      setState(prev => ({
        ...prev,
        duration: trimEnd,
        currentTime: video.currentTime,
      }));
    };

    const syncState = () => {
      const currentTime = video.currentTime;
      const trimStart = settings.trimStart || 0;
      const videoDuration = video.duration || 0;
      const trimEnd = settings.trimEnd || videoDuration || 0;

      // ── Boundary Enforcement (Trim / Loop) ──────────────────────────────
      
      // If we are before the start point, instantly correct it.
      // We check if we are significantly before it (to allow for small seeks/fades)
      // or if we just started playing at 0 when trimStart is > 0.
      if (trimStart > 0 && (currentTime < trimStart - 0.15 || (currentTime < 0.1 && trimStart > 0.5))) {
        video.currentTime = trimStart;
        return;
      }

      // If we reached the trimEnd, handle loop or pause
      if (trimEnd > 0 && currentTime >= trimEnd - 0.05 && currentTime > trimStart) {
        if (settings.loop) {
          video.currentTime = trimStart;
          video.play().catch(() => {});
          if (isPreview && isLive) {
            LiveSyncService.sendVideoCommand(slideId, 'seek', trimStart);
            LiveSyncService.sendVideoCommand(slideId, 'play', trimStart);
          }
        } else {
          video.pause();
          video.currentTime = trimEnd;
          if (isPreview && isLive) {
            LiveSyncService.sendVideoCommand(slideId, 'pause', trimEnd);
          }
        }
      }

      setState(prev => ({
        ...prev,
        currentTime: video.currentTime,
        isPlaying: !video.paused && !video.ended,
        duration: settings.trimEnd || videoDuration || prev.duration,
        buffered: video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0,
      }));
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', syncState);
    video.addEventListener('play', syncState);
    video.addEventListener('pause', syncState);
    video.addEventListener('playing', syncState);
    video.addEventListener('waiting', syncState);
    video.addEventListener('seeking', syncState);
    video.addEventListener('seeked', syncState);
    video.addEventListener('ratechange', syncState);

    // Initial sync
    if (video.readyState >= 1) handleLoadedMetadata();

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', syncState);
      video.removeEventListener('play', syncState);
      video.removeEventListener('pause', syncState);
      video.removeEventListener('playing', syncState);
      video.removeEventListener('waiting', syncState);
      video.removeEventListener('seeking', syncState);
      video.removeEventListener('seeked', syncState);
      video.removeEventListener('ratechange', syncState);
    };
  }, [settings.trimStart, settings.trimEnd, settings.mediaId, videoRef, controlOnly]);

  // ── Auto-play strategy when live ──────────────────────────────────────────
  // Skip in controlOnly mode so the toolbar doesn't fire duplicate play commands.
  useEffect(() => {
    if (controlOnly || isRemote) return;
    const video = videoRef.current;
    if (!video || !isLive || isPreloading) return;

    const startPlayback = () => {
      const trimStart = settings.trimStart || 0;
      
      // Crucial: Physically seek before playing to ensure the projector 
      // doesn't start at 0:00 when the trim is elsewhere.
      if (Math.abs(video.currentTime - trimStart) > 0.2) {
        video.currentTime = trimStart;
      }

      video.play().catch(() => {
        // If autoplay is blocked, we try to play again on first user interaction or could try muted
      });

      // If we are the master (toolbar), we must explicitly tell the projector to start
      if (isPreview) {
        LiveSyncService.sendVideoCommand(slideId, 'play', video.currentTime);
      }
    };

    // Immediate seek on mount for live slides
    const initialTrimStart = settings.trimStart || 0;
    if (video.readyState >= 1) {
        if (Math.abs(video.currentTime - initialTrimStart) > 0.2) {
            video.currentTime = initialTrimStart;
        }
    }

    if (settings.strategy === 'auto') {
      if (video.readyState >= 2) {
        startPlayback();
      } else {
        video.addEventListener('canplay', startPlayback, { once: true });
      }
    } else if (settings.strategy === 'delay') {
      const delayMs = (settings.delaySeconds || 1) * 1000;
      delayTimerRef.current = setTimeout(() => {
        if (video.readyState >= 2) {
          startPlayback();
        } else {
          video.addEventListener('canplay', startPlayback, { once: true });
        }
      }, delayMs);
    }
    // 'manual' — do nothing

    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      video.removeEventListener('canplay', startPlayback);
    };
  }, [isLive, isPreview, settings.strategy, settings.delaySeconds, slideId, settings.mediaId, isPreloading, controlOnly]);

  // ── Fade-out on unmount ───────────────────────────────────────────────────
  // When this hook (and thus the video) is about to be destroyed (slide change),
  // perform a quick volume ramp-down so audio doesn't cut abruptly.
  useEffect(() => {
    if (controlOnly) return;
    const video = videoRef.current;

    return () => {
      if (!video || video.paused || video.ended) return;
      const s = settingsRef.current;
      if (s.muted || s.volume === 0) return;

      // Animate volume to 0 over UNMOUNT_FADE_DURATION, then pause.
      const startVol = video.volume;
      if (startVol <= 0.001) return;

      const steps = 10;
      const stepMs = (UNMOUNT_FADE_DURATION * 1000) / steps;
      let step = 0;

      const fadeInterval = setInterval(() => {
        step++;
        const t = step / steps;
        // Quadratic ease-out for natural feel
        const multiplier = 1 - t * t;
        try {
          video.volume = Math.max(0, startVol * multiplier);
        } catch {
          // Video element may have been removed from DOM
          clearInterval(fadeInterval);
          return;
        }
        if (step >= steps) {
          clearInterval(fadeInterval);
          try {
            video.pause();
          } catch {
            // noop
          }
        }
      }, stepMs);

      // Also send a pause to the projector so it stops too
      if (isPreview && isLive) {
        LiveSyncService.sendVideoCommand(slideId, 'pause', video.currentTime);
      }
    };
    // Only re-create this cleanup when the slideId or the video source changes,
    // NOT on settings changes, so we don't trigger false cleanups.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideId, settings.mediaId, controlOnly]);

  // Actions
  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {});
    if (isLive && isPreview) {
      LiveSyncService.sendVideoCommand(slideId, 'play', video.currentTime);
    }
  }, [isPreview, isLive, slideId]);

  const pause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    if (isLive && isPreview) {
      LiveSyncService.sendVideoCommand(slideId, 'pause', video.currentTime);
    }
  }, [isPreview, isLive, slideId]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      play();
    } else {
      pause();
    }
  }, [play, pause]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clampedTime = Math.max(
      settings.trimStart || 0,
      Math.min(time, settings.trimEnd || video.duration)
    );
    video.currentTime = clampedTime;
    if (isPreview && isLive) {
      LiveSyncService.sendVideoCommand(slideId, 'seek', clampedTime);
    }
  }, [settings.trimStart, settings.trimEnd, isPreview, isLive, slideId]);

  const setSpeed = useCallback((speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    if (isPreview && isLive) {
      LiveSyncService.sendVideoCommand(slideId, 'speed', speed);
    }
  }, [isPreview, isLive, slideId]);

  const setVolume = useCallback((volume: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    if (isPreview && isLive) {
      LiveSyncService.sendVideoCommand(slideId, 'volume', volume);
    }
  }, [isPreview, isLive, slideId]);

  const setMuted = useCallback((muted: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (isPreview && isLive) {
      LiveSyncService.sendVideoCommand(slideId, 'mute', muted);
    }
  }, [isPreview, isLive, slideId]);

  // Master Sync Heartbeat removed to prevent 3s audio artifacts.
  // Drift-aware sync is handled on play/pause and manual seek.

  return {
    videoRef,
    state,
    actions: { play, pause, togglePlayPause, seek, setSpeed, setVolume, setMuted },
  };
}
