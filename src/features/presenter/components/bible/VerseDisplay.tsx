import React, { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Verse, PresenterSettings } from '@/core/types';
import { getBookName } from '@/core/data/bookData';
import { useTranslation } from 'react-i18next';
import { processChildren } from '@/core/utils/markdownUtils';
import { cn } from '@/core/utils/cn';

import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { SlideBackground } from '../display/SlideBackground';
import { loadFontOffline } from '@/core/utils/fontLoader';
import { useTextFit } from '@/core/hooks/useTextFit';
import { formatMultiVerseReference } from '@/features/bible-browser/utils/bibleUtils';

interface VerseDisplayProps {
    verse: Verse;
    settings?: PresenterSettings;
    bookName?: string;
    showReference?: boolean;
    fontSize?: number;
    autoFit?: boolean;
    className?: string;
    isProjector?: boolean;
}

export const VerseDisplay: React.FC<VerseDisplayProps> = ({
    verse,
    bookName,
    showReference = true,
    fontSize,
    autoFit = false,
    className,
    settings: propsSettings,
    isProjector = false,
}) => {
    const { settings: storeSettings } = usePresenterStore();
    const settings = propsSettings || storeSettings;

    const containerRef = useRef<HTMLDivElement>(null);
    const referenceRef = useRef<HTMLDivElement>(null);

    const { i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const resolvedBookName = bookName || getBookName(verse.bookId, lang);

    const referenceText = formatMultiVerseReference([verse], resolvedBookName, lang);
    const textToFit = `${verse.text} ${showReference ? referenceText : ''}`;

    const { fontSize: fittedFontSize, isReady: isFitted, contentRef: fittedContentRef } = useTextFit({
        text: textToFit,
        containerRef,
        minFontSize: 16,     // 1rem * 16
        maxFontSize: 1600,   // 100rem * 16
        precision: 0.5,
        safetyMargin: 8,
    });

    const computedFontSize = autoFit ? fittedFontSize : (fontSize || settings.font.size || 56);
    const isReady = autoFit ? isFitted : true;

    // Load custom fonts locally
    useEffect(() => {
        const standardFonts = ['sans', 'serif', 'mono', 'system-ui', 'inherit'];

        if (settings.font.family && !standardFonts.includes(settings.font.family)) {
            loadFontOffline(settings.font.family, settings.font.weight);
        }

        if (settings.reference.fontFamily && !standardFonts.includes(settings.reference.fontFamily)) {
            loadFontOffline(settings.reference.fontFamily, '700');
        }
    }, [settings.font.family, settings.font.weight, settings.reference.fontFamily]);

    // Адаптируем скаляр тени (т.к. база теперь не rem, а px: 160px / 64 = 2.5)
    const shadowScale = computedFontSize / 64;

    const referenceStyle = {
        fontFamily: settings.reference.fontFamily || settings.font.family,
        color: settings.reference.color || settings.font.color,
        fontSize: settings.reference.fontSize
            ? `${settings.reference.fontSize}px`
            : `${settings.reference.scale * 32}px`, // 2rem = 32px
        opacity: settings.reference.opacity,
    };

    const isReferenceHidden = !showReference || settings.reference.style === 'hidden';

    const renderReference = () => (
        <div
            ref={referenceRef}
            className={cn(
                'flex items-center shrink-0 relative z-20',
                settings.reference.style === 'classic' ? 'w-full justify-between' : 'w-auto',
                settings.reference.style === 'ribbon' ? 'self-start' : 'self-center',
                !isReferenceHidden && settings.reference.style === 'pill' && 'bg-white/10 px-[1em] py-[0.2em] rounded-full backdrop-blur-md',
                !isReferenceHidden && settings.reference.style === 'outline' && 'border border-white/20 px-[1em] py-[0.2em] rounded-full',
                !isReferenceHidden && settings.reference.style === 'ribbon' && 'border-l-4 border-accent bg-linear-to-r from-accent/10 to-transparent pl-[0.8em] pr-[1em] py-[0.2em]',
                !isReferenceHidden && settings.reference.style === 'underline' && 'border-b border-accent/50 pb-[0.2em]',
                (settings.reference.style === 'modern' ||
                    settings.reference.style === 'minimal' ||
                    settings.reference.style === 'accent' ||
                    settings.reference.style === 'brackets') && 'gap-[0.5em]',
                settings.reference.style === 'classic' && 'gap-[1em]',
            )}
            style={{ visibility: isReferenceHidden ? 'hidden' : 'visible' }}
        >
            {!isReferenceHidden && settings.reference.style === 'classic' && (
                <div
                    className="h-px flex-1"
                    style={{
                        background: `linear-gradient(to right, transparent, ${referenceStyle.color || 'currentColor'})`,
                        opacity: 0.5,
                    }}
                />
            )}

            {!isReferenceHidden && settings.reference.style === 'brackets' && (
                <span className="opacity-40 font-light text-[0.8em]">[</span>
            )}

            <span
                className={cn(
                    'whitespace-nowrap',
                    settings.reference.style === 'modern' && 'font-bold uppercase tracking-[0.2em]',
                    settings.reference.style === 'classic' && 'uppercase tracking-[0.2em] font-light',
                    settings.reference.style === 'minimal' && 'font-light tracking-wide opacity-80',
                    settings.reference.style === 'accent' && 'text-accent font-bold tracking-widest',
                    settings.reference.style === 'pill' && 'font-bold tracking-wide text-white',
                    settings.reference.style === 'outline' && 'font-medium tracking-widest uppercase',
                    settings.reference.style === 'brackets' && 'font-medium tracking-widest uppercase text-accent/80',
                    settings.reference.style === 'underline' && 'font-bold tracking-widest uppercase',
                    settings.reference.style === 'ribbon' && 'font-bold tracking-widest uppercase text-white/90',
                )}
                style={referenceStyle}
            >
                {referenceText}
            </span>

            {!isReferenceHidden && settings.reference.style === 'brackets' && (
                <span className="opacity-40 font-light text-[0.8em]">]</span>
            )}

            {!isReferenceHidden && settings.reference.style === 'classic' && (
                <div
                    className="h-px flex-1"
                    style={{
                        background: `linear-gradient(to right, ${referenceStyle.color || 'currentColor'}, transparent)`,
                        opacity: 0.5,
                    }}
                />
            )}
        </div>
    );

    return (
        <div
            className={cn('w-full h-full relative overflow-hidden', className)}
            style={{ borderRadius: settings?.display?.cornerRadius ? `${settings.display.cornerRadius}px` : undefined }}
        >
            <SlideBackground background={settings.background} />

            <div
                className="relative z-10 w-full h-full flex flex-col"
                style={{
                    paddingTop: `${settings.display.padding?.top ?? 48}px`,
                    paddingBottom: `${settings.display.padding?.bottom ?? 48}px`,
                    paddingLeft: `${settings.display.padding?.left ?? 64}px`,
                    paddingRight: `${settings.display.padding?.right ?? 64}px`,
                    gap: `${settings.display.referenceGap ?? 16}px`,
                }}
            >
                {settings.reference.position === 'top' && renderReference()}

                <div
                    ref={containerRef}
                    className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden"
                >
                    <div
                        ref={fittedContentRef}
                        className="w-full max-w-full"
                        style={{
                            fontSize: `${computedFontSize}px`,
                            opacity: isReady ? 1 : 0,
                            fontFamily: settings.font.family,
                            fontWeight: settings.font.weight,
                            color: settings.font.color,
                            textShadow: settings.font.shadow
                                ? `${settings.font.shadowOffsetX * shadowScale}px ${settings.font.shadowOffsetY * shadowScale}px ${settings.font.shadowBlur * shadowScale}px ${settings.font.shadowColor}`
                                : 'none',
                        }}
                    >
                        <div className="leading-tight text-center wrap-break-word">
                            <ReactMarkdown
                                components={{
                                    strong: ({ node, children, ...props }: any) => (
                                        <span className="text-accent/80 font-semibold" {...props}>
                                            {processChildren(children, settings.font.showSuperscript)}
                                        </span>
                                    ),
                                    em: ({ node, children, ...props }: any) => (
                                        <span className="opacity-80 italic" {...props}>
                                            {processChildren(children, settings.font.showSuperscript)}
                                        </span>
                                    ),
                                    p: ({ node, children, ...props }: any) => (
                                        <span {...props}>
                                            {processChildren(children, settings.font.showSuperscript)}
                                        </span>
                                    ),
                                }}
                            >
                                {verse.text}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

                {settings.reference.position === 'bottom' && renderReference()}
            </div>
        </div>
    );
};

export default VerseDisplay;
