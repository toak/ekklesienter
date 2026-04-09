import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Film, Upload, FolderOpen, Scissors, Gauge,
  Volume2, VolumeX, Repeat, Maximize2, Minimize2,
  Clock, Play, Trash2
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { CustomSlider } from '@/components/CustomSlider';
import { ScrubbableInput } from './ScrubbableInput';
import { IVideoSettings, VIDEO_MAX_FILE_SIZE } from '@/core/types';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { db } from '@/core/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from '@/core/utils/toast';
import { IpcService } from '@/core/services/IpcService';
import { ffmpegService } from '@/core/services/FFmpegService';

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

const STRATEGY_OPTIONS: Array<{ value: IVideoSettings['strategy']; label: string; icon: React.ElementType }> = [
  { value: 'auto', label: 'Auto-play', icon: Play },
  { value: 'delay', label: 'Play after delay', icon: Clock },
  { value: 'manual', label: 'Manual', icon: Film },
];

interface IVideoTabContentProps {
  settings: IVideoSettings;
  onUpdate: (updates: Partial<IVideoSettings>) => void;
}

/**
 * Extracts the first frame of a video file as a base64 data URL.
 */
const extractPosterFrame = (videoUrl: string): Promise<string | undefined> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';
    video.src = videoUrl;

    video.addEventListener('loadeddata', () => {
      video.currentTime = 0.1; // Seek slightly past 0 for reliable frame capture
    });

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        } else {
          resolve(undefined);
        }
      } catch {
        resolve(undefined);
      } finally {
        video.src = '';
        video.load();
      }
    });

    video.addEventListener('error', () => resolve(undefined));

    // Timeout fallback
    setTimeout(() => resolve(undefined), 5000);
  });
};

