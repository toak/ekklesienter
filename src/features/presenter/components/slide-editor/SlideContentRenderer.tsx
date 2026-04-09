import React, { useMemo } from 'react';
import { ISlide, IBlock, ICanvasSlide, ITimerSlide, IVideoSlide } from '@/core/types/presentation';
import { ITemplate, ITemplateTextStyle } from '@/core/types/template';
import { ICanvasItem } from '@/core/types/canvas';
import { IStyleLayer } from '@/core/types/style';
import { PresenterSettings } from '@/core/types/settings';
import CanvasItemView from './CanvasItemView';
import {
    Monitor, Music, Coins, Baby, Mic2, Megaphone,
    Presentation as PresentationIcon, BookOpen, Plus, Lock
} from 'lucide-react';
import { VerseDisplay } from '@/features/presenter/components/bible/VerseDisplay';
import { ParallelVerseDisplay } from '@/features/presenter/components/bible/ParallelVerseDisplay';
import { Verse } from '@/core/types/bible';
import { cn } from '@/core/utils/cn';

import { SlideBackground } from '@/features/presenter/components/display/SlideBackground';
import TimerSlideRenderer from '@/features/presenter/components/display/TimerSlideRenderer';
import VideoSlideRenderer from '@/features/presenter/components/display/VideoSlideRenderer';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { db } from '@/core/db';
import { useLiveQuery } from 'dexie-react-hooks';

const ICON_MAP: Record<string, React.FC<{ className?: string; strokeWidth?: number }>> = {
    Monitor, Music, Coins, Baby, Mic2, Megaphone, BookOpen, Plus, Presentation: PresentationIcon,
};

const formatFontFamily = (family?: string) => {
    if (!family) return 'sans-serif';
    const needsQuotes = family.includes(' ') && !family.includes(',') && !family.startsWith('"');
    const quoted = needsQuotes ? `"${family}"` : family;
    if (quoted.includes(',')) return quoted;

    const lower = family.toLowerCase();
    if (lower.includes('serif')) return `${quoted}, serif`;
    if (lower.includes('mono')) return `${quoted}, monospace`;
    return `${quoted}, sans-serif`;
};

interface SlideContentRendererProps {
    /** The template to render (provides background + textStyle) */
    template?: ITemplate;
    /** Block data for icon/color */
    block?: IBlock;
    /** Slide variables (title, subtitle, content) */
    variables?: Record<string, string | number>;
    /** Language code (e.g. 'ru', 'en') */
    lang?: string;
    /** Whether this is a miniature preview (scales text down) */
    isPreview?: boolean;
    /** Whether this is being preloaded (hidden warm-up) */
    isPreloading?: boolean;
    /** Optional extra className */
    className?: string;
    /** Show lock badge for prebuilt templates */
    showLockBadge?: boolean;
    /** Slide-specific background replacing the template's background */
    backgroundOverride?: IStyleLayer[] | null;
    /** Canvas items to render on top of the slide content */
    canvasItems?: ICanvasItem[];
    /** Optional scale (0 to 1) for small previews */
    scale?: number;
    /** Hide block icon and standard text overlays for clean design preview */
    hideOverlays?: boolean;
    /** Slide ID for live/preview detection */
    slideId?: string;
    /** Current slide data for type detection / propagation */
    slide?: ISlide | null;
    /** Skip rendering canvas items (used when interactive SlideCanvas is present) */
    hideCanvasItems?: boolean;
    /** Whether this is for the projector window */
    isProjector?: boolean;
    /** Presenter settings for reference/labels */
    settings?: PresenterSettings;
    /** Bible verses for scripture slides */
    bibleVerses?: Verse[] | null;
    /** Second translation for parallel view */
    bibleSecondVerse?: Verse | null;
    /** Transition state */
    isTransitioning?: boolean;
    /** Data maps for resolving references */
    blocksMap?: Map<string, any>;
    templatesMap?: Map<string, any>;
}

const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

/**
 * Shared component that renders a slide's full visual: background + text + icon.
 * Used across template picker, timeline thumbnails, slide edit area, and projector.
 * Renders in a fixed 1920x1080 logical coordinate system and scales via CSS.
 */
