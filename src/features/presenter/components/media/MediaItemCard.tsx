import React from 'react';
import { Music, Film, Image as ImageIcon, Play, Pause } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { IMediaItem, MediaType } from '@/core/types';
import { useMediaUrl } from '@/core/hooks/useMediaUrl';

export const THUMB_BG = "bg-stone-900";
export const CARD_BG = "bg-stone-700/40 hover:bg-stone-700/60";
const STRIP_BG = "bg-stone-950/20";

interface MediaItemCardProps {
  item: IMediaItem;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  playingItemId: string | null;
  setPlayingItemId: (id: string | null) => void;
  handleDragStart: (e: React.DragEvent, item: IMediaItem) => void;
  setContextMenu: (menu: { x: number, y: number, kind: 'item', item: IMediaItem }) => void;
  togglePlayback: (e: React.MouseEvent, item: IMediaItem) => void;
  videoRefs: React.MutableRefObject<Record<string, HTMLVideoElement | null>>;
  handleTimeUpdate: (id: string, current: number, duration: number) => void;
  mediaTimes?: { current: number, duration: number };
}

export const MediaItemCard: React.FC<MediaItemCardProps> = React.memo(({
  item, isSelected, onClick, playingItemId, setPlayingItemId, handleDragStart, 
  setContextMenu, togglePlayback, videoRefs, handleTimeUpdate, mediaTimes
}) => {
  const isPlaying = playingItemId === item.id;
  const displayUrl = useMediaUrl(item);

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      draggable
      onClick={onClick}
      onDragStart={(e) => handleDragStart(e, item)}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!isSelected) {
          onClick(e as unknown as React.MouseEvent);
        }
        setContextMenu({ x: e.clientX, y: e.clientY, kind: 'item', item });
      }}
      className={cn(
        "group flex flex-col rounded-md overflow-hidden cursor-grab active:cursor-grabbing transition-all ring-offset-2 ring-offset-stone-900",
        isSelected ? "bg-accent/20 ring-2 ring-accent" : CARD_BG
      )}
    >
      <div className="flex items-center gap-1.5 px-1.5 py-1 min-w-0 border-b border-white/5">
        <TypeIcon type={item.type} className={cn("w-3 h-3 shrink-0", getTypeAccent(item.type))} />
        <span className="text-[10px] text-stone-300 truncate min-w-0 flex-1 font-medium group-hover:text-white">
          {item.name}
        </span>
      </div>

      <div className={cn("relative aspect-video overflow-hidden", THUMB_BG)}>
        {item.type === 'image' && displayUrl && (
          <img src={displayUrl} alt="" className="w-full h-full object-cover" />
        )}

        {item.type === 'video' && displayUrl && (
          <video
            ref={el => { videoRefs.current[item.id] = el; }}
            src={displayUrl}
            muted
            playsInline
            onLoadedMetadata={(e) => handleTimeUpdate(item.id, 0, e.currentTarget.duration)}
            onTimeUpdate={(e) => handleTimeUpdate(item.id, e.currentTarget.currentTime, e.currentTarget.duration)}
            onEnded={() => setPlayingItemId(null)}
            className="w-full h-full object-cover"
          />
        )}

        {item.type === 'audio' && (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-6 h-6 text-purple-500/30" />
          </div>
        )}

        {(item.type === 'video' || item.type === 'audio') && (
          <>
            <button
              type="button"
              onClick={(e) => togglePlayback(e, item)}
              className={cn(
                "absolute inset-0 flex items-center justify-center transition-opacity z-10",
                isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                {isPlaying ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white translate-x-px" />}
              </div>
            </button>

            {mediaTimes && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-20">
                <div 
                  className={cn("h-full transition-all", item.type === 'audio' ? "bg-purple-500" : "bg-accent")}
                  style={{ width: `${(mediaTimes.current / mediaTimes.duration) * 100}%` }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {mediaTimes && (
        <div className={cn("flex items-center justify-end px-1.5 py-0.5", STRIP_BG)}>
          <span className="text-[9px] text-stone-500 tabular-nums font-medium">
            {formatTime(mediaTimes.current)} / {formatTime(mediaTimes.duration)}
          </span>
        </div>
      )}
    </div>
  );
});

export const TypeIcon = ({ type, className }: { type: MediaType; className?: string }) => {
  switch (type) {
    case 'image': return <ImageIcon className={className} />;
    case 'video': return <Film className={className} />;
    case 'audio': return <Music className={className} />;
  }
};

export const getTypeAccent = (type: MediaType) => {
  switch (type) {
    case 'video': return 'text-blue-400';
    case 'audio': return 'text-purple-400';
    case 'image': return 'text-emerald-400';
    default: return 'text-stone-400';
  }
};