export const VideoTabContent: React.FC<IVideoTabContentProps> = ({ settings, onUpdate }) => {
  const { t } = useTranslation();
  const { openModal } = useModalStore();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isTrimming, setIsTrimming] = useState(false);

  // Resolve media name from DB
  const mediaItem = useLiveQuery(
    async () => settings.mediaId ? await db.mediaPool.get(settings.mediaId) : undefined,
    [settings.mediaId]
  );

  // Generate preview URL
  useEffect(() => {
    if (!settings.mediaId) {
      setPreviewUrl(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const item = await db.mediaPool.get(settings.mediaId!);
      if (cancelled || !item?.data) return;
      const url = URL.createObjectURL(item.data);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    })();

    return () => { cancelled = true; };
  }, [settings.mediaId]);

  /**
   * Import a video from the filesystem.
   */
  const handleImportFile = useCallback(async () => {
    try {
      let file: File | null = null;

      if (IpcService.isElectron()) {
        const files = await IpcService.selectFile({
          filters: [{ name: 'Video', extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv'] }]
        });
        if (!files || files.length === 0) return;
        
        const filePath = files[0];
        const name = filePath.split(/[/\\]/).pop() || 'video.mp4';
        
        const fileData = await IpcService.invoke<{ data: Uint8Array; mimeType: string } | null>('read-file-data', filePath);
        if (!fileData) throw new Error("Failed to read video file data");

        file = new File([new Uint8Array(fileData.data)], name, { type: fileData.mimeType });
      } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        const picked = await new Promise<File | null>((resolve) => {
          input.onchange = () => resolve(input.files?.[0] || null);
          input.click();
        });
        file = picked;
      }

      if (!file) return;

      // Size check
      if (file.size > VIDEO_MAX_FILE_SIZE) {
        toast.error(t('video_too_large', 'Video file exceeds the 500 MB limit'));
        return;
      }

      // Store in media pool
      const mediaId = crypto.randomUUID();
      const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'video/mp4' });

      await db.mediaPool.add({
        id: mediaId,
        name: file.name,
        path: `Imported/${file.name}`,
        type: 'video',
        data: blob,
        createdAt: Date.now(),
      });

      // Extract poster frame
      const tempUrl = URL.createObjectURL(blob);
      const posterFrame = await extractPosterFrame(tempUrl);
      URL.revokeObjectURL(tempUrl);

      onUpdate({ mediaId, posterFrame });
      toast.success(t('video_imported', 'Video imported successfully'));
    } catch (error) {
      console.error('[VideoTabContent] Import failed:', error);
      toast.error(t('video_import_failed', 'Failed to import video'));
    }
  }, [onUpdate, t]);

  /**
   * Select a video from the media pool.
   */
  const handleSelectFromPool = useCallback(() => {
    openModal(ModalType.AUDIO_PICKER, {
      filterType: 'video',
      onSelect: async (mediaId: string) => {
        // Extract poster frame
        const item = await db.mediaPool.get(mediaId);
        let posterFrame: string | undefined;
        if (item?.data) {
          const tempUrl = URL.createObjectURL(item.data);
          posterFrame = await extractPosterFrame(tempUrl);
          URL.revokeObjectURL(tempUrl);
        }
        onUpdate({ mediaId, posterFrame });
      },
    });
  }, [openModal, onUpdate]);

  const handleApplyTrim = useCallback(async () => {
    if (!settings.mediaId || !settings.trimStart || !settings.trimEnd) return;
    
    try {
      setIsTrimming(true);
      toast.info(t('trimming_video_start', 'Trimming video, please wait...'));

      const trimmedBlob = await ffmpegService.trimMediaById(
        settings.mediaId,
        settings.trimStart,
        settings.trimEnd
      );

      if (!trimmedBlob) {
        throw new Error("Failed to trim media");
      }

      // Add as a new trimmed copy to the pool
      const original = await db.mediaPool.get(settings.mediaId);
      const newMediaId = crypto.randomUUID();
      const newName = original ? `${original.name} (Trimmed)` : 'Trimmed Video';

      await db.mediaPool.add({
        id: newMediaId,
        name: newName,
        path: `Trimmed/${newName}`,
        type: 'video',
        data: trimmedBlob,
        createdAt: Date.now(),
      });

      // Extract new poster frame
      const tempUrl = URL.createObjectURL(trimmedBlob);
      const posterFrame = await extractPosterFrame(tempUrl);
      URL.revokeObjectURL(tempUrl);

      // Update slide settings with the new media, resetting the conceptual trim boundaries
      // since the file is physically trimmed now!
      onUpdate({ 
        mediaId: newMediaId, 
        posterFrame,
        trimStart: 0,
        trimEnd: 0
      });

      toast.success(t('video_trimmed_success', 'Video physically trimmed successfully!'));
    } catch (error: any) {
      console.error('[VideoTabContent] Trim failed:', error);
      toast.error(t('video_trim_failed', 'Failed to trim video. Check console.'));
    } finally {
      setIsTrimming(false);
    }
  }, [settings.mediaId, settings.trimStart, settings.trimEnd, onUpdate, t]);

  // ─── No video source yet ────────────────────────────────────────────
  if (!settings.mediaId) {
    return (
      <div className="pb-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center justify-center text-center gap-5 py-10">
          <div className="w-20 h-20 rounded-full bg-white/2 flex items-center justify-center border border-white/5">
            <Film className="w-8 h-8 text-stone-800" strokeWidth={1.5} />
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] text-stone-500 font-black uppercase tracking-[0.2em]">
              {t('no_video_selected', 'No Video Selected')}
            </p>
            <p className="text-[10px] text-stone-700 max-w-[180px] leading-relaxed">
              {t('video_source_hint', 'Import a video file or select one from the media pool')}
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full px-4">
            <button
              type="button"
              onClick={handleImportFile}
              className="w-full flex items-center justify-center gap-2.5 p-4 rounded-2xl bg-accent/10 border border-accent/20 text-accent hover:bg-accent/15 transition-all font-bold text-[11px] uppercase tracking-wider cursor-pointer active:scale-[0.98]"
            >
              <Upload className="w-4 h-4" />
              {t('import_video', 'Import Video File')}
            </button>
            <button
              type="button"
              onClick={handleSelectFromPool}
              className="w-full flex items-center justify-center gap-2.5 p-4 rounded-2xl bg-white/3 border border-white/5 text-stone-400 hover:text-stone-200 hover:bg-white/5 transition-all font-bold text-[11px] uppercase tracking-wider cursor-pointer active:scale-[0.98]"
            >
              <FolderOpen className="w-4 h-4" />
              {t('select_from_pool', 'Select from Media Pool')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Video configured ───────────────────────────────────────────────
  return (
    <div className="pb-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Identity */}
      <div className="flex items-center gap-4 p-5 rounded-3xl bg-black/40 border border-white/5 shadow-inner">
        <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 shadow-lg shadow-accent/5 overflow-hidden shrink-0">
          {settings.posterFrame ? (
            <img src={settings.posterFrame} className="w-full h-full object-cover" alt="" />
          ) : (
            <Film className="w-6 h-6 text-accent" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-stone-500 font-black uppercase tracking-[0.2em] leading-none mb-1.5 px-0.5">
            {t('video_clip', 'Video Clip')}
          </p>
          <h3 className="text-sm font-bold text-white truncate px-0.5">
            {mediaItem?.name || t('unknown_file', 'Unknown File')}
          </h3>
        </div>
        <button
          type="button"
          onClick={handleImportFile}
          className="p-2 text-stone-600 hover:text-stone-300 rounded-xl hover:bg-white/5 transition-all cursor-pointer shrink-0"
          aria-label={t('change_video', 'Change Video')}
        >
          <Upload className="w-4 h-4" />
        </button>
      </div>

      {/* Scaling */}
      <div className="space-y-4 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-accent/40 rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">
            {t('video_scaling', 'Scaling')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['cover', 'contain'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onUpdate({ scaling: mode })}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.97]",
                settings.scaling === mode
                  ? "bg-accent/10 border-accent/30 text-accent"
                  : "bg-black/40 border-white/5 text-stone-500 hover:border-white/10 hover:text-stone-300"
              )}
            >
              {mode === 'cover' ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {mode === 'cover' ? t('cover', 'Fill') : t('contain', 'Fit')}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Playback Strategy */}
      <div className="space-y-4 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-accent/40 rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">
            {t('playback_strategy', 'When Live')}
          </span>
        </div>
        <div className="space-y-2">
          {STRATEGY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdate({ strategy: opt.value })}
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.98]",
                  settings.strategy === opt.value
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-black/40 border-white/5 text-stone-500 hover:border-white/10 hover:text-stone-300"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-[11px] font-bold">{t(`strategy_${opt.value}`, opt.label)}</span>
              </button>
            );
          })}
        </div>

        {/* Delay input */}
        {settings.strategy === 'delay' && (
          <div className="bg-black/40 p-4 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-600 block px-0.5 mb-2">
              {t('delay_seconds', 'Delay (seconds)')}
            </span>
            <ScrubbableInput
              label={t('delay')}
              value={settings.delaySeconds ?? 1}
              onChange={(v) => onUpdate({ delaySeconds: v })}
              min={0.5}
              max={30}
              step={0.5}
              className="bg-stone-900/50 rounded-xl px-3 py-2 border border-white/5"
            />
          </div>
        )}
      </div>

      {/* Speed */}
      <div className="space-y-4 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-accent/40 rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">
            {t('speed', 'Speed')}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onUpdate({ speed: s })}
              className={cn(
                "px-3 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer active:scale-90",
                settings.speed === s
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "bg-black/40 text-stone-500 border border-white/5 hover:text-stone-300 hover:border-white/10"
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Volume */}
      <div className="space-y-4 px-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 bg-accent/40 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">
              {t('volume', 'Volume')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onUpdate({ muted: !settings.muted })}
            className={cn(
              "p-1.5 rounded-lg transition-all active:scale-90 cursor-pointer",
              settings.muted ? "bg-red-500/10 text-red-500" : "text-stone-500 hover:text-stone-300 hover:bg-white/5"
            )}
            aria-label={settings.muted ? t('unmute', 'Unmute') : t('mute', 'Mute')}
          >
            {settings.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className={cn(
          "bg-black/40 p-5 rounded-3xl border border-white/5 transition-opacity",
          settings.muted && "opacity-50 pointer-events-none"
        )}>
          <CustomSlider
            min={0}
            max={1}
            step={0.01}
            value={settings.volume}
            onChange={(v) => onUpdate({ volume: v })}
            formatValue={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      </div>

      {/* Audio Transitions */}
      <div className="space-y-4 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-accent/40 rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">
            {t('audio_transitions', 'Audio Transitions')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-black/40 p-4 rounded-3xl border border-white/5 space-y-3 group hover:border-white/10 transition-colors">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-600 block px-0.5">
              {t('fade_in', 'Fade In')}
            </span>
            <ScrubbableInput
              value={settings.fadeInSeconds ?? 0}
              onChange={(v) => onUpdate({ fadeInSeconds: v })}
              min={0}
              max={10}
              step={0.1}
              className="bg-stone-900/50 rounded-xl px-3 py-2 border border-white/5"
            />
          </div>
          <div className="bg-black/40 p-4 rounded-3xl border border-white/5 space-y-3 group hover:border-white/10 transition-colors">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-600 block px-0.5">
              {t('fade_out', 'Fade Out')}
            </span>
            <ScrubbableInput
              value={settings.fadeOutSeconds ?? 0}
              onChange={(v) => onUpdate({ fadeOutSeconds: v })}
              min={0}
              max={10}
              step={0.1}
              className="bg-stone-900/50 rounded-xl px-3 py-2 border border-white/5"
            />
          </div>
        </div>
      </div>

      {/* Trimming */}
      <div className="space-y-4 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-accent/40 rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">
            <Scissors className="w-3 h-3 inline mr-1.5" />
            {t('trimming', 'Trimming')}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/40 p-4 rounded-3xl border border-white/5 space-y-3 group hover:border-white/10 transition-colors">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-600 block px-0.5">
                {t('trim_start', 'Start')}
              </span>
              <ScrubbableInput
                value={settings.trimStart ?? 0}
                onChange={(v) => onUpdate({ trimStart: v })}
                min={0}
                step={0.1}
                className="bg-stone-900/50 rounded-xl px-3 py-2 border border-white/5"
              />
            </div>
            <div className="bg-black/40 p-4 rounded-3xl border border-white/5 space-y-3 group hover:border-white/10 transition-colors">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-600 block px-0.5">
                {t('trim_end', 'End')}
              </span>
              <ScrubbableInput
                value={settings.trimEnd ?? 0}
                onChange={(v) => onUpdate({ trimEnd: v })}
                min={0}
                step={0.1}
                className="bg-stone-900/50 rounded-xl px-3 py-2 border border-white/5"
              />
            </div>
          </div>
          
          {(settings.trimStart > 0 || settings.trimEnd > 0) && (
            <button
              onClick={handleApplyTrim}
              disabled={isTrimming}
              className={cn(
                "w-full flex items-center justify-center gap-2 p-3 rounded-2xl transition-all font-bold text-[11px] uppercase tracking-wider",
                isTrimming 
                  ? "bg-white/5 text-stone-500 cursor-wait" 
                  : "bg-accent/10 border border-accent/20 text-accent hover:bg-accent/15 cursor-pointer active:scale-[0.98]"
              )}
            >
              <Scissors className={cn("w-4 h-4", isTrimming && "animate-pulse")} />
              {isTrimming ? t('trimming_wait', 'Applying Trim...') : t('apply_physical_trim', 'Apply Physical Trim')}
            </button>
          )}
        </div>
      </div>

      {/* Loop */}
      <div className="space-y-4 px-1">
        <button
          type="button"
          onClick={() => onUpdate({ loop: !settings.loop })}
          className={cn(
            "w-full flex items-center justify-between p-5 rounded-3xl border transition-all active:scale-[0.98] cursor-pointer",
            settings.loop
              ? "bg-accent/10 border-accent/30 text-accent font-bold"
              : "bg-black/40 border-white/5 text-stone-500 hover:border-white/10 hover:text-stone-300"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-xl border transition-colors",
              settings.loop ? "bg-accent/20 border-accent/20" : "bg-white/5 border-white/5"
            )}>
              <Repeat className={cn("w-4 h-4", settings.loop ? "text-accent" : "text-stone-600")} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest">
              {t('loop_playback', 'Loop Playback')}
            </span>
          </div>
          <div className={cn(
            "w-9 h-5 rounded-full relative transition-colors duration-300 flex items-center px-1",
            settings.loop ? "bg-accent" : "bg-stone-800"
          )}>
            <div className={cn(
              "w-3 h-3 rounded-full bg-white transition-all duration-300 shadow-sm",
              settings.loop ? "ml-4" : "ml-0"
            )} />
          </div>
        </button>
      </div>

      {/* Remove Video */}
      <div className="pt-6 border-t border-white/5 px-1">
        <button
          type="button"
          onClick={() => onUpdate({ mediaId: undefined, posterFrame: undefined })}
          className="w-full flex items-center justify-center gap-3 p-5 rounded-3xl bg-red-500/5 border border-red-500/10 text-red-500 hover:bg-red-500/10 hover:border-red-500/20 transition-all font-black uppercase tracking-[0.2em] text-[10px] cursor-pointer group"
        >
          <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
          {t('remove_video', 'Remove Video')}
        </button>
      </div>
    </div>
  );
};