const SlideContentRenderer: React.FC<SlideContentRendererProps> = ({
    template: propTemplate,
    block: propBlock,
    variables = {},
    lang = 'en',
    isPreview = false,
    className,
    showLockBadge = false,
    backgroundOverride,
    canvasItems = [],
    scale = 1,
    hideOverlays = false,
    slideId,
    slide: propSlide,
    hideCanvasItems = false,
    isPreloading = false,
    settings: propSettings,
    bibleVerses,
    bibleSecondVerse,
    isTransitioning,
    blocksMap,
    templatesMap
}) => {
    const { settings: globalSettings } = usePresenterStore();
    const settings = propSettings || globalSettings;
    const slide = propSlide;

    // Resolve missing block/template data directly from DB if props are missing
    const dbBlock = useLiveQuery(
        () => (!propBlock && slide?.blockId) ? db.blocks.get(slide.blockId) : undefined,
        [propBlock, slide?.blockId]
    );
    const dbTemplate = useLiveQuery(
        () => (!propTemplate && slide?.templateId) ? db.templates.get(slide.templateId) : undefined,
        [propTemplate, slide?.templateId]
    );

    const block = propBlock || dbBlock;
    const template = propTemplate || dbTemplate;

    const isRu = lang === 'ru';
    const ts = template?.textStyle;
    const bg = backgroundOverride || template?.background;

    const isTimer = slide?.type === 'timer';

    const BlockIcon = block ? (ICON_MAP[block.icon] || PresentationIcon) : PresentationIcon;
    const title = variables.title || (slide?.type === 'normal' ? (slide as ICanvasSlide).content?.variables?.title : undefined) || (isRu ? block?.nameRu : block?.name) || '';
    const subtitle = variables.subtitle ? String(variables.subtitle) : (slide?.type === 'normal' ? String((slide as ICanvasSlide).content?.variables?.subtitle || '') : '');
    const content = variables.content ? String(variables.content) : (slide?.type === 'normal' ? String((slide as ICanvasSlide).content?.variables?.content || '') : '');

    // Standard sizes (formerly "full sizes")
    // All scaling is now handled by CSS transform: scale()
    const iconSize = 'w-12 h-12';
    const iconWrap = 'w-20 h-20 rounded-2xl';
    const titleClass = 'text-3xl leading-tight max-w-2xl';
    const subtitleClass = 'text-lg leading-relaxed';
    const contentClass = 'text-base leading-relaxed max-w-xl';
    const gapClass = 'gap-3 p-8';
    const iconMb = 'mb-4';

    return (
        <div
            className={cn('relative overflow-hidden origin-top-left', className)}
            style={{
                width: BASE_WIDTH,
                height: BASE_HEIGHT,
                transform: `scale(${scale})`
            }}
        >
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {bg ? (
                    <SlideBackground background={bg} />
                ) : (
                    <div 
                        className="absolute inset-0 transition-colors duration-500" 
                        style={{ backgroundColor: block?.color || '#1c1917' }} 
                    />
                )}
            </div>

            {/* Content (Suppressed for blank layout or if hideOverlays is true) */}
            {template?.structure?.layout !== 'blank' && !hideOverlays && slide?.blockId !== 'bible' && (
                <div className={cn(
                    'relative z-10 w-full h-full flex flex-col items-center justify-center text-center',
                    gapClass
                )}>
                    {/* Block Icon */}
                    {block && (
                        <div
                            className={cn(
                                iconWrap, iconMb,
                                'flex items-center justify-center border border-white/10 shadow-lg shrink-0'
                            )}
                            style={{ backgroundColor: block.color || 'rgba(255,255,255,0.08)' }}
                        >
                            <BlockIcon className={cn(iconSize, 'text-white')} strokeWidth={1.5} />
                        </div>
                    )}

                    {/* Title */}
                    {title && (
                        <h2
                            className={cn(
                                titleClass,
                                'font-black tracking-tight line-clamp-2'
                            )}
                            style={{
                                fontFamily: formatFontFamily(ts?.fontFamily),
                                color: ts?.color || '#ffffff',
                                textShadow: ts?.shadow,
                                textTransform: (ts?.titleTransform || 'uppercase') as React.CSSProperties['textTransform'],
                                fontWeight: ts?.titleWeight || '900',
                            }}
                        >
                            {title}
                        </h2>
                    )}

                    {/* Subtitle */}
                    {subtitle && (
                        <p
                            className={cn(subtitleClass, 'font-medium tracking-wider uppercase line-clamp-1')}
                            style={{
                                fontFamily: formatFontFamily(ts?.fontFamily),
                                color: ts?.subtitleColor || '#a8a29e',
                                textShadow: ts?.shadow,
                            }}
                        >
                            {subtitle}
                        </p>
                    )}

                    {/* Content */}
                    {content && (
                        <p
                            className={cn(contentClass, 'line-clamp-3')}
                            style={{
                                fontFamily: formatFontFamily(ts?.fontFamily),
                                color: ts?.contentColor || '#78716c',
                            }}
                        >
                            {content}
                        </p>
                    )}
                </div>
            )}

            {/* Bible slide special rendering — exact same component used in SlideDisplay */}
            {slide?.blockId === 'bible' && !hideOverlays && (
                <div className="absolute inset-0 z-10 w-full h-full pointer-events-none overflow-hidden">
                    {(() => {
                        const hasParallel = !!variables.secondTranslationId && !!variables.secondVerseText;
                        const primaryVerse: Verse = {
                            id: (slideId || slide?.id || 'thumbnail') as unknown as number,
                            bookId: (variables.bookId as string) || (slide?.type === 'normal' ? (slide as ICanvasSlide).content?.variables?.bookId as string : undefined) || 'GEN',
                            chapter: Number(variables.chapter || (slide?.type === 'normal' ? (slide as ICanvasSlide).content?.variables?.chapter : 1)),
                            verseNumber: Number(variables.verseStart || (slide?.type === 'normal' ? (slide as ICanvasSlide).content?.variables?.verseStart : 1)),
                            text: (variables.content as string) || (slide?.type === 'normal' ? (slide as ICanvasSlide).content?.variables?.content as string : ''),
                            translationId: (variables.translationId as string) || (slide?.type === 'normal' ? (slide as ICanvasSlide).content?.variables?.translationId as string : 'KJV')
                        };

                        if (hasParallel) {
                            const secondVerse: Verse = {
                                ...primaryVerse,
                                translationId: (variables.secondTranslationId as string),
                                text: (variables.secondVerseText as string)
                            };
                            return (
                                <ParallelVerseDisplay
                                    verse1={primaryVerse}
                                    verse2={secondVerse}
                                    autoFit={true}
                                    settings={settings}
                                    className="w-full h-full"
                                />
                            );
                        }

                        return (
                            <VerseDisplay
                                verse={primaryVerse}
                                autoFit={true}
                                settings={settings}
                                className="w-full h-full"
                                showReference={true}
                            />
                        );
                    })()}
                </div>
            )}

            {/* Timer Renderer */}
            {slide?.type === 'normal' && (slide as ICanvasSlide).timerSettings && (
                <div className="absolute inset-0 z-12">
                    <TimerSlideRenderer
                        id={slide.id}
                        settings={(slide as ICanvasSlide).timerSettings!}
                        isPreview={isPreview}
                        isLive={!isPreview && !!slideId}
                    />
                </div>
            )}

            {/* Video Slide Renderer */}
            {slide?.type === 'video' && (
                <div className="absolute inset-0 z-12">
                    <VideoSlideRenderer
                        slideId={slide.id}
                        settings={(slide as IVideoSlide).videoSettings}
                        isPreview={isPreview}
                        isLive={!isPreview && !isPreloading}
                        isPreloading={isPreloading}
                    />
                </div>
            )}

            {/* Lock badge for prebuilt templates */}
            {showLockBadge && (
                <div className="absolute top-4 right-4 z-20 p-2 bg-black/40 backdrop-blur rounded-lg">
                    <Lock className="w-4 h-4 text-white/50" />
                </div>
            )}

            {/* Canvas Items Overlay */}
            {(() => {
                const items = (canvasItems && canvasItems.length > 0) 
                    ? canvasItems 
                    : (slide?.type === 'normal' ? (slide as ICanvasSlide).content?.canvasItems : []);
                
                if (hideCanvasItems || !items || items.length === 0) return null;
                
                const sortedItems = [...items].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

                return (
                    <div className="absolute inset-0 z-20 pointer-events-none">
                        {sortedItems.filter((ci: ICanvasItem) => ci.visible).map((item: ICanvasItem) => {
                        const isAutoWidth = item.type === 'text' && item.text?.resizingMode === 'auto-width';
                        const isAutoHeight = item.type === 'text' && item.text?.resizingMode === 'auto-height';

                        return (
                            <div
                                key={item.id}
                                className="absolute"
                                style={{
                                    left: `${item.x}%`,
                                    top: `${item.y}%`,
                                    width: isAutoWidth ? 'max-content' : `${item.width}%`,
                                    height: (isAutoWidth || isAutoHeight) ? 'max-content' : `${item.height}%`,
                                    zIndex: item.zIndex,
                                    transform: `translate(-${item.pivotX ?? 50}%, -${item.pivotY ?? 50}%) rotate(${item.rotation || 0}deg) scale(${item.scale || 1})`,
                                    transformOrigin: `${item.pivotX ?? 50}% ${item.pivotY ?? 50}%`,
                                }}
                            >
                                <CanvasItemView item={item} isPreview={isPreview} />
                            </div>
                        );
                    })}
                    </div>
                );
            })()}
        </div>
    );
};

export default React.memo(SlideContentRenderer);
