import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Volume2, VolumeX, Gauge, Monitor, Music, SkipBack, SkipForward, Circle } from 'lucide-react';
import { usePresentationStore } from '../../store/presentationStore';
import { IVideoSlide, ISlide } from '@/core/types/presentation';
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
 * Currently-live video slide. It does NOT own its own <video> element.
 * Instead, it reads state ONLY from the projector's periodic heartbeat.
 */
export interface LiveMediaToolbarProps {
  liveSlide?: ISlide;
  presentationId?: string;
}

export const LiveMediaToolbar: React.FC<LiveMediaToolbarProps> = ({ 
  liveSlide: propLiveSlide, 
  presentationId: propPresentationId 
}) => {
  const { t } = useTranslation();
  const liveSlideId = usePresentationStore(s => s.liveSlideId);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const speedButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ bottom: 0, right: 0 });
  const scrubberRef = useRef<HTMLDivElement>(null);
  const [isDraggingScrubber, setIsDraggingScrubber] = useState(false);
  const lastInteractionRef = useRef<number>(0);

  // Polled playback state from the actual preview video element
  const [playState, setPlayState] = useState<{
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    buffered: number;
    timestampAtPlay?: number;
  }>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
  });
  
  const [audioStatus, setAudioStatus] = useState<{
    scopeId: string;
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    fileId: string;
  } | null>(null);

  // Optimization: Prefer passed props if available, otherwise fallback to DB query
  const liveSlideData = useLiveQuery(async () => {
    if (propLiveSlide && propPresentationId) return { slide: propLiveSlide, presentationId: propPresentationId };
    if (!liveSlideId) return null;
    const presentations = await db.presentationFiles.toArray();
    for (const p of presentations) {
        const slide = p.slides.find(s => s.id === liveSlideId);
        if (slide) return { slide, presentationId: p.id };
    }
    return null;
  }, [liveSlideId, propLiveSlide?.id, propPresentationId]);

  const liveSlideInfo = liveSlideData?.slide || propLiveSlide;
  const presentationId = liveSlideData?.presentationId || propPresentationId;

  const settings = liveSlideInfo?.type === 'video' ? (liveSlideInfo as IVideoSlide).videoSettings : null;

  // Keep a ref to the latest settings so the high-frequency poll loop always has up-to-date
  // trim boundaries without requiring the effect to restart on every reference change.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Sync playState.currentTime with settings.trimStart when slide changes or trim changes
  useEffect(() => {
    if (!settings) return;
    const trimStart = settings.trimStart || 0;
    setPlayState(prev => {
      // If we are significantly outside the trim boundaries, reset to trimStart
      // Safety: Only reset if we actually have a duration, or if we are at 0 when trimStart is > 0
      const trimEnd = settings.trimEnd || prev.duration || 0;
      if (prev.currentTime < trimStart || (trimEnd > 0 && prev.currentTime > trimEnd)) {
        return { ...prev, currentTime: trimStart };
      }
      return prev;
    });
  }, [settings?.trimStart, settings?.trimEnd, liveSlideId]);

  // Reset playState completely when the live slide ID changes to avoid stale data
  useEffect(() => {
    if (liveSlideId) {
      setPlayState({
        isPlaying: false,
        currentTime: settings?.trimStart || 0,
        duration: 0,
        buffered: 0,
      });
    }
  }, [liveSlideId]);

  // Audio Status Listener
  useEffect(() => {
    const unsub = LiveSyncService.onAudioStatus((data) => {
        // Optimistic UI: Ignore status if we've interacted recently
        if (performance.now() - lastInteractionRef.current < 1000) return;

        if (!data.scopeId) {
            setAudioStatus(null);
        } else {
            setAudioStatus(data);
        }
    });
    return () => unsub();
  }, []);

  const isAudioMode = !settings && !!audioStatus;
  const activePlayState = isAudioMode ? {
    isPlaying: audioStatus!.isPlaying,
    currentTime: audioStatus!.currentTime,
    duration: audioStatus!.duration,
    buffered: 0
  } : playState;



  // ── Actions that control the projector virtually ───
  const handleTogglePlayPause = useCallback(() => {
    // 1. TIMER SLIDE: Redirect toggle to the timer core (which syncs audio automatically)
    const isTimerSlide = liveSlideInfo?.type === 'timer';
    if (isTimerSlide && liveSlideId) {
        lastInteractionRef.current = performance.now();
        LiveSyncService.sendTimerCommand(liveSlideId, 'toggle');
        return;
    }

    if (isAudioMode && audioStatus) {
        lastInteractionRef.current = performance.now();
        setAudioStatus(prev => prev ? { ...prev, isPlaying: !prev.isPlaying } : null);
        LiveSyncService.sendAudioCommand(audioStatus.scopeId, 'toggle');
        return;
    }

    if (!liveSlideId) return;
    
    lastInteractionRef.current = performance.now();
    setPlayState(prev => {
      const s = settingsRef.current;
      const trimStart = s?.trimStart || 0;
      const trimEnd = s?.trimEnd || prev.duration || 0;
      
      const isCurrentlyPlaying = prev.isPlaying;

      if (isCurrentlyPlaying) {
        // Pausing
        LiveSyncService.sendVideoCommand(liveSlideId, 'pause', prev.currentTime);
        return { ...prev, isPlaying: false };
      } else {
        // Playing
        // If at the end, restart from trimStart
        const isNearEnd = trimEnd > 0 && prev.currentTime >= trimEnd - 0.2;
        const startTime = isNearEnd ? trimStart : prev.currentTime;
        
        LiveSyncService.sendVideoCommand(liveSlideId, 'play', startTime);
        return { ...prev, isPlaying: true, currentTime: startTime };
      }
    });
  }, [liveSlideId, isAudioMode, audioStatus]);

  // ── Sync playState with Projector Heartbeat (ground truth) ──
  // The LiveMediaToolbar is fully independent from the preview viewport.
  // It reads state ONLY from the projector's periodic heartbeat.
  useEffect(() => {
    if (!liveSlideId) return;

    const unsubStatus = LiveSyncService.onVideoStatus((data) => {
        // Optimistic UI: Ignore status if we've interacted recently
        if (performance.now() - lastInteractionRef.current < 1000) return;

        // Diagnostic Log
        if (data.duration > 0 || Math.random() < 0.05) { // Log every valid duration, of 5% of all heartbeats
          console.info('🎛️ [Toolbar] Received status:', data);
        }

        // Relaxed ID check: If we have a liveSlideId, we expect a match,
        // but since only the 'live' project slide sends status (isLive=true),
        // we can be more permissive.
        if (data.slideId && liveSlideId && data.slideId !== liveSlideId) {
            const shortDataId = String(data.slideId).substring(0, 8);
            const shortLiveId = String(liveSlideId).substring(0, 8);
            
            if (shortDataId !== shortLiveId) {
                return;
            }
        }
        
        setPlayState(prev => {
            const hasNewDuration = data.duration && isFinite(data.duration) && data.duration > 0;
            return {
                ...prev,
                isPlaying: data.isPlaying,
                currentTime: data.currentTime,
                duration: hasNewDuration ? data.duration : prev.duration
            };
        });
    });

    // Request initial status immediately on mount
    LiveSyncService.requestVideoStatus();
    LiveSyncService.sendAudioCommand('', 'request-status' as any);

    return () => {
        unsubStatus?.();
    };
  }, [!!settings, liveSlideId]);

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

      // Spacebar toggles whatever media is currently active (Video or Audio)
      if (e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space') {
        if (!!settings || isAudioMode) {
          e.preventDefault();
          e.stopPropagation();
          handleTogglePlayPause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [settings, isAudioMode, handleTogglePlayPause]);

  const updateVideoSettings = usePresentationStore(s => s.updateVideoSettings);

  const handleSeek = useCallback((time: number) => {
    lastInteractionRef.current = performance.now();
    
    if (isAudioMode && audioStatus) {
        setAudioStatus(prev => prev ? { ...prev, currentTime: time } : null);
        LiveSyncService.sendAudioCommand(audioStatus.scopeId, 'seek', time);
        return;
    }

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
  }, [liveSlideId, settings, isAudioMode, audioStatus]);

  const seekFromScrubber = useCallback((clientX: number) => {
    const el = scrubberRef.current;
    if (!el) return;
    
    // Safety: we Need either a video slide with settings OR an active audio clip
    if (!settings && !isAudioMode) return;

    const rect = el.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    
    if (isAudioMode && audioStatus) {
        const time = fraction * audioStatus.duration;
        handleSeek(time);
    } else if (settings) {
        const trimStart = settings.trimStart || 0;
        const trimEnd = settings.trimEnd || playState.duration || 1;
        handleSeek(trimStart + fraction * (trimEnd - trimStart));
    }
  }, [settings, isAudioMode, audioStatus, playState.duration, handleSeek]);

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

  // Note: We no longer return null here to keep the toolbar always visible in the layout
  // if (!settings && !isAudioMode) return null;

  const hasPlaylist = (liveSlideInfo?.type === 'timer' && !!(liveSlideInfo as any).playlist?.length) || 
                     (liveSlideInfo?.type === 'normal' && !!(liveSlideInfo as any).timerSettings?.playlist?.length);

  const hasMedia = !!settings || isAudioMode || hasPlaylist || liveSlideInfo?.type === 'timer';

  const handlePlaylistNext = useCallback(() => {
    if (liveSlideId) LiveSyncService.sendPlaylistCommand(liveSlideId, 'next');
  }, [liveSlideId]);

  const handlePlaylistPrev = useCallback(() => {
    if (liveSlideId) LiveSyncService.sendPlaylistCommand(liveSlideId, 'prev');
  }, [liveSlideId]);

  const trimStart = settings?.trimStart || 0;
  const trimEnd = (isAudioMode ? audioStatus?.duration : (settings?.trimEnd && settings.trimEnd > 0 ? settings.trimEnd : (playState.duration || 0))) || 0;
  const effectiveDuration = Math.max(0, trimEnd - trimStart);
  const displayCurrentTime = hasMedia ? Math.max(0, (activePlayState.currentTime || 0) - trimStart) : 0;

  const scrubberRefValue = isAudioMode ? (audioStatus?.duration || 0) : (playState.duration || settings?.trimEnd || 0);

  const progressFraction = Math.max(0, Math.min(1, 
    (hasMedia && effectiveDuration > 0) ? (activePlayState.currentTime - trimStart) / effectiveDuration : 0
  ));

  const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

  const handleSpeedChange = (s: number) => {
    LiveSyncService.sendVideoCommand(liveSlideId, 'speed', s);
    if (presentationId) {
      updateVideoSettings(liveSlideId, { speed: s }, presentationId);
    }
    setShowSpeedMenu(false);
  };

  const handleMuteToggle = () => {
    if (!settings) return; // Mute for audio not implemented via this bridge
    const newMuted = !settings.muted;
    LiveSyncService.sendVideoCommand(liveSlideId, 'mute', newMuted);
    if (presentationId) {
      updateVideoSettings(liveSlideId, { muted: newMuted }, presentationId);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!settings) return;
    const val = parseFloat(e.target.value);
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
      <div className={cn(
        "w-20 shrink-0 flex flex-col items-center justify-center gap-0.5 border-r border-[#262626] bg-[#1a1a1a] transition-colors",
        isAudioMode ? "text-amber-500/80" : "text-accent/80"
      )}>
        {isAudioMode ? <Music className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
        <span className="text-[9px] font-bold uppercase tracking-[0.05em] opacity-80">
          {isAudioMode ? t('audio', 'Audio') : t('live', 'Live')}
        </span>
      </div>

      <div className={cn(
        "flex-1 flex items-center gap-4 px-4 transition-all duration-500",
        hasMedia ? "text-stone-300 opacity-100" : "text-stone-600 opacity-40 grayscale pointer-events-none"
      )}>
        {/* Name / Metadata - Removed audio filename per user request */}
        {!hasMedia && (
            <div className="flex items-center gap-2 shrink-0">
                <div className="w-px h-3 bg-white/5" />
            </div>
        )}
        {/* Play/Pause Group */}
        <div className="flex items-center gap-0.5 shrink-0">
          {hasPlaylist && (
            <button
              onClick={handlePlaylistPrev}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-stone-400 hover:text-white transition-colors cursor-pointer"
              title={t('prev_track', 'Previous Track')}
            >
              <SkipBack className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
          
          <button
            onClick={handleTogglePlayPause}
            className={cn(
                "w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors cursor-pointer",
                activePlayState.isPlaying ? "text-accent" : "text-stone-300 hover:text-white"
            )}
            aria-label={activePlayState.isPlaying ? t('pause', 'Pause') : t('play', 'Play')}
          >
            {activePlayState.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
          </button>

          {hasPlaylist && (
            <button
              onClick={handlePlaylistNext}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-stone-400 hover:text-white transition-colors cursor-pointer"
              title={t('next_track', 'Next Track')}
            >
              <SkipForward className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
        </div>

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
              style={{ width: `${(activePlayState.buffered / (isAudioMode ? (audioStatus?.duration || 1) : (playState.duration || 1))) * 100}%` }}
            />
            <div
              className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  isAudioMode ? "bg-amber-500" : "bg-accent"
              )}
              style={{ width: `${progressFraction * 100}%` }}
            />
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full shadow-lg ring-[1.5px] ring-black/30 transition-all z-10",
                isAudioMode ? "bg-amber-500" : "bg-accent",
                isDraggingScrubber 
                  ? "opacity-100 scale-110" 
                  : "opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
              )}
              style={{ left: `calc(${progressFraction * 100}% - 7px)` }}
            />
          </div>
        </div>

        {/* Speed & Volume Tools (Hide speed for audio mode for now as it's less common) */}
        {!isAudioMode && (
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
                {settings?.speed}x
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
                        s === (settings?.speed || 1) ? "text-accent bg-accent/10" : "text-stone-400 hover:text-white hover:bg-white/5"
                        )}
                    >
                        {s}x
                    </button>
                    ))}
                </div>,
                document.body
                )}
            </div>
            </div>
        )}

        <div className="flex items-center gap-2 px-1">
          <button
            onClick={handleMuteToggle}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors cursor-pointer"
            aria-label={settings?.muted ? t('unmute', 'Unmute') : t('mute', 'Mute')}
          >
            {settings?.muted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {!isAudioMode && (
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings?.muted ? 0 : (settings?.volume ?? 1)}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent hover:bg-white/20 transition-colors"
              />
          )}
        </div>
      </div>
    </div>
  );
};
