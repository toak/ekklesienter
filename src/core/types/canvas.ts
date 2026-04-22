export type CanvasItemType = 'text' | 'image' | 'video' | 'shape' | 'stroke' | 'effect';
export type ShapeType = 'rect' | 'circle' | 'triangle' | 'star' | 'diamond';
export type EffectType = 'glow' | 'shadow' | 'blur' | 'vignette';
export type CanvasEffectType = 'drop-shadow' | 'inner-shadow' | 'layer-blur' | 'background-blur' | 'noise';

export type TextResizingMode = 'auto-width' | 'auto-height' | 'fixed' | 'shrink-to-fit';
export type TextAlignHorizontal = 'left' | 'center' | 'right' | 'justify';
export type TextAlignVertical = 'top' | 'middle' | 'bottom';
export type TextCaseStyle = 'none' | 'uppercase' | 'lowercase' | 'titlecase';
export type UnderlineStyle = 'straight' | 'wavy';
export type UnderlineDecorationSkip = 'none' | 'ink';

export type ListType = 'none' | 'disc' | 'circle' | 'square' | 'decimal' | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman';

import { IStyleLayer } from './style';

export interface ICanvasItemText {
  content: string;

  // Base Typography
  fontFamily: string;
  fontWeight: string | number;
  fontSize: number; // px relative to slide (base size before shrink-to-fit)
  color?: string; // Legacy/fallback color, should use textFills ideally

  resizingMode: TextResizingMode;

  // Formatting
  isBold?: boolean;
  isItalic?: boolean;
  isStrikethrough?: boolean;
  textCase?: TextCaseStyle;

  // Sub/Super script
  scriptStyle?: 'none' | 'subscript' | 'superscript';

  // Underline
  isUnderline?: boolean;
  underlineStyle?: UnderlineStyle;
  underlineSkipInk?: UnderlineDecorationSkip;

  // Spacing & Layout
  lineHeight?: number | string;
  letterSpacing?: number | string;
  paragraphSpacing?: number;

  // Alignment
  alignHorizontal: TextAlignHorizontal;
  alignVertical: TextAlignVertical;
  textAlign?: 'left' | 'center' | 'right'; // Legacy fallback

  listType?: ListType;

  // Fills & Strokes applying specifically to the text characters
  textFills?: IStyleLayer[];
  textStrokes?: IStyleLayer[];
}

export interface ICanvasItemShape {
  shapeType: ShapeType;
}

export interface ICanvasItemStroke {
  x2: number;  // end x %
  y2: number;  // end y %
  color: string;
  width: number;
  dashArray?: string;
}

export interface ICanvasItemEffect {
  effectType: EffectType;
  color: string;
  intensity: number;
}

export interface ICanvasEffect {
  id: string;
  type: CanvasEffectType;
  visible: boolean;
  x?: number;
  y?: number;
  blur?: number;
  spread?: number;
  color?: string;
  noiseScale?: number;
  noiseSoftness?: number;
}

export interface ICanvasItem {
  id: string;
  type: CanvasItemType;
  // Position & size as percentages (0–100) of slide dimensions
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale?: number;
  opacity?: number;
  borderRadius?: number;
  borderRadiusTL?: number;
  borderRadiusTR?: number;
  borderRadiusBL?: number;
  borderRadiusBR?: number;
  lockBorderRadius?: boolean;
  fills: IStyleLayer[];
  borderColor?: string;
  borderWidth?: number;
  strokeAlign?: 'inside' | 'center' | 'outside';
  strokeJoin?: 'round' | 'bevel' | 'miter';
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeDashArray?: string;
  strokes: IStyleLayer[];
  zIndex: number;
  locked: boolean;
  visible: boolean;
  lockAspectRatio?: boolean;
  pivotX?: number; // 0-100%, default 50
  pivotY?: number; // 0-100%, default 50
  backdropBlur?: number;
  dropShadow?: { x: number; y: number; blur: number; color: string };
  effects?: ICanvasEffect[];
  // Type-specific data
  text?: ICanvasItemText;
  shape?: ICanvasItemShape;
  stroke?: ICanvasItemStroke;
  effect?: ICanvasItemEffect;
  // Media references for image/video canvas items
  image?: { id: string; url?: string; name?: string; isFromDb?: boolean };
  video?: { id: string; url?: string; name?: string; isFromDb?: boolean };
}
