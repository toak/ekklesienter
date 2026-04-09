import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Volume2, VolumeX, Gauge, Monitor } from 'lucide-react';
import { usePresentationStore } from '../../store/presentationStore';
import { IVideoSlide } from '@/core/types/presentation';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { cn } from '@/core/utils/cn';
import { db } from '@/core/db';
import { useLiveQuery } from 'dexie-react-hooks';

/**
 * Formats seconds into MM:SS or HH:MM:SS display.
 */
const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * LiveMediaToolbar — a control strip at the bottom of the timeline for the
 * currently-live video slide. It does NOT own its own \<video\> element.
 * Instead, it reads state by polling any active video elements in the page
 * and sends commands via LiveSyncService + store updates.
 */
export const LiveMediaToolbar: React.FC = () => {
  const { t } = useTranslation();
  const liveSlideId = usePresentationStore(s => s.liveSlideId);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const speedButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ bottom: 0, right: 0 });
  const scrubberRef = useRef<HTMLDivElement>(null);
  const [isDraggingScrubber, setIsDraggingScrubber] = useState(false);

  // Polled playback state from the actual preview video element
  const [playState, setPlayState] = useState<{
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    buffered: number;
    timestampAtPlay?: number;
  }>({
    isPlaying: false,
    currentTime: 0, // Will be corrected by useEffect when settings load
    duration: 0,
    buffered: 0,
  });

  // Search for the live slide across all presentations in the DB for maximum robustness.
  const liveSlideData = useLiveQuery(async () => {
    if (!liveSlideId) return null;
    const presentations = await db.presentationFiles.toArray();
    for (const p of presentations) {
        const slide = p.slides.find(s => s.id === liveSlideId);
        if (slide) return { slide, presentationId: p.id };
    }
    return null;
  }, [liveSlideId]);

  const liveSlideInfo = liveSlideData?.slide;
  const presentationId = liveSlideData?.presentationId;

  const settings = liveSlideInfo?.type === 'video' ? (liveSlideInfo as IVideoSlide).videoSettings : null;

  // Sync playState.currentTime with settings.trimStart when slide changes or trim changes
  useEffect(() => {
    if (!settings) return;
    const trimStart = settings.trimStart || 0;
    setPlayState(prev => {
      // If we are significantly outside the trim boundaries, reset to trimStart
      const trimEnd = settings.trimEnd || prev.duration || 0;
      if (prev.currentTime < trimStart || (trimEnd > 0 && prev.currentTime > trimEnd)) {
        return { ...prev, currentTime: trimStart };
      }
      return prev;
    });
  }, [settings?.trimStart, settings?.trimEnd, liveSlideId]);

  // ── Poll the actual video element from the preview viewport ───────────────
  // The VideoSlideRenderer mounts a <video> with a data attribute we can locate.
  // This avoids a duplicate hidden <video> element that would fight the real one.
  const findPreviewVideo = useCallback((): HTMLVideoElement | null => {
    if (!liveSlideId) return null;
    const video = document.querySelector<HTMLVideoElement>(`video[data-preview-slide-id="${liveSlideId}"]`);
    if (!video || video.offsetWidth === 0 || video.offsetHeight === 0 || video.closest('[aria-hidden="true"]')) {
      return null;
    }
    return video;
  }, [liveSlideId]);

  // ── Actions that control the projector virtually ───
  const handleTogglePlayPause = useCallback(() => {
    if (!liveSlideId) return;
    
    setPlayState(prev => {
      const trimStart = settings?.trimStart || 0;
      const trimEnd = settings?.trimEnd || prev.duration || 0;
      
      if (prev.isPlaying) {
        // Pausing
        LiveSyncService.sendVideoCommand(liveSlideId, 'pause', prev.currentTime);
        return { ...prev, isPlaying: false };
      } else {
        // Playing
        // If at the end, restart from trimStart
        const isNearEnd = trimEnd > 0 && prev.currentTime >= trimEnd - 0.2;
        const startTime = isNearEnd ? trimStart : prev.currentTime;
        
        LiveSyncService.sendVideoCommand(liveSlideId, 'play', startTime);
        // We set isPlaying: true immediately for UX responsiveness, 
        // but the heartbeat will snap it back if the projector fails to start.
        return { ...prev, isPlaying: true, currentTime: startTime };
      }
    });
  }, [liveSlideId, settings]);

  // ── Sync playState with Actual Media (Preview element or Projector Heartbeat) ──
  useEffect(() => {
    if (!settings || !liveSlideId) return;

    // 1. Listen for ground-truth heartbeats from the Projector
    const unsubStatus = LiveSyncService.onVideoStatus((data) => {
        if (data.slideId !== liveSlideId) return;
        
        setPlayState(prev => {
            // Priority 1: High-FPS local preview (if actually playing and producing non-zero time)
            const video = findPreviewVideo();
            const isLocalActive = video && !video.paused && !video.ended && video.currentTime > 0;
            
            if (isLocalActive) return prev; // Local preview is better for smoothness

            // Priority 2: Projector heartbeat ground-truth
            return {
                ...prev,
                isPlaying: data.isPlaying,
                currentTime: data.currentTime,
                duration: data.duration || prev.duration
            };
        });
    });

    // 2. Poll the local preview video for high-fps smooth updates
    let rafId: number;
    const pollLocalVideo = () => {
        const video = findPreviewVideo();
        if (video) {
            setPlayState(prev => ({
                ...prev,
                isPlaying: !video.paused && !video.ended,
                currentTime: video.currentTime,
                duration: video.duration || prev.duration,
                buffered: video.buffered.length ? video.buffered.end(video.buffered.length - 1) : prev.buffered
            }));
        }
        rafId = requestAnimationFrame(pollLocalVideo);
    };

    rafId = requestAnimationFrame(pollLocalVideo);

    return () => {
        unsubStatus?.();
        cancelAnimationFrame(rafId);
    };
  }, [settings, liveSlideId, findPreviewVideo]);

  // Keyboard Shortcuts: Space to Play/Pause (Interceptor)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      const active = document.activeElement;
      if (active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.getAttribute('contenteditable') === 'true'
      )) {
        return;
      }

      // Spacebar controls ONLY projector via LiveMediaToolbar
      if (e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space') {
        if (liveSlideInfo && liveSlideInfo.type === 'video') {
          e.preventDefault();
          e.stopPropagation();
          handleTogglePlayPause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [liveSlideInfo, liveSlideId, handleTogglePlayPause]);

  const updateVideoSettings = usePresentationStore(s => s.updateVideoSettings);

  const handleSeek = useCallback((time: number) => {
    if (!liveSlideId || !settings) return;
    
    setPlayState(prev => {
      const duration = prev.duration || settings.trimEnd || 1;
      const clampedTime = Math.max(
        settings.trimStart || 0,
        Math.min(time, settings.trimEnd || duration)
      );
      
      LiveSyncService.sendVideoCommand(liveSlideId, 'seek', clampedTime);
      return { ...prev, currentTime: clampedTime, timestampAtPlay: performance.now() };
    });
  }, [liveSlideId, settings]);

  const seekFromScrubber = useCallback((clientX: number) => {
    const el = scrubberRef.current;
    if (!el || !settings) return;
    const rect = el.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const trimStart = settings.trimStart || 0;
    const trimEnd = settings.trimEnd || playState.duration || 1;
    handleSeek(trimStart + fraction * (trimEnd - trimStart));
  }, [settings, playState.duration, handleSeek]);

  const handleScrubberMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingScrubber(true);
    seekFromScrubber(e.clientX);
  }, [seekFromScrubber]);

  useEffect(() => {
    if (!isDraggingScrubber) return;
    const handleMouseMove = (e: MouseEvent) => seekFromScrubber(e.clientX);
    const handleMouseUp = () => setIsDraggingScrubber(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingScrubber, seekFromScrubber]);

  if (!settings || !liveSlideId) return null;

  const trimStart = settings.trimStart || 0;
  const trimEnd = settings.trimEnd && settings.trimEnd > 0 ? settings.trimEnd : (playState.duration || 0);
  const effectiveDuration = Math.max(0, trimEnd - trimStart);
  const displayCurrentTime = Math.max(0, (playState.currentTime || 0) - trimStart);

  const progressFraction = Math.max(0, Math.min(1, 
    effectiveDuration > 0 ? (playState.currentTime - trimStart) / effectiveDuration : 0
  ));

  const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

  const handleSpeedChange = (s: number) => {
    const video = findPreviewVideo();
    if (video) video.playbackRate = s;
    LiveSyncService.sendVideoCommand(liveSlideId, 'speed', s);
    if (presentationId) {
      updateVideoSettings(liveSlideId, { speed: s }, presentationId);
    }
    setShowSpeedMenu(false);
  };

  const handleMuteToggle = () => {
    const newMuted = !settings.muted;
    const video = findPreviewVideo();
    if (video) video.muted = newMuted;
    LiveSyncService.sendVideoCommand(liveSlideId, 'mute', newMuted);
    if (presentationId) {
      updateVideoSettings(liveSlideId, { muted: newMuted }, presentationId);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const video = findPreviewVideo();
    if (video) {
      video.volume = val;
      if (val > 0 && video.muted) {
        video.muted = false;
      }
    }
    LiveSyncService.sendVideoCommand(liveSlideId, 'volume', val);
    if (presentationId) {
      updateVideoSettings(liveSlideId, { volume: val, muted: val === 0 }, presentationId);
    }
    if (val > 0 && settings.muted) {
      LiveSyncService.sendVideoCommand(liveSlideId, 'mute', false);
    }
  };

  return (
    <div className="w-full flex h-12 bg-[#171717] border-t border-[#262626] relative z-20 shrink-0 select-none">
      {/* Track Header (Aligned with main timeline tracks) */}
      <div className="w-20 shrink-0 flex flex-col items-center justify-center gap-0.5 border-r border-[#262626] bg-[#1a1a1a] text-accent/80">
        <Monitor className="w-3.5 h-3.5" />
        <span className="text-[9px] font-bold uppercase tracking-[0.05em]">{t('live', 'Live')}</span>
      </div>

      <div className="flex-1 flex items-center gap-4 px-4 text-stone-300">
        {/* Play/Pause */}
        <button
          onClick={handleTogglePlayPause}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 text-stone-300 hover:text-white transition-colors shrink-0 cursor-pointer"
          aria-label={playState.isPlaying ? t('pause', 'Pause') : t('play', 'Play')}
        >
          {playState.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {/* Time display */}
        <div className="text-[11px] font-mono font-bold tabular-nums shrink-0 mt-0.5 min-w-[70px]">
          <span className="text-stone-100">{formatTime(displayCurrentTime)}</span>
          <span className="text-stone-600 mx-1">/</span>
          <span className="text-stone-400">{formatTime(effectiveDuration)}</span>
        </div>

        {/* Scrubber */}
        <div
          ref={scrubberRef}
          className="group flex-1 h-full flex items-center cursor-pointer relative"
          onMouseDown={handleScrubberMouseDown}
        >
          <div className={cn(
            "w-full h-1.5 bg-white/10 rounded-full relative overflow-visible transition-all",
            isDraggingScrubber ? "h-2" : "group-hover:h-2"
          )}>
            <div
              className="absolute inset-y-0 left-0 bg-white/15 rounded-full"
              style={{ width: `${(playState.buffered / (playState.duration || 1)) * 100}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-accent rounded-full"
              style={{ width: `${progressFraction * 100}%` }}
            />
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-accent rounded-full shadow-lg ring-[1.5px] ring-black/30 transition-all z-10",
                isDraggingScrubber 
                  ? "opacity-100 scale-110" 
                  : "opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
              )}
              style={{ left: `calc(${progressFraction * 100}% - 7px)` }}
            />
          </div>
        </div>

        {/* Speed & Volume Tools */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <div className="relative">
            <button
              ref={speedButtonRef}
              onClick={() => {
                const rect = speedButtonRef.current?.getBoundingClientRect();
                if (rect) {
                  setMenuPosition({ 
                    bottom: window.innerHeight - rect.top + 8,
                    right: window.innerWidth - rect.right
                  });
                }
                setShowSpeedMenu(!showSpeedMenu);
              }}
              className="h-8 px-2 flex items-center gap-1.5 rounded-md hover:bg-white/10 transition-colors text-[11px] font-medium cursor-pointer"
            >
              <Gauge className="w-3.5 h-3.5 opacity-70" />
              {settings.speed}x
            </button>
            {showSpeedMenu && createPortal(
              <div 
                className="fixed bg-[#171717] border border-[#262626] rounded-lg shadow-xl py-1 min-w-[100px] z-100 animate-in fade-in zoom-in-95"
                style={{ 
                  bottom: menuPosition.bottom,
                  right: menuPosition.right
                }}
              >
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSpeedChange(s)}
                    className={cn(
                      "w-auto min-w-[100px] px-3 py-1.5 text-left text-[11px] font-medium transition-colors cursor-pointer block",
                      s === settings.speed ? "text-accent bg-accent/10" : "text-stone-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>

          <div className="flex items-center gap-2 px-1">
            <button
              onClick={handleMuteToggle}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors cursor-pointer"
              aria-label={settings.muted ? t('unmute', 'Unmute') : t('mute', 'Mute')}
            >
              {settings.muted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.muted ? 0 : settings.volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent hover:bg-white/20 transition-colors"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
