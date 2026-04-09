export type VideoPlaybackStrategy = 'auto' | 'delay' | 'manual';
export type VideoScaling = 'cover' | 'contain';

export interface IVideoSettings {
  /** Media pool ID of the video file */
  mediaId?: string;
  /** How the video fills the slide frame */
  scaling: VideoScaling;
  /** When the video starts playing on going live */
  strategy: VideoPlaybackStrategy;
  /** Seconds to wait before auto-play (only when strategy === 'delay') */
  delaySeconds?: number;
  /** Playback speed multiplier (0.25 to 4.0) */
  speed: number;
  /** Volume level (0 to 1) */
  volume: number;
  /** Whether to loop the video */
  loop: boolean;
  /** Whether the video is muted */
  muted: boolean;
  /** Trim start point in seconds */
  trimStart?: number;
  /** Trim end point in seconds */
  trimEnd?: number;
  /** Cached poster frame as base64 data URL */
  posterFrame?: string;
  /** Audio fade in duration in seconds */
  fadeInSeconds?: number;
  /** Audio fade out duration in seconds */
  fadeOutSeconds?: number;
}

/** Maximum video file size in bytes (500 MB) */
export const VIDEO_MAX_FILE_SIZE = 500 * 1024 * 1024;
