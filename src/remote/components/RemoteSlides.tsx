import React from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, RotateCcw, Image as ImageIcon, ChevronLeft, ChevronRight, Music } from 'lucide-react';
import { cn } from '../../core/utils/cn';
import { PreviewScaler } from './PreviewScaler';
import { SlideThumbnail } from './SlideThumbnail';
import SlideContentRenderer from '../../features/presenter/components/slide-editor/SlideContentRenderer';

interface RemoteSlidesProps {
    slideState: any;
    onMediaToggle: () => void;
    onMediaStop: () => void;
    onOverrideToggle: (type: 'blackout' | 'whiteout' | 'logo') => void;
    onCommand: (cmd: string) => void;
}

const isVideoSlide = (slide: any) => {
    if (!slide) return false;
    return slide.type === 'video' ||
        slide.items?.some((i: any) => i.type === 'video') ||
        slide.content?.canvasItems?.some((i: any) => i.type === 'video');
};

export const RemoteSlides: React.FC<RemoteSlidesProps> = ({ 
    slideState, onMediaToggle, onMediaStop, onOverrideToggle, onCommand 
}) => {
    const { t } = useTranslation();

    if (!slideState) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-stone-900/40 rounded-4xl border border-white/5 animate-pulse">
                <p className="text-stone-500 font-medium">{t('remote.ready')}</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col gap-4 mb-3 animate-in fade-in slide-in-from-right-4 duration-300 min-h-0 overflow-y-auto pr-1 scroll-smooth">
            {/* 1. Main Preview (Large) */}
            <div className="bg-stone-900/40 border border-white/5 rounded-4xl p-0 flex flex-col justify-center text-center shadow-2xl relative overflow-hidden backdrop-blur-2xl w-full aspect-video items-center shrink-0 min-w-0">
                <div className="absolute inset-0 w-full h-full bg-black">
                    {slideState.slideData ? (
                        <>
                            <PreviewScaler>
                                <SlideContentRenderer
                                    key={slideState.slideData?.id || 'current-content'}
                                    slide={slideState.slideData}
                                    template={slideState.slideTemplate}
                                    block={slideState.slideBlock}
                                    backgroundOverride={slideState.slideData?.backgroundOverride}
                                    canvasItems={slideState.slideData?.content?.canvasItems}
                                    isPreview={true}
                                    isRemote={true}
                                    settings={slideState.settings}
                                />
                            </PreviewScaler>

                            {/* Top-left Title for video slides */}
                            {isVideoSlide(slideState.slideData) && (
                                <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-500 max-w-[240px]">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 block truncate">
                                        {slideState.slideTitle || t('remote.video_slide')}
                                    </span>
                                </div>
                            )}

                            {/* Audio indicator */}
                            {(slideState.hasAudio || slideState.slideData?.audio || (slideState.slideData?.audioScopes && slideState.slideData.audioScopes.length > 0)) && (
                                <div className="absolute bottom-4 left-4 z-20">
                                    <Music size={20} className="text-white/40 drop-shadow-lg" />
                                </div>
                            )}
                        </>
                    ) : (
                        <PreviewScaler>
                            <div className="p-24 flex flex-col justify-center relative z-10 text-center items-center w-full h-full bg-stone-950">
                                <h2 className="text-4xl text-stone-500 font-bold mb-12 uppercase tracking-[0.4em] opacity-40">
                                    {slideState.slideTitle || t('remote.ready')}
                                </h2>
                                <div
                                    className="text-7xl font-sans font-medium leading-tight text-stone-100 wrap-break-word max-w-[80%]"
                                    style={{
                                        fontFamily: slideState.settings?.scripture?.fontFamily || 'inherit'
                                    }}
                                    dangerouslySetInnerHTML={{ __html: slideState.slidePreviewText || t('remote.no_slide_selected') }}
                                />
                            </div>
                        </PreviewScaler>
                    )}
                </div>
            </div>

            {/* 2. Neighbors */}
            <div className="flex gap-3 shrink-0">
                <SlideThumbnail slide={slideState.prevSlideData} label={t('remote.previous')} hasAudio={slideState.prevHasAudio} settings={slideState.settings} />
                <SlideThumbnail slide={slideState.nextSlideData} label={t('remote.next')} hasAudio={slideState.nextHasAudio} settings={slideState.settings} />
            </div>

            {/* 3. Media Controls & Overrides */}
            <div className="grid grid-cols-5 gap-3 shrink-0">
                <button onClick={onMediaToggle} className="col-span-1 bg-stone-900/60 py-4 rounded-4xl border border-white/5 active:bg-stone-800 flex flex-col items-center justify-center gap-1.5 active:scale-[0.98] transition-all backdrop-blur-md">
                    {slideState.playing ? (
                        <Pause size={20} className="text-accent" fill="currentColor" />
                    ) : (
                        <Play size={20} className="text-accent" fill="currentColor" />
                    )}
                    <span className="text-[9px] font-black text-stone-600 uppercase tracking-widest">
                        {slideState.playing ? t('remote.pause') : t('remote.play')}
                    </span>
                </button>

                <div className="col-span-3 flex items-center justify-center gap-2 bg-stone-900/60 py-2.5 px-3 rounded-4xl border border-white/5 backdrop-blur-md">
                    <button
                        onClick={() => onOverrideToggle('blackout')}
                        className={cn(
                            "flex-1 h-full border border-white/5 rounded-2xl flex items-center justify-center active:scale-[0.96] transition-all pt-1",
                            slideState.activeOverride === 'blackout' ? "bg-red-600 text-white" : "bg-black/40 text-stone-500"
                        )}
                    >
                        <span className="text-lg font-black">{t('remote.blackout_char')}</span>
                    </button>
                    <button
                        onClick={() => onOverrideToggle('logo')}
                        className={cn(
                            "flex-1 h-full border border-white/5 rounded-2xl flex items-center justify-center active:scale-[0.96] transition-all overflow-hidden",
                            slideState.activeOverride === 'logo' ? "bg-red-600 text-white border-accent/20" : "bg-black/40 text-accent/60"
                        )}
                    >
                        {(slideState.activeLogoUrl || slideState.settings?.appearance?.logo?.url) ? (
                            <img
                                src={slideState.activeLogoUrl || slideState.settings.appearance.logo.url}
                                alt="Logo"
                                className={cn("w-6 h-6 object-contain transition-all", slideState.activeOverride === 'logo' && "brightness-0 invert scale-110")}
                            />
                        ) : (
                            <ImageIcon size={16} />
                        )}
                    </button>
                    <button
                        onClick={() => onOverrideToggle('whiteout')}
                        className={cn(
                            "flex-1 h-full border border-white/5 rounded-2xl flex items-center justify-center active:scale-[0.96] transition-all pt-1",
                            slideState.activeOverride === 'whiteout' ? "bg-red-600 text-white" : "bg-black/40 text-stone-500"
                        )}
                    >
                        <span className="text-lg font-black">{t('remote.whiteout_char')}</span>
                    </button>
                </div>

                <button onClick={onMediaStop} className="col-span-1 bg-stone-900/60 py-4 rounded-4xl border border-white/5 active:bg-stone-800 flex flex-col items-center justify-center gap-1.5 active:scale-[0.98] transition-all backdrop-blur-md text-stone-500 hover:text-red-500">
                    <RotateCcw size={20} />
                    <span className="text-[9px] font-black text-stone-600 uppercase tracking-widest">{t('remote.reset')}</span>
                </button>
            </div>

            {/* 4. Bottom Navigation */}
            <div className="grid grid-cols-2 gap-3 mb-2 shrink-0">
                <button
                    onClick={() => onCommand('PREV')}
                    className="bg-stone-800/60 text-stone-300 rounded-4xl border border-white/5 font-bold active:bg-stone-700 active:scale-[0.96] transition-all flex flex-col items-center justify-center py-5 backdrop-blur-lg"
                    aria-label={t('remote.previous_slide')}
                >
                    <ChevronLeft size={42} />
                </button>

                <button
                    onClick={() => onCommand('NEXT')}
                    className="bg-stone-800/60 text-stone-300 rounded-4xl border border-white/5 font-bold active:bg-stone-700 active:scale-[0.96] transition-all flex flex-col items-center justify-center py-5 backdrop-blur-lg"
                    aria-label={t('remote.next_slide')}
                >
                    <ChevronRight size={42} />
                </button>
            </div>
        </div>
    );
};
