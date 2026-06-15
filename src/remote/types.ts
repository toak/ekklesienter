import { ISlide, PresenterSettings, ITemplate, IBlock } from '@/core/types';

export interface RemoteSlideState {
    slideData?: ISlide | null;
    slideTemplate?: ITemplate | null;
    slideBlock?: IBlock | null;
    settings?: PresenterSettings;
    slideTitle?: string;
    hasAudio?: boolean;
    playing?: boolean;
    activeOverride?: 'blackout' | 'whiteout' | 'logo' | null;
    activeLogoUrl?: string;
    prevSlideData?: ISlide | null;
    prevHasAudio?: boolean;
    nextSlideData?: ISlide | null;
    nextHasAudio?: boolean;
    themeAccent?: string;
    language?: string;
    active?: boolean;
    slidePreviewText?: string;
    timelineSlides?: ISlide[];
}
