import React from 'react';
import { useTranslation } from 'react-i18next';
import { Music } from 'lucide-react';
import { PreviewScaler } from './PreviewScaler';
import SlideContentRenderer from '../../features/presenter/components/slide-editor/SlideContentRenderer';

import { ISlide, PresenterSettings } from '../../core/types';

interface SlideThumbnailProps {
    slide: ISlide | null | undefined;
    label: string;
    hasAudio?: boolean;
    settings?: PresenterSettings | null | undefined;
}

export const SlideThumbnail = ({ slide, label, hasAudio, settings }: SlideThumbnailProps) => {
    const { t } = useTranslation();
    const showAudio = hasAudio || (slide?.type === 'normal' && (slide.audio || (slide.audioScopes && slide.audioScopes.length > 0)));

    return (
        <div className="flex-1 flex flex-col gap-2 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500 ml-1">{label}</span>
            <div className="aspect-video bg-stone-900/60 border border-white/5 rounded-2xl overflow-hidden relative flex items-center justify-center">
                {slide ? (
                    <>
                        <div className="absolute inset-0">
                            <PreviewScaler>
                                <SlideContentRenderer
                                    key={slide.id}
                                    slide={slide}
                                    isPreview={true}
                                    isRemote={true}
                                    settings={settings}
                                />
                            </PreviewScaler>
                        </div>
                        {showAudio && (
                            <div className="absolute bottom-2 left-2 p-1 z-20">
                                <Music size={14} className="text-white/40 drop-shadow-md" />
                            </div>
                        )}
                    </>
                ) : (
                    <span className="text-[10px] font-bold text-stone-700 uppercase tracking-widest italic">{t('remote.empty')}</span>
                )}
            </div>
        </div>
    );
};
