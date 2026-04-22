import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Volume2, VolumeX, Gauge } from 'lucide-react';
import { IVideoSettings } from '@/core/types';
import { useVideoPlayback } from '@/features/presenter/hooks/useVideoPlayback';
import { mediaCache } from '@/core/utils/mediaCache';
import { cn } from '@/core/utils/cn';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';

interface VideoSlideRendererProps {
  slideId: string;
  settings: IVideoSettings;
  isPreview?: boolean;
  isLive?: boolean;
  isPreloading?: boolean;
  isRemote?: boolean;
}

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

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
 * VideoSlideRenderer – Full-screen video player for video slides.
 * Shows floating overlay controls on hover in preview mode only.
 * On the projector, renders a clean, frameless video.
 *
 * NOTE: This component renders inside a 1920×1080 logical canvas that gets
 * CSS-scaled down (~0.3–0.5×). All sizes must be proportioned for 1920×1080.
 */
const VideoSlideRenderer: React.FC<VideoSlideRendererProps> = ({
  slideId,
  settings,
  isPreview = false,
  isLive = false,
  isPreloading = false,
  isRemote = false,
}) => {
  const { t } = useTranslation();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const speedButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ bottom: 0, right: 0 });
  const scrubberRef = useRef<HTMLDivElement>(null);
  const [isDraggingScrubber, setIsDraggingScrubber] = useState(false);

  // Local display state polled from the video element directly
  // to guarantee updates even if hook events lag behind
  const [localPlaying, setLocalPlaying] = useState(false);
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [localDuration, setLocalDuration] = useState(0);

  // Projector-side overrides: when the toolbar sends volume/mute/speed
  // commands via IPC, we store them here so the hook's fade calculation
  // uses the actual commanded values instead of the stale prop settings.
  const [projectorOverrides, setProjectorOverrides] = useState<Partial<typeof settings>>({});
  const effectiveSettings = isPreview ? settings : { ...settings, ...projectorOverrides };

  const { videoRef, state, actions } = useVideoPlayback({
    settings: effectiveSettings,
    isPreview,
    isLive,
    isPreloading,
    slideId,
    isRemote,
  });


  const mediaMetadata = useLiveQuery(async () => {
    if (isRemote || !settings.mediaId) return null;
    const item = await db.mediaPool.get(settings.mediaId);
    if (item) return { name: item.name };
    const bg = await db.backgrounds.get(settings.mediaId);
    if (bg) return { name: bg.name };
    return null;
  }, [settings.mediaId, isRemote]);

  // Poll the video element directly for reliable state display
  useEffect(() => {
    if (!isPreview) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      setLocalPlaying(!video.paused && !video.ended);
      setLocalCurrentTime(video.currentTime);
      if (video.duration && isFinite(video.duration)) {
        setLocalDuration(video.duration);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isPreview, videoRef]);

  const handleActivity = useCallback(() => {
    if (!isPreview) return;
    setShowControls(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShowControls(false);
      setShowSpeedMenu(false);
    }, 3000);
  }, [isPreview]);

  useEffect(() => {
    if (!isPreview) return;
    window.addEventListener('mousemove', handleActivity);
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPreview, handleActivity]);

  // Resolve video URL from media pool
  useEffect(() => {
    if (!settings.mediaId) {
      setVideoUrl(null);
      return;
    }
    let cancelled = false;
    mediaCache.getBackgroundUrl(settings.mediaId).then((url) => {
      if (!cancelled) setVideoUrl(url);
    });
    return () => { cancelled = true; };
  }, [settings.mediaId]);

  // Listen for video commands from the editor (projector side)
  useEffect(() => {
    if (isPreview) return;
    const unsub = LiveSyncService.onVideoCommand((data) => {
      if (data.slideId !== slideId) return;
      const video = videoRef.current;
      if (!video) return;
      const trimStart = settings.trimStart || 0;
      const trimEnd = settings.trimEnd || video.duration || 0;

      switch (data.command) {
        case 'play':
          if (typeof data.value === 'number') {
            const clampedValue = Math.max(trimStart, Math.min(data.value, trimEnd > 0 ? trimEnd : video.duration));
            const drift = Math.abs(video.currentTime - clampedValue);
            if (drift > 0.2) video.currentTime = clampedValue;
          }
          video.play().catch(() => {});
          break;
        case 'pause':
          if (typeof data.value === 'number') {
            const clampedValue = Math.max(trimStart, Math.min(data.value, trimEnd > 0 ? trimEnd : video.duration));
            const drift = Math.abs(video.currentTime - clampedValue);
            if (drift > 0.2) video.currentTime = clampedValue;
          }
          video.pause();
          break;
        case 'toggle':
          if (video.paused) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
          break;
        case 'seek':
          if (typeof data.value === 'number') {
            const clampedValue = Math.max(trimStart, Math.min(data.value, trimEnd > 0 ? trimEnd : video.duration));
            const drift = Math.abs(video.currentTime - clampedValue);
            if (drift > 0.2) video.currentTime = clampedValue;
          }
          break;
        case 'speed':
          if (typeof data.value === 'number') {
            video.playbackRate = data.value;
            setProjectorOverrides(prev => ({ ...prev, speed: data.value as number }));
          }
          break;
        case 'volume':
          if (typeof data.value === 'number') {
            video.volume = data.value;
            setProjectorOverrides(prev => ({ ...prev, volume: data.value as number }));
          }
          break;
        case 'mute':
          if (typeof data.value === 'boolean') {
            video.muted = data.value;
            setProjectorOverrides(prev => ({ ...prev, muted: data.value as boolean }));
          }
          break;
      }
    });
    return () => { unsub?.(); };
  }, [isPreview, slideId, videoRef]);

  // Projector heartbeat: Send actual playback status back to the controller
  // This provides the "ground truth" for the LiveMediaToolbar.
    const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

    const sendStatus = useCallback(() => {
        const video = videoElement || videoRef.current;
        if (!video || !isLive) return;

        const status = {
            slideId,
            currentTime: video.currentTime,
            isPlaying: !video.paused,
            duration: (isFinite(video.duration) && video.duration > 0) ? video.duration : 0
        };

        if (status.duration > 0 || Math.random() < 0.05) {
            console.info('📽️ [Projector] Sending status:', status);
        }

        LiveSyncService.sendVideoStatus(
            status.slideId,
            status.currentTime,
            status.isPlaying,
            status.duration
        );
    }, [slideId, isLive, videoElement, videoRef]);

    // Projector heartbeat: Send actual playback status back to the controller
    // This provides the "ground truth" for the LiveMediaToolbar.
    useEffect(() => {
        if (isPreview || !isLive || isPreloading) return;

        const video = videoElement || videoRef.current;
        if (video) {
            video.addEventListener('play', sendStatus);
            video.addEventListener('pause', sendStatus);
            video.addEventListener('seeked', sendStatus);
            video.addEventListener('loadedmetadata', sendStatus);
            video.addEventListener('durationchange', sendStatus);
            video.addEventListener('canplay', sendStatus);
            
            // Periodic heartbeat - Increased frequency for diagnostics
            const interval = setInterval(sendStatus, 150);
            
            // Listen for manual pull requests from the controller
            const unsubRequest = LiveSyncService.onVideoStatusRequest(() => {
                sendStatus();
            });

            // Immediate report in case metadata is already loaded
            if (video.readyState >= 1) sendStatus();

            return () => {
                video.removeEventListener('play', sendStatus);
                video.removeEventListener('pause', sendStatus);
                video.removeEventListener('seeked', sendStatus);
                video.removeEventListener('loadedmetadata', sendStatus);
                video.removeEventListener('durationchange', sendStatus);
                video.removeEventListener('canplay', sendStatus);
                if (interval) clearInterval(interval);
                unsubRequest();
                
                // Final status report to clear playing state on master/remote
                LiveSyncService.sendVideoStatus(
                    slideId, 
                    video.currentTime, 
                    false, 
                    video.duration || 0
                );
            };
        }
    }, [isPreview, isLive, isPreloading, slideId, videoElement, videoRef, sendStatus]);

  // Scrubber seek helper
  const seekFromScrubber = useCallback((clientX: number) => {
    const el = scrubberRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const trimStart = settings.trimStart || 0;
    const dur = localDuration || state.duration;
    const trimEnd = settings.trimEnd || dur;
    const targetTime = trimStart + fraction * (trimEnd - trimStart);
    actions.seek(targetTime);
  }, [settings.trimStart, settings.trimEnd, localDuration, state.duration, actions]);

  // Scrubber mouse-down for drag
  const handleScrubberMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingScrubber(true);
    seekFromScrubber(e.clientX);
  }, [seekFromScrubber]);

  // Scrubber drag via window events
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

  // Use local polled values with hook fallback
  const isPlaying = localPlaying || state.isPlaying;
  const currentTime = localCurrentTime || state.currentTime;
  const duration = localDuration || state.duration;

  // Derived display values
  const trimStart = settings.trimStart || 0;
  const trimEnd = settings.trimEnd && settings.trimEnd > 0 ? settings.trimEnd : duration;
  const effectiveDuration = Math.max(0, trimEnd - trimStart);
  const displayCurrentTime = Math.max(0, currentTime - trimStart);

  const progressFraction = useMemo(() => {
    if (effectiveDuration <= 0) return 0;
    return Math.max(0, Math.min(1, (currentTime - trimStart) / effectiveDuration));
  }, [currentTime, trimStart, effectiveDuration]);

  const bufferedFraction = useMemo(() => {
    const dur = duration || 1;
    return Math.max(0, Math.min(1, (state.buffered || 0) / dur));
  }, [state.buffered, duration]);

  const hasVideoSource = !!settings.mediaId && !!videoUrl;

  // Close speed menu on click outside
  useEffect(() => {
    if (!showSpeedMenu) return;
    const handler = (e: MouseEvent) => {
      if (speedButtonRef.current?.contains(e.target as Node)) return;
      setShowSpeedMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSpeedMenu]);

  if (!hasVideoSource) {
    return (
      <div className={cn(
        "w-full h-full flex items-center justify-center bg-transparent",
        isPreloading && "opacity-0 pointer-events-none invisible"
      )}>
        <div className="flex flex-col items-center gap-3 text-stone-600">
          <Play className="w-16 h-16 opacity-20" />
          <p className="text-sm font-medium">{t('video_no_source', 'No video selected')}</p>
          {isPreview && (
            <p className="text-xs text-stone-700">{t('video_select_hint', 'Open the Design Panel → Video tab to select a source')}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full bg-black group/video overflow-hidden pointer-events-auto"
      onMouseEnter={handleActivity}
      onMouseMove={handleActivity}
    >
      <video
        ref={(el) => {
            // Bridge to the hook's ref
            if (typeof videoRef === 'object' && videoRef) {
                (videoRef as any).current = el;
            }
            // Trigger local state for heartbeat setup
            if (el !== videoElement) setVideoElement(el);
        }}
        src={videoUrl}
        data-preview-slide-id={slideId}
        className={cn(
          "w-full h-full",
          settings.scaling === 'contain' ? 'object-contain' : 'object-cover'
        )}
        playsInline
        preload="auto"
        onClick={() => isPreview && !isRemote && actions.togglePlayPause()}
        style={{ cursor: isPreview && !isRemote ? 'pointer' : 'default' }}
      />

      {isPreview && !isRemote && (
        <>
          {/* Controls Overlay */}
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 z-30 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-auto flex justify-center px-12 pb-16",
              showControls ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 pointer-events-none"
            )}
            onClick={(e) => { e.stopPropagation(); handleActivity(); }}
          >
            {/* Gradient backdrop */}
            <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/25 to-transparent pointer-events-none h-80 mt-auto" />

            {/* Floating Control Bar — sized for 1920×1080 canvas */}
            <div className={cn(
              "relative w-full max-w-5xl flex flex-col gap-8 px-12 py-8 rounded-3xl shadow-2xl",
              "bg-stone-900/40 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5"
            )}>
              {/* Media Info / Name */}
              {mediaMetadata?.name && (
                <div className="flex items-center gap-4 -mb-2">
                  <div className="px-3 py-1 rounded-lg bg-accent/20 border border-accent/30 text-accent text-[12px] font-black uppercase tracking-wider">
                    Video
                  </div>
                  <span className="text-2xl font-bold text-stone-100 truncate flex-1 uppercase tracking-tight font-mono">
                    {mediaMetadata.name}
                  </span>
                </div>
              )}

              {/* Scrubber — large hit area */}
              <div
                ref={scrubberRef}
                className={cn(
                  "group w-full h-3 bg-white/10 rounded-full cursor-pointer relative overflow-visible transition-all",
                  isDraggingScrubber ? "h-4" : "hover:h-4"
                )}
                onMouseDown={handleScrubberMouseDown}
              >
                {/* Buffered */}
                <div
                  className="absolute inset-y-0 left-0 bg-white/15 rounded-full transition-[width] duration-300 ease-out"
                  style={{ width: `${bufferedFraction * 100}%` }}
                />
                {/* Progress */}
                <div
                  className="absolute inset-y-0 left-0 bg-accent rounded-full transition-[width] duration-150 ease-out"
                  style={{ width: `${progressFraction * 100}%` }}
                />
                {/* Knob */}
                <div
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-accent rounded-full shadow-lg ring-2 ring-black/30 transition-all z-10",
                    isDraggingScrubber
                      ? "opacity-100 scale-110"
                      : "opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
                  )}
                  style={{ left: `calc(${progressFraction * 100}% - 12px)` }}
                />
              </div>

              {/* Controls Row */}
              <div className="flex items-center gap-6">
                {/* Play/Pause — Accent themed, large */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.togglePlayPause();
                  }}
                  className={cn(
                    "w-20 h-20 flex items-center justify-center rounded-2xl transition-all active:scale-90 cursor-pointer shrink-0",
                    "bg-accent/20 text-accent ring-1 ring-accent/30 hover:bg-accent/30"
                  )}
                  aria-label={isPlaying ? t('pause', 'Pause') : t('play', 'Play')}
                >
                  {isPlaying ? (
                    <Pause className="w-10 h-10" />
                  ) : (
                    <Play className="w-10 h-10 ml-1" />
                  )}
                </button>

                {/* Time display — large mono text */}
                <div className="font-mono font-bold tabular-nums shrink-0 min-w-[160px]">
                  <span className="text-2xl text-stone-100">{formatTime(displayCurrentTime)}</span>
                  <span className="text-xl text-stone-600 mx-2">/</span>
                  <span className="text-xl text-stone-400">{formatTime(effectiveDuration)}</span>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Speed */}
                <div className="relative">
                  <button
                    ref={speedButtonRef}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = speedButtonRef.current?.getBoundingClientRect();
                      if (rect) {
                        setMenuPosition({
                          bottom: window.innerHeight - rect.top + 8,
                          right: window.innerWidth - rect.right,
                        });
                      }
                      setShowSpeedMenu(prev => !prev);
                      handleActivity();
                    }}
                    className={cn(
                      "h-16 px-6 flex items-center gap-3 rounded-2xl transition-all font-bold cursor-pointer",
                      showSpeedMenu
                        ? "bg-accent/20 text-accent ring-1 ring-accent/30"
                        : "text-stone-400 hover:text-stone-100 hover:bg-white/5"
                    )}
                  >
                    <Gauge className="w-7 h-7" />
                    <span className="text-lg">{settings.speed}x</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="w-px h-10 bg-white/10 shrink-0" />

                {/* Volume */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.setVolume(settings.muted ? settings.volume : 0);
                    }}
                    className="w-16 h-16 flex items-center justify-center rounded-2xl text-stone-400 hover:text-stone-100 hover:bg-white/5 transition-all cursor-pointer"
                    aria-label={settings.muted ? t('unmute', 'Unmute') : t('mute', 'Mute')}
                  >
                    {settings.muted || settings.volume === 0 ? (
                      <VolumeX className="w-8 h-8 text-red-400" />
                    ) : (
                      <Volume2 className="w-8 h-8" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settings.muted ? 0 : settings.volume}
                    onChange={(e) => {
                      e.stopPropagation();
                      actions.setVolume(parseFloat(e.target.value));
                    }}
                    className="w-32 h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent hover:bg-white/20 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Speed menu — Portal-based */}
          {showSpeedMenu && createPortal(
            <div
              className="fixed bg-stone-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl py-2 min-w-[140px] z-9999 animate-in fade-in zoom-in-95 duration-150"
              style={{
                bottom: menuPosition.bottom,
                right: menuPosition.right,
              }}
            >
              <div className="px-4 py-2 border-b border-white/5 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                  {t('playback_speed', 'Speed')}
                </span>
              </div>
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { actions.setSpeed(s); setShowSpeedMenu(false); }}
                  className={cn(
                    "w-full px-4 py-2 text-left text-sm font-medium transition-colors cursor-pointer block",
                    s === settings.speed ? "text-accent bg-accent/10" : "text-stone-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>,
            document.body
          )}
        </>
      )}

      {/* Center play icon when paused and controls hidden */}
      {/* Play Icon - Persistently shown on remote or when paused in preview */}
      {isPreview && (isRemote || (!isPlaying && !showControls)) && videoUrl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 animate-in fade-in duration-500">
          <div className="w-40 h-40 rounded-3xl bg-stone-900/40 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 flex items-center justify-center shadow-2xl">
            <Play className="w-16 h-16 text-accent ml-2" />
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(VideoSlideRenderer);
