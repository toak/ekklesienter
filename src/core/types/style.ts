export type BackgroundType = 'color' | 'gradient' | 'image' | 'video';
export type MediaSource = 'unsplash' | 'pexels' | 'local' | 'youtube';

export interface IStyleLayer {
  id: string;
  type: 'color' | 'gradient' | 'image' | 'video' | 'noise';
  visible: boolean;
  opacity: number; // 0-1
  blendMode: string; // CSS mix-blend-mode values
  width?: number; // Optional width for stroke layers
  alignment?: 'inside' | 'center' | 'outside';
  lineJoin?: 'round' | 'bevel' | 'miter';
  lineCap?: 'butt' | 'round' | 'square';
  dashArray?: string;
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
    crop?: {
      x: number;      // % from left (0-100)
      y: number;      // % from top (0-100)
      width: number;  // % of width (0-100)
      height: number; // % of height (0-100)
    };
  };
  video?: {
    url: string;
    source: MediaSource;
    id?: string;
    thumbnail?: string;
    thumbnailSequence?: string[];
    isMuted: boolean;
    isLooping: boolean;
    isFromDb?: boolean;
  };
  adjustments?: {
    brightness?: number;
    contrast?: number;
    exposure?: number;
    saturation?: number;
    vibrance?: number;
    hue?: number;
    blur?: number;
    noise?: number;
    noiseScale?: number;
    noiseSoftness?: number;
    dimmingColor?: string;
    dimmingOpacity?: number; // 0-1
    vignetteRadiusX?: number; // 0-100
    vignetteRadiusY?: number; // 0-100
    vignetteBlur?: number;    // 0-100
    vignetteLinked?: boolean;
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
    crop?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  video?: {
    url: string;
    source: MediaSource;
    id?: string;
    thumbnail?: string;
    thumbnailSequence?: string[];
    isMuted: boolean;
    isLooping: boolean;
    isFromDb?: boolean;
  };
  blur?: number;
}

export const BLEND_MODES = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosity' },
] as const;
