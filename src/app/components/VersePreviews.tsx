import React from 'react';
import { useTranslation } from 'react-i18next';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { getBookName } from '@/core/data/bookData';
import { processVerseText, truncateMiddle } from '@/core/utils/markdownUtils';
import { Verse } from '@/core/types';

interface VersePreviewsProps {
    appMode: 'scripture' | 'presentation';
    lang: string;
    prevVersePreview: Verse | null | undefined;
    nextVersePreview: Verse | null | undefined;
    setActiveVerse: (verse: Verse) => void;
}

export const VersePreviews: React.FC<VersePreviewsProps> = ({
    appMode,
    lang,
    prevVersePreview,
    nextVersePreview,
    setActiveVerse
}) => {
    const { t } = useTranslation();
    const isCustomizationOpen = useModalStore(state => state.isModalOpen(ModalType.CUSTOMIZATION));

    if (appMode !== 'scripture' || isCustomizationOpen) return null;

    return (
        <>
            {/* Previous Verse Preview (Bottom Left) */}
            {prevVersePreview && (
                <div className="absolute bottom-6 left-6 z-40">
                    <button
                        onClick={() => setActiveVerse(prevVersePreview)}
                        className="bg-stone-900/90 border border-white/10 px-4 py-3 rounded-xl backdrop-blur-xl shadow-2xl hover:border-accent/50 transition-all text-left group animate-in slide-in-from-bottom-4 duration-500 flex flex-col gap-1 @md:w-72 @md:h-32 @md:p-4 @md:rounded-2xl"
                    >
                        <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest leading-none whitespace-nowrap">
                                {t('prev_verse', 'Previous Verse')}
                            </span>
                        </div>
                        <h4 className="text-xs font-bold text-white leading-tight">
                            {getBookName(prevVersePreview.bookId, lang)} {prevVersePreview.chapter}:{prevVersePreview.verseNumber}
                        </h4>
                        <p className="hidden @md:block text-[10px] text-stone-400 line-clamp-3 italic leading-relaxed mt-1">
                            {processVerseText(truncateMiddle(prevVersePreview.text, 120))}
                        </p>
                    </button>
                </div>
            )}

            {/* Next Verse Preview (Bottom Right) */}
            {nextVersePreview && (
                <div className="absolute bottom-6 right-6 z-40">
                    <button
                        onClick={() => setActiveVerse(nextVersePreview)}
                        className="bg-stone-900/90 border border-white/10 px-4 py-3 rounded-xl backdrop-blur-xl shadow-2xl hover:border-amber-500/50 transition-all text-left group animate-in slide-in-from-bottom-4 duration-500 flex flex-col gap-1 @md:w-72 @md:h-32 @md:p-4 @md:rounded-2xl"
                    >
                        <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest leading-none whitespace-nowrap">
                                {t('next_verse', 'Next Verse')}
                            </span>
                        </div>
                        <h4 className="text-xs font-bold text-white leading-tight">
                            {getBookName(nextVersePreview.bookId, lang)} {nextVersePreview.chapter}:{nextVersePreview.verseNumber}
                        </h4>
                        <p className="hidden @md:block text-[10px] text-stone-400 line-clamp-3 italic leading-relaxed mt-1">
                            {processVerseText(truncateMiddle(nextVersePreview.text, 120))}
                        </p>
                    </button>
                </div>
            )}
        </>
    );
};
