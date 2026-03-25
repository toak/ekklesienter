import { IStyleLayer } from './style';
import { ILogoSettings } from './media';

export interface FontSettings {
  family: string;
  weight: string;
  size: number; // px
  color: string;
  shadow: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  showSuperscript?: boolean;
}

export interface ReferenceStyleSettings {
  style: 'classic' | 'modern' | 'minimal' | 'accent' | 'pill' | 'outline' | 'brackets' | 'underline' | 'ribbon' | 'hidden';
  position: 'top' | 'bottom';
  opacity: number;
  scale: number;
  fontSize?: number; // px, if undefined use relative scale
  color?: string;
  fontFamily?: string;
}

export interface TranslationLabelSettings {
  enabled: boolean;
  color: string;
  opacity: number;
  fontSize: number; // px
  fontFamily: string;
}

export interface DisplaySettings {
  autoDefine: boolean;
  presenterDisplayId?: number;
  previewDisplayId?: number;
  aspectRatio?: number; // width / height
  cornerRadius?: number; // px, 0-48
  referenceGap?: number; // px, gap between verse and reference
  translationGap?: number; // px, gap between label and verse
  verseGap?: number; // px, gap between two verses
  padding: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export interface OverrideSettings {
  background: IStyleLayer[];
}

export interface PresenterSettings {
  background: IStyleLayer[];
  font: FontSettings;
  reference: ReferenceStyleSettings;
  translationLabel: TranslationLabelSettings;
  display: DisplaySettings;
  logo: ILogoSettings;
  audio: {
    defaultFadeDuration: number;
  };
  overrides: {
    blackout: OverrideSettings;
    whiteout: OverrideSettings;
    logo: OverrideSettings;
  };
}
