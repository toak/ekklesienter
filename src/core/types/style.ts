export type BackgroundType = 'color' | 'gradient' | 'image' | 'video';
export type MediaSource = 'unsplash' | 'pexels' | 'local' | 'youtube';

export interface IStyleLayer {
  id: string;
  type: 'color' | 'gradient' | 'image' | 'video' | 'noise';
  visible: boolean;
  opacity: number; // 0-1
  blendMode: string; // CSS mix-blend-mode values
  color?: string;
  gradient?: {
    type?: 'linear' | 'radial' | 'conic';
    from: string;
    to: string;
    angle: number;
    cssGradient?: string;
    stops?: { offset: number; color: string }[];
  };
  image?: {
    url: string;
    source: MediaSource;
    id?: string;
    alt?: string;
    author?: string;
    isFromDb?: boolean;
  };
  video?: {
    url: string;
    source: MediaSource;
    id?: string;
    thumbnail?: string;
    isMuted: boolean;
    isLooping: boolean;
    isFromDb?: boolean;
  };
  adjustments?: {
    brightness: number;
    contrast: number;
    exposure: number;
    saturation: number;
    vibrance: number;
    hue: number;
    blur: number;
    dimmingColor?: string;
    dimmingOpacity?: number; // 0-1
  };
  media?: {
    speed?: number;
    isLooping?: boolean;
    isMuted?: boolean;
    framing?: 'fit' | 'fill' | 'tile' | 'stretch';
    scale?: number; // For manual zoom
  };
}

export interface BackgroundSettings {
  type: BackgroundType;
  color?: string;
  gradient?: {
    from: string;
    to: string;
    angle: number;
    cssGradient?: string; // Full CSS gradient string for multi-stop gradients
  };
  image?: {
    url: string;
    source: MediaSource;
    id?: string;
    alt?: string;
    author?: string;
    isFromDb?: boolean;
  };
  video?: {
    url: string;
    source: MediaSource;
    id?: string;
    thumbnail?: string;
    isMuted: boolean;
    isLooping: boolean;
    isFromDb?: boolean;
  };
  blur?: number;
}
