import { ICanvasItem } from './canvas';
import { IStyleLayer } from './style';
import { SlideType } from './presentation';

export interface IAsset {
  id: string;
  type: 'text' | 'image' | 'video' | 'graphics';
  content: string;
  position: { x: number; y: number; w: number; h: number };
  style?: any;
}

export interface ITemplateTextStyle {
  fontFamily?: string;
  color?: string;
  shadow?: string;      // CSS text-shadow value
  titleTransform?: 'uppercase' | 'capitalize' | 'none';
  titleWeight?: string; // e.g. '900', 'bold'
  subtitleColor?: string;
  contentColor?: string;
}

export interface ITemplateSlide {
  id: string; // internal id for the layout/slide
  type: SlideType;
  name?: string;
  nameRu?: string;
  categoryId?: string; // assigned block ID (e.g. 'bible', 'sermon')
  canvasItems: ICanvasItem[];
  backgroundOverride?: IStyleLayer[]; // if this specific layout overrides the theme background
}

export interface ITemplate {
  id: string;
  name: string;
  nameRu: string;
  category: string; // Links to block type (e.g., 'worship', 'sermon')
  background: IStyleLayer[];
  assets: IAsset[];
  structure: { layout: string };
  thumbnail?: string;
  isUserCreated: boolean;
  textStyle?: ITemplateTextStyle;
  canvasItems?: ICanvasItem[];       // Optional canvas items for the base template layout
  templateSlides?: ITemplateSlide[]; // Sub-slides saved within this template
}
