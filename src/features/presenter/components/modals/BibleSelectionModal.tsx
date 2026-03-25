import React, { useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { getBookName } from '@/core/data/bookData';
import { Verse, ISlide, ICanvasSlide } from '@/core/types';
import { Layers } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { formatMultiVerseReference, formatVerseRange } from '@/features/bible-browser/utils/bibleUtils';

// Hooks
import { useBibleSelection } from '../../hooks/useBibleSelection';

// Sub-components
import { BibleSelectionHeader } from './BibleSelectionHeader';
import { BibleSelectionSidebar } from './BibleSelectionSidebar';
import { BibleSelectionChapters } from './BibleSelectionChapters';
import { BibleSelectionVerseList } from './BibleSelectionVerseList';
import { BibleSelectionPreview } from './BibleSelectionPreview';

/**
 * Bible selection modal for presentation mode.
 * Features: live slide preview, multi-verse, multi-translation, carousel preview.
 */
const BibleSelectionModal: React.FC = () => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const { closeModal, stack } = useModalStore();

    const modalData = [...stack].reverse().find(m => m.id === ModalType.BIBLE_SELECTION);
    const isOpen = !!modalData;
    const slideId = modalData?.props?.slideId as string | undefined;
    const modalPresentationId = modalData?.props?.presentationId as string | undefined;

    // ─── Store ───
    const activePresentationId = usePresentationStore(s => s.activePresentationId);
    const selectedPresentationId = usePresentationStore(s => s.selectedPresentationId);
    const activePresentation = usePresentationStore(s => s.activePresentation);
    const selectedPresentation = usePresentationStore(s => s.selectedPresentation);
    const updatePresentationSlides = usePresentationStore(s => s.updatePresentationSlides);
    const previewSlideId = usePresentationStore(s => s.previewSlideId);
    const { settings } = usePresenterStore();

    const targetPresentationId = modalPresentationId || selectedPresentationId || activePresentationId;

    const dbPresentation = useLiveQuery(
        () => targetPresentationId ? db.presentationFiles.get(targetPresentationId) : undefined,
        [targetPresentationId]
    );

    const presentation = useMemo(() => {
        if (modalPresentationId) {
            if (selectedPresentation?.id === modalPresentationId) return selectedPresentation;
            if (activePresentation?.id === modalPresentationId) return activePresentation;
        }
        if (selectedPresentation?.id === selectedPresentationId) return selectedPresentation;
        if (activePresentation?.id === activePresentationId) return activePresentation;
        return dbPresentation;
    }, [modalPresentationId, selectedPresentation, selectedPresentationId, activePresentation, activePresentationId, dbPresentation]);

    // ─── Bible Selection Hook ───
    const bible = useBibleSelection(presentation, slideId);

    // ─── Verse click handler ───
    const handleVerseClick = useCallback((v: Verse, e: React.MouseEvent) => {
        const isShift = e.shiftKey;
        const isCmdCtrl = e.metaKey || e.ctrlKey;

        if (isShift && bible.lastClickedVerseNumber !== null) {
            const start = Math.min(bible.lastClickedVerseNumber, v.verseNumber);
            const end = Math.max(bible.lastClickedVerseNumber, v.verseNumber);
            const range: number[] = [];
            for (let i = start; i <= end; i++) range.push(i);
            bible.setSelectedVerseNumbers(prev => {
                const others = prev.filter(n => n < start || n > end);
                return [...new Set([...others, ...range])];
            });
        } else if (isCmdCtrl) {
            bible.setSelectedVerseNumbers(prev =>
                prev.includes(v.verseNumber)
                    ? prev.filter(n => n !== v.verseNumber)
                    : [...prev, v.verseNumber]
            );
        } else {
            bible.setSelectedVerseNumbers([v.verseNumber]);
        }
        bible.setLastClickedVerseNumber(v.verseNumber);
    }, [bible.lastClickedVerseNumber]);

    // ─── Apply handler ───
    const handleApply = useCallback(async () => {
        if (!targetPresentationId || !presentation) return;
        if (bible.selectedVerses.length === 0) return;

        const sortedSelected = [...bible.selectedVerseNumbers].sort((a, b) => a - b);

        const getReference = (verses: Verse[]) => {
            if (verses.length === 0) return '';
            const bookName = getBookName(bible.selectedBookId, lang);
            return formatMultiVerseReference(verses, bookName, lang);
        };

        const existingSlides = presentation.slides || [];
        let newSlides = [...existingSlides];

        const buildVariables = (verses: Verse[], verseNums: number[], secondVerse?: Verse | null) => {
            const verseText = verses.map(v => v.text).join(' ');
            const reference = getReference(verses);
            const base: Record<string, string | number> = {
                title: reference,
                content: verseText,
                text: verseText,
                reference: reference,
                translationId: bible.selectedTranslationId,
                bookId: bible.selectedBookId,
                chapter: bible.selectedChapter,
                verses: JSON.stringify(verseNums),
                verseStart: verseNums[0],
                verseEnd: verseNums[verseNums.length - 1],
            };

            if (bible.secondTranslationId && secondVerse) {
                base.secondTranslationId = bible.secondTranslationId;
                base.secondVerseText = secondVerse.text;
            }

            return base;
        };

        if (slideId) {
            const variables = buildVariables(bible.selectedVerses, sortedSelected, bible.secondTranslationVerse);
            newSlides = newSlides.map(s => {
                if (s.id === slideId && s.type === 'normal') {
                    const canvasSlide = s as ICanvasSlide;
                    return {
                        ...canvasSlide,
                        content: { ...canvasSlide.content, variables }
                    };
                }
                return s;
            });
        } else {
            const insertBefore = modalData?.props?.insertBefore as boolean | undefined;
            const selectedIdx = previewSlideId
                ? existingSlides.findIndex(s => s.id === previewSlideId)
                : -1;
            const insertionIndex = selectedIdx !== -1
                ? (insertBefore ? selectedIdx : selectedIdx + 1)
                : existingSlides.length;

            const slidesToInsert: ISlide[] = [];

            if (bible.insertMode === 'single') {
                slidesToInsert.push({
                    id: crypto.randomUUID(),
                    type: 'normal',
                    order: 0,
                    blockId: 'bible',
                    templateId: 'bible-default',
                    content: { variables: buildVariables(bible.selectedVerses, sortedSelected, bible.secondTranslationVerse) }
                } as ICanvasSlide);
            } else {
                bible.selectedVerses.forEach((verse) => {
                    const matchingSecondVerse = bible.secondTranslationVerses.find(
                        sv => sv.verseNumber === verse.verseNumber
                    );
                    slidesToInsert.push({
                        id: crypto.randomUUID(),
                        type: 'normal',
                        order: 0,
                        blockId: 'bible',
                        templateId: 'bible-default',
                        content: {
                            variables: buildVariables([verse], [verse.verseNumber], matchingSecondVerse)
                        }
                    } as ICanvasSlide);
                });
            }

            newSlides = [
                ...existingSlides.slice(0, insertionIndex),
                ...slidesToInsert,
                ...existingSlides.slice(insertionIndex),
            ].map((s, i) => ({ ...s, order: i }));
        }

        await updatePresentationSlides(targetPresentationId, newSlides);
        closeModal(ModalType.BIBLE_SELECTION);
    }, [
        presentation, targetPresentationId, bible.selectedVerses,
        bible.selectedVerseNumbers, bible.selectedBookId, bible.selectedChapter,
        bible.selectedTranslationId, bible.secondTranslationId, bible.secondTranslationVerse,
        bible.secondTranslationVerses, slideId, bible.insertMode, lang,
        updatePresentationSlides, closeModal
    ]);

    // ─── Reference text ───
    const referenceText = useMemo(() => {
        if (bible.selectedVerses.length === 0) return '';
        const bookName = getBookName(bible.selectedBookId, lang);
        return formatMultiVerseReference(bible.selectedVerses, bookName, lang);
    }, [bible.selectedVerses, bible.selectedBookId, lang]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-10001 flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-stone-900 border border-white/10 rounded-[32px] w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">

                <BibleSelectionHeader
                    slideId={slideId}
                    onClose={() => closeModal(ModalType.BIBLE_SELECTION)}
                />

                <div className="flex-1 flex overflow-hidden min-h-0">
                    {/* Left Panel — Selection */}
                    <div className="w-[420px] shrink-0 flex flex-col border-r border-white/5 overflow-hidden">
                        <div className="flex-1 flex overflow-hidden p-4 gap-3">
                            <BibleSelectionSidebar
                                translations={bible.translations}
                                sortedBooks={bible.sortedBooks}
                                selectedTranslationId={bible.selectedTranslationId}
                                selectedBookId={bible.selectedBookId}
                                setSelectedTranslationId={bible.setSelectedTranslationId}
                                setSelectedBookId={bible.setSelectedBookId}
                                setSelectedChapter={bible.setSelectedChapter}
                                setSelectedVerseNumbers={bible.setSelectedVerseNumbers}
                                lang={lang}
                            />

                            <div className="flex-1 flex flex-col gap-3 min-w-0">
                                <BibleSelectionChapters
                                    chaptersCount={bible.chaptersCount}
                                    selectedChapter={bible.selectedChapter}
                                    setSelectedChapter={bible.setSelectedChapter}
                                    setSelectedVerseNumbers={bible.setSelectedVerseNumbers}
                                />

                                <BibleSelectionVerseList
                                    versesInChapter={bible.versesInChapter}
                                    selectedVerseNumbers={bible.selectedVerseNumbers}
                                    handleVerseClick={handleVerseClick}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Panel — Preview */}
                    <BibleSelectionPreview
                        selectedVerses={bible.selectedVerses}
                        secondTranslationId={bible.secondTranslationId}
                        secondTranslationVerse={bible.secondTranslationVerse}
                        secondTranslationVerses={bible.secondTranslationVerses}
                        showSecondTranslation={bible.showSecondTranslation}
                        setShowSecondTranslation={bible.setShowSecondTranslation}
                        setSecondTranslationId={bible.setSecondTranslationId}
                        translations={bible.translations}
                        selectedTranslationId={bible.selectedTranslationId}
                        insertMode={bible.insertMode}
                        carouselIndex={bible.carouselIndex}
                        setCarouselIndex={bible.setCarouselIndex}
                        settings={settings}
                        referenceText={referenceText}
                    />
                </div>

                {/* ── Footer ── */}
                <div className="px-6 py-4 border-t border-white/5 bg-stone-950/50 backdrop-blur-xl flex items-center justify-between shrink-0">
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest mb-0.5">
                            {t('selection', 'Selection')}
                        </span>
                        <p className="text-xs font-bold text-amber-500 truncate">
                            {bible.selectedBookId ? getBookName(bible.selectedBookId, lang) : ''} {bible.selectedChapter}:{formatVerseRange(bible.selectedVerseNumbers)}
                        </p>
                    </div>

                    {!slideId && (
                        <div className="hidden sm:flex bg-stone-900 border border-white/10 rounded-xl p-1 shrink-0 mx-4">
                            <button
                                type="button"
                                onClick={() => bible.setInsertMode('single')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold transition-all cursor-pointer",
                                    bible.insertMode === 'single' ? "bg-white/10 text-white" : "text-stone-500 hover:text-stone-300"
                                )}
                            >
                                <div className="flex items-center gap-1.5">
                                    <Layers className="w-3 h-3" />
                                    {t('single_slide', 'Single Slide')}
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => bible.setInsertMode('multiple')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold transition-all cursor-pointer",
                                    bible.insertMode === 'multiple' ? "bg-white/10 text-white" : "text-stone-500 hover:text-stone-300"
                                )}
                            >
                                <div className="flex items-center gap-1.5">
                                    <Layers className="w-3 h-3" />
                                    {t('multiple_slides', 'Multiple Slides')}
                                </div>
                            </button>
                        </div>
                    )}

                    <div className="flex gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => closeModal(ModalType.BIBLE_SELECTION)}
                            className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-stone-400 font-bold rounded-2xl transition-all border border-white/5 active:scale-95 text-[10px] uppercase tracking-widest cursor-pointer"
                        >
                            {t('cancel', 'Cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleApply}
                            disabled={bible.selectedVerses.length === 0}
                            className={cn(
                                "px-8 py-2.5 font-black rounded-2xl transition-all border shadow-lg text-[10px] uppercase tracking-widest cursor-pointer",
                                bible.selectedVerses.length > 0
                                    ? "bg-amber-500 text-black border-amber-600 shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98]"
                                    : "bg-stone-800 text-stone-500 border-stone-700 shadow-none cursor-not-allowed"
                            )}
                        >
                            {slideId ? t('update_slide', 'Update Slide') : (
                                bible.insertMode === 'multiple' && bible.selectedVerses.length > 1
                                    ? t('insert_slides_count', 'Insert {{count}} Slides', { count: bible.selectedVerses.length })
                                    : t('insert_slide', 'Insert Slide')
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BibleSelectionModal;
