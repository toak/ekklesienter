import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { getBookName, BOOK_ORDER } from '@/core/data/bookData';
import { Verse, ISlide, ICanvasSlide } from '@/core/types';
import {
    X, Check, BookOpen, Layers,
    Monitor, Eye, Languages, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { formatMultiVerseReference, formatVerseRange } from '@/features/bible-browser/utils/bibleUtils';
import { VerseDisplay } from '../bible/VerseDisplay';
import { MultiVerseDisplay } from '../bible/MultiVerseDisplay';
import { ParallelVerseDisplay } from '../bible/ParallelVerseDisplay';
import { SlideBackground } from '../display/SlideBackground';
import { LogicalCanvas } from '../slide-editor/LogicalCanvas';

/**
 * Reimagined Bible selection modal for presentation mode.
 * Features: live slide preview, multi-verse, multi-translation, carousel preview.
 */
const BibleSelectionModal: React.FC = () => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const { closeModal, stack } = useModalStore();
    // Find the LAST instance to correctly support nested modals
    const modalData = [...stack].reverse().find(m => m.id === ModalType.BIBLE_SELECTION);
    const isOpen = !!modalData;
    const slideId = modalData?.props?.slideId as string | undefined;
    const modalPresentationId = modalData?.props?.presentationId as string | undefined;

    // ─── Store ───────────────────────────────────────────────────────────────────
    const activePresentationId = usePresentationStore(s => s.activePresentationId);
    const selectedPresentationId = usePresentationStore(s => s.selectedPresentationId);
    const activePresentation = usePresentationStore(s => s.activePresentation);
    const selectedPresentation = usePresentationStore(s => s.selectedPresentation);
    const updatePresentationSlides = usePresentationStore(s => s.updatePresentationSlides);
    const previewSlideId = usePresentationStore(s => s.previewSlideId);
    const { settings } = usePresenterStore();

    // Resolve target presentation: use modal prop > selectedPresentation > activePresentation > DB fallback
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

    // ─── Selection state ────────────────────────────────────────────────────────
    const [selectedTranslationId, setSelectedTranslationId] = useState<string>('');
    const [secondTranslationId, setSecondTranslationId] = useState<string | null>(null);
    const [selectedBookId, setSelectedBookId] = useState<string>('');
    const [selectedChapter, setSelectedChapter] = useState<number>(1);
    const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<number[]>([]);
    const [lastClickedVerseNumber, setLastClickedVerseNumber] = useState<number | null>(null);
    const [insertMode, setInsertMode] = useState<'single' | 'multiple'>('single');
    const [showSecondTranslation, setShowSecondTranslation] = useState(false);
    const [carouselIndex, setCarouselIndex] = useState(0);

    // ─── Data queries ───────────────────────────────────────────────────────────
    const translations = useLiveQuery(() => db.translations.toArray()) || [];
    const books = useLiveQuery(
        () => db.books.where('translationId').equals(selectedTranslationId || '').toArray(),
        [selectedTranslationId]
    ) || [];

    const sortedBooks = useMemo(() => {
        return [...books].sort((a, b) => {
            const orderA = BOOK_ORDER.find(o => o.id === a.bookId)?.order || 99;
            const orderB = BOOK_ORDER.find(o => o.id === b.bookId)?.order || 99;
            return orderA - orderB;
        });
    }, [books]);

    const versesInChapter = useLiveQuery(async () => {
        if (!selectedTranslationId || !selectedBookId) return [];
        return await db.verses
            .where('[translationId+bookId+chapter]')
            .equals([selectedTranslationId, selectedBookId, selectedChapter])
            .toArray();
    }, [selectedTranslationId, selectedBookId, selectedChapter]) || [];

    const chaptersCount = useMemo(() => {
        const book = sortedBooks.find(b => b.bookId === selectedBookId);
        return book?.chapters?.length || 150;
    }, [sortedBooks, selectedBookId]);

    // Selected verse objects for preview
    const selectedVerses = useMemo(() => {
        return versesInChapter
            .filter(v => selectedVerseNumbers.includes(v.verseNumber))
            .sort((a, b) => a.verseNumber - b.verseNumber);
    }, [versesInChapter, selectedVerseNumbers]);

    // Second translation verse (for parallel display — single verse only)
    const secondTranslationVerse = useLiveQuery(async () => {
        if (!secondTranslationId || selectedVerses.length !== 1) return null;
        const primaryVerse = selectedVerses[0];
        if (!primaryVerse) return null;
        return await db.verses
            .where('[translationId+bookId+chapter]')
            .equals([secondTranslationId, primaryVerse.bookId, primaryVerse.chapter])
            .and(v => v.verseNumber === primaryVerse.verseNumber)
            .first();
    }, [secondTranslationId, selectedVerses]) || null;

    // Second translation verses for multi-slide mode (one per selected verse)
    const secondTranslationVerses = useLiveQuery(async () => {
        if (!secondTranslationId || selectedVerses.length <= 1) return [];
        const firstVerse = selectedVerses[0];
        if (!firstVerse) return [];
        const allSecondVerses = await db.verses
            .where('[translationId+bookId+chapter]')
            .equals([secondTranslationId, firstVerse.bookId, firstVerse.chapter])
            .filter(v => selectedVerseNumbers.includes(v.verseNumber))
            .toArray();
        return allSecondVerses.sort((a, b) => a.verseNumber - b.verseNumber);
    }, [secondTranslationId, selectedVerses, selectedVerseNumbers]) || [];

    // ─── Initialization ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (translations.length > 0 && !selectedTranslationId) {
            setSelectedTranslationId(translations[0].id);
        }
    }, [translations, selectedTranslationId]);

    useEffect(() => {
        if (sortedBooks.length > 0 && !selectedBookId) {
            setSelectedBookId(sortedBooks[0].bookId);
        }
    }, [sortedBooks, selectedBookId]);

    // Restore state from existing slide when editing
    useEffect(() => {
        if (!slideId || !presentation?.slides) return;
        const slide = presentation.slides.find(s => s.id === slideId);
        if (!slide || slide.type !== 'normal') return;

        const canvasSlide = slide as ICanvasSlide;
        const vars = canvasSlide.content.variables;
        if (vars.translationId) setSelectedTranslationId(String(vars.translationId));
        if (vars.bookId) setSelectedBookId(String(vars.bookId));
        if (vars.chapter) setSelectedChapter(Number(vars.chapter));
        if (vars.secondTranslationId) {
            setSecondTranslationId(String(vars.secondTranslationId));
            setShowSecondTranslation(true);
        }
        if (vars.verseStart) {
            const start = Number(vars.verseStart);
            const end = vars.verseEnd ? Number(vars.verseEnd) : start;
            const range: number[] = [];
            for (let i = start; i <= end; i++) range.push(i);
            setSelectedVerseNumbers(range);
        } else if (vars.verses) {
            try {
                setSelectedVerseNumbers(JSON.parse(String(vars.verses)));
            } catch {
                setSelectedVerseNumbers([]);
            }
        }
    }, [slideId, presentation]);

    // Reset carousel index when verse selection or insert mode changes
    useEffect(() => {
        setCarouselIndex(0);
    }, [selectedVerseNumbers.length, insertMode]);

    // ─── Verse click handler ────────────────────────────────────────────────────
    const handleVerseClick = useCallback((v: Verse, e: React.MouseEvent) => {
        const isShift = e.shiftKey;
        const isCmdCtrl = e.metaKey || e.ctrlKey;

        if (isShift && lastClickedVerseNumber !== null) {
            const start = Math.min(lastClickedVerseNumber, v.verseNumber);
            const end = Math.max(lastClickedVerseNumber, v.verseNumber);
            const range: number[] = [];
            for (let i = start; i <= end; i++) range.push(i);
            setSelectedVerseNumbers(prev => {
                const others = prev.filter(n => n < start || n > end);
                return [...new Set([...others, ...range])];
            });
        } else if (isCmdCtrl) {
            setSelectedVerseNumbers(prev =>
                prev.includes(v.verseNumber)
                    ? prev.filter(n => n !== v.verseNumber)
                    : [...prev, v.verseNumber]
            );
        } else {
            setSelectedVerseNumbers([v.verseNumber]);
        }
        setLastClickedVerseNumber(v.verseNumber);
    }, [lastClickedVerseNumber]);

    // ─── Apply handler ──────────────────────────────────────────────────────────
    const handleApply = useCallback(async () => {
        if (!targetPresentationId || !presentation) return;
        if (selectedVerses.length === 0) return;

        const sortedSelected = [...selectedVerseNumbers].sort((a, b) => a - b);

        const getReference = (verses: Verse[]) => {
            if (verses.length === 0) return '';
            const bookName = getBookName(selectedBookId, lang);
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
                translationId: selectedTranslationId,
                bookId: selectedBookId,
                chapter: selectedChapter,
                verses: JSON.stringify(verseNums),
                verseStart: verseNums[0],
                verseEnd: verseNums[verseNums.length - 1],
            };

            if (secondTranslationId && secondVerse) {
                base.secondTranslationId = secondTranslationId;
                base.secondVerseText = secondVerse.text;
            }

            return base;
        };

        if (slideId) {
            // Update existing slide
            const variables = buildVariables(selectedVerses, sortedSelected, secondTranslationVerse);
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
            // Compute insertion index relative to selected slide
            const insertBefore = modalData?.props?.insertBefore as boolean | undefined;
            const selectedIdx = previewSlideId
                ? existingSlides.findIndex(s => s.id === previewSlideId)
                : -1;
            const insertionIndex = selectedIdx !== -1
                ? (insertBefore ? selectedIdx : selectedIdx + 1)
                : existingSlides.length;

            const slidesToInsert: ISlide[] = [];

            if (insertMode === 'single') {
                slidesToInsert.push({
                    id: crypto.randomUUID(),
                    type: 'normal',
                    order: 0,
                    blockId: 'bible',
                    templateId: 'bible-default',
                    content: { variables: buildVariables(selectedVerses, sortedSelected, secondTranslationVerse) }
                } as ICanvasSlide);
            } else {
                // Multiple slides mode — one slide per verse
                selectedVerses.forEach((verse) => {
                    const matchingSecondVerse = secondTranslationVerses.find(
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
        presentation, targetPresentationId, selectedVerses,
        selectedVerseNumbers, selectedBookId, selectedChapter,
        selectedTranslationId, secondTranslationId, secondTranslationVerse,
        secondTranslationVerses, slideId, insertMode, lang,
        updatePresentationSlides, closeModal
    ]);

    // ─── Preview logic ──────────────────────────────────────────────────────────
    const showCarousel = insertMode === 'multiple' && selectedVerses.length > 1;
    const totalCarouselSlides = showCarousel ? selectedVerses.length : 1;

    // Clamp carousel index if verses removed
    const clampedIndex = Math.min(carouselIndex, Math.max(0, totalCarouselSlides - 1));
    if (clampedIndex !== carouselIndex) {
        // Will be set via the effect above, but safe guard
    }

    const referenceText = useMemo(() => {
        if (selectedVerses.length === 0) return '';
        const bookName = getBookName(selectedBookId, lang);
        return formatMultiVerseReference(selectedVerses, bookName, lang);
    }, [selectedVerses, selectedBookId, lang]);

    if (!isOpen) return null;

    // ─── Render: Preview panel ──────────────────────────────────────────────────
    const renderPreview = () => {
        const hasSecondTranslation = !!secondTranslationId;

        if (selectedVerses.length === 0) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center text-stone-600 gap-3">
                    <Eye className="w-8 h-8 opacity-30" />
                    <p className="text-xs font-medium opacity-60">
                        {t('select_verse_preview', 'Select verses to preview')}
                    </p>
                </div>
            );
        }

        // Multi-slide carousel mode
        if (showCarousel) {
            const currentVerse = selectedVerses[clampedIndex];
            const matchingSecondVerse = hasSecondTranslation
                ? secondTranslationVerses.find(sv => sv.verseNumber === currentVerse?.verseNumber)
                : null;

            return (
                <div className="flex-1 flex flex-col items-center justify-center min-h-0 gap-3">
                    {/* Slide Preview */}
                    <div className="flex-1 flex items-center justify-center w-full min-h-0 px-2">
                        <LogicalCanvas
                            containerClassName="rounded-xl ring-1 ring-white/5"
                        >
                            <SlideBackground background={settings.background} />
                            <div className="absolute inset-0 z-10 w-full h-full max-w-full">
                                {currentVerse && matchingSecondVerse ? (
                                    <ParallelVerseDisplay
                                        verse1={currentVerse}
                                        verse2={matchingSecondVerse}
                                        autoFit={true}
                                        settings={settings}
                                    />
                                ) : currentVerse ? (
                                    <VerseDisplay
                                        verse={currentVerse}
                                        showReference={true}
                                        autoFit={true}
                                        className="h-full w-full"
                                        settings={settings}
                                    />
                                ) : null}
                            </div>
                        </LogicalCanvas>
                    </div>

                    {/* Carousel Navigation */}
                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            type="button"
                            disabled={clampedIndex === 0}
                            onClick={() => setCarouselIndex(i => Math.max(0, i - 1))}
                            className={cn(
                                "p-2 rounded-xl border transition-all cursor-pointer",
                                clampedIndex === 0
                                    ? "border-white/5 text-stone-700 cursor-not-allowed"
                                    : "border-white/10 text-stone-300 hover:bg-white/5 hover:text-white"
                            )}
                            aria-label="Previous slide"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        {/* Dots / indicators */}
                        <div className="flex items-center gap-1.5">
                            {selectedVerses.map((v, idx) => (
                                <button
                                    type="button"
                                    key={v.verseNumber}
                                    onClick={() => setCarouselIndex(idx)}
                                    className={cn(
                                        "transition-all rounded-full cursor-pointer",
                                        idx === clampedIndex
                                            ? "w-6 h-2 bg-amber-500"
                                            : "w-2 h-2 bg-stone-700 hover:bg-stone-500"
                                    )}
                                    aria-label={`Slide ${idx + 1}`}
                                />
                            ))}
                        </div>

                        <button
                            type="button"
                            disabled={clampedIndex >= totalCarouselSlides - 1}
                            onClick={() => setCarouselIndex(i => Math.min(totalCarouselSlides - 1, i + 1))}
                            className={cn(
                                "p-2 rounded-xl border transition-all cursor-pointer",
                                clampedIndex >= totalCarouselSlides - 1
                                    ? "border-white/5 text-stone-700 cursor-not-allowed"
                                    : "border-white/10 text-stone-300 hover:bg-white/5 hover:text-white"
                            )}
                            aria-label="Next slide"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Slide counter */}
                    <span className="text-[10px] font-bold text-stone-600 shrink-0">
                        {t('slide_of', 'Slide {{current}} of {{total}}', { current: clampedIndex + 1, total: totalCarouselSlides })}
                    </span>
                </div>
            );
        }

        // Single slide mode — show all verses together or parallel
        const isMulti = selectedVerses.length > 1;

        return (
            <div className="flex-1 flex items-center justify-center p-4 min-h-0">
                <LogicalCanvas
                    containerClassName="rounded-xl ring-1 ring-white/5"
                >
                    <SlideBackground background={settings.background} />
                    <div className="absolute inset-0 z-10 w-full h-full max-w-full">
                        {isMulti ? (
                            <MultiVerseDisplay
                                verses={selectedVerses}
                                showReference={true}
                                autoFit={true}
                                className="h-full w-full"
                                settings={settings}
                            />
                        ) : hasSecondTranslation && selectedVerses[0] && secondTranslationVerse ? (
                            <ParallelVerseDisplay
                                verse1={selectedVerses[0]}
                                verse2={secondTranslationVerse}
                                autoFit={true}
                                settings={settings}
                            />
                        ) : selectedVerses[0] ? (
                            <VerseDisplay
                                verse={selectedVerses[0]}
                                showReference={true}
                                autoFit={true}
                                className="h-full w-full"
                                settings={settings}
                            />
                        ) : null}
                    </div>
                </LogicalCanvas>
            </div>
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-10001 flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-stone-900 border border-white/10 rounded-[32px] w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-stone-900/50 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                            <BookOpen className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white tracking-tight uppercase">
                                {slideId ? t('edit_verse', 'Edit Verse') : t('select_verse', 'Select Verse')}
                            </h2>
                            <p className="text-[10px] text-stone-500 font-bold uppercase tracking-[0.2em] mt-0.5">
                                {t('bible_browser', 'Bible Browser')}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => closeModal(ModalType.BIBLE_SELECTION)}
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-stone-400 hover:text-white transition-all border border-white/5 cursor-pointer"
                        aria-label={t('close', 'Close')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Body: Selector (left) + Preview (right) ────────────── */}
                <div className="flex-1 flex overflow-hidden min-h-0">
                    {/* Left Panel — Selection */}
                    <div className="w-[420px] shrink-0 flex flex-col border-r border-white/5 overflow-hidden">
                        <div className="flex-1 flex overflow-hidden p-4 gap-3">
                            {/* Column 1: Translation + Books */}
                            <div className="w-[160px] shrink-0 flex flex-col gap-3 min-w-0">
                                {/* Translation selector */}
                                <div className="shrink-0">
                                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 block px-1">
                                        {t('translation', 'Translation')}
                                    </label>
                                    <div className="bg-stone-950/50 border border-white/5 rounded-2xl p-1 max-h-28 overflow-y-auto no-scrollbar">
                                        {translations.map(tr => (
                                            <button
                                                type="button"
                                                key={tr.id}
                                                onClick={() => {
                                                    setSelectedTranslationId(tr.id);
                                                    setSelectedBookId('');
                                                    setSelectedChapter(1);
                                                    setSelectedVerseNumbers([]);
                                                }}
                                                className={cn(
                                                    "w-full px-3 py-1.5 rounded-xl text-left text-[11px] font-bold transition-all flex items-center justify-between cursor-pointer",
                                                    selectedTranslationId === tr.id
                                                        ? "bg-amber-500 text-black"
                                                        : "text-stone-400 hover:bg-white/5 hover:text-stone-200"
                                                )}
                                            >
                                                <span className="truncate">{tr.name}</span>
                                                {selectedTranslationId === tr.id && <Check className="w-3 h-3 shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Books */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 block px-1 shrink-0">
                                        {t('book', 'Book')}
                                    </label>
                                    <div className="flex-1 overflow-y-auto no-scrollbar bg-stone-950/50 border border-white/5 rounded-2xl p-1 space-y-0.5">
                                        {sortedBooks.map(book => (
                                            <button
                                                type="button"
                                                key={book.id}
                                                onClick={() => {
                                                    setSelectedBookId(book.bookId);
                                                    setSelectedChapter(1);
                                                    setSelectedVerseNumbers([]);
                                                }}
                                                className={cn(
                                                    "w-full px-3 py-2 rounded-xl text-left text-[11px] font-bold transition-all cursor-pointer",
                                                    selectedBookId === book.bookId
                                                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                                        : "text-stone-400 hover:bg-white/5 hover:text-stone-200 border border-transparent"
                                                )}
                                            >
                                                {getBookName(book.bookId, lang)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Chapters + Verses */}
                            <div className="flex-1 flex flex-col gap-3 min-w-0">
                                {/* Chapters */}
                                <div className="shrink-0">
                                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 block px-1">
                                        {t('chapter', 'Chapter')}
                                    </label>
                                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto no-scrollbar p-0.5">
                                        {Array.from({ length: chaptersCount }, (_, i) => i + 1).map(ch => (
                                            <button
                                                type="button"
                                                key={ch}
                                                onClick={() => {
                                                    setSelectedChapter(ch);
                                                    setSelectedVerseNumbers([]);
                                                }}
                                                className={cn(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black transition-all border cursor-pointer",
                                                    selectedChapter === ch
                                                        ? "bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20"
                                                        : "bg-stone-950/50 text-stone-400 border-white/5 hover:border-white/20 hover:text-white"
                                                )}
                                            >
                                                {ch}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Verses */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    <div className="flex items-center justify-between mb-1.5 px-1 shrink-0">
                                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
                                            {t('verses', 'Verses')}
                                        </label>
                                        {selectedVerseNumbers.length > 0 && (
                                            <span className="text-[10px] font-bold text-amber-500/70">
                                                {selectedVerseNumbers.length} {t('selected', 'selected')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-y-auto no-scrollbar bg-stone-950/50 border border-white/5 rounded-2xl p-2 space-y-1">
                                        {versesInChapter.map(v => (
                                            <button
                                                type="button"
                                                key={v.id}
                                                onClick={(e) => handleVerseClick(v, e)}
                                                className={cn(
                                                    "w-full p-2.5 rounded-xl text-left transition-all border cursor-pointer group relative overflow-hidden",
                                                    selectedVerseNumbers.includes(v.verseNumber)
                                                        ? "bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20"
                                                        : "bg-stone-900/50 border-white/5 hover:border-white/10"
                                                )}
                                            >
                                                <div className="flex gap-2.5">
                                                    <span className={cn(
                                                        "text-[10px] font-black mt-0.5 shrink-0 w-5 text-right",
                                                        selectedVerseNumbers.includes(v.verseNumber)
                                                            ? "text-amber-500" : "text-stone-600"
                                                    )}>
                                                        {v.verseNumber}
                                                    </span>
                                                    <p className={cn(
                                                        "text-[11px] leading-relaxed transition-colors line-clamp-2 min-w-0",
                                                        selectedVerseNumbers.includes(v.verseNumber)
                                                            ? "text-stone-100" : "text-stone-400 group-hover:text-stone-300"
                                                    )}>
                                                        {v.text}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel — Preview */}
                    <div className="flex-1 flex flex-col min-w-0 bg-stone-950/30">
                        {/* Preview header */}
                        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <Monitor className="w-3.5 h-3.5 text-stone-500" />
                                <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
                                    {t('slide_preview', 'Slide Preview')}
                                </span>
                            </div>

                            {/* Second Translation Toggle */}
                            <button
                                type="button"
                                onClick={() => {
                                    if (showSecondTranslation) {
                                        setShowSecondTranslation(false);
                                        setSecondTranslationId(null);
                                    } else {
                                        setShowSecondTranslation(true);
                                    }
                                }}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer border",
                                    showSecondTranslation
                                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                        : "text-stone-500 hover:text-stone-300 border-white/5 hover:border-white/10"
                                )}
                            >
                                <Languages className="w-3.5 h-3.5" />
                                {t('parallel', 'Parallel')}
                            </button>
                        </div>

                        {/* Second translation picker */}
                        {showSecondTranslation && (
                            <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest shrink-0">
                                    {t('second_translation', '2nd Translation')}
                                </span>
                                <div className="flex gap-1 flex-wrap min-w-0">
                                    {translations
                                        .filter(tr => tr.id !== selectedTranslationId)
                                        .map(tr => (
                                            <button
                                                type="button"
                                                key={tr.id}
                                                onClick={() => setSecondTranslationId(
                                                    secondTranslationId === tr.id ? null : tr.id
                                                )}
                                                className={cn(
                                                    "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border",
                                                    secondTranslationId === tr.id
                                                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                        : "text-stone-500 hover:text-stone-300 border-white/5 hover:border-white/10"
                                                )}
                                            >
                                                {tr.name}
                                            </button>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Preview area */}
                        <div className="flex-1 flex flex-col min-h-0 p-4">
                            {renderPreview()}
                        </div>

                        {/* Reference chip at bottom of preview */}
                        {referenceText && (
                            <div className="px-4 pb-3 shrink-0">
                                <div className="bg-stone-900/80 border border-white/5 rounded-xl px-4 py-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <BookOpen className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
                                        <span className="text-xs font-bold text-amber-500 truncate">
                                            {referenceText}
                                        </span>
                                    </div>
                                    {secondTranslationId && (
                                        <span className="text-[10px] font-bold text-stone-500 shrink-0 ml-2">
                                            + {translations.find(tr => tr.id === secondTranslationId)?.name}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer ─────────────────────────────────────────────── */}
                <div className="px-6 py-4 border-t border-white/5 bg-stone-950/50 backdrop-blur-xl flex items-center justify-between shrink-0">
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest mb-0.5">
                            {t('selection', 'Selection')}
                        </span>
                        <p className="text-xs font-bold text-amber-500 truncate">
                            {selectedBookId ? getBookName(selectedBookId, lang) : ''} {selectedChapter}:{formatVerseRange(selectedVerseNumbers)}
                        </p>
                    </div>

                    {!slideId && (
                        <div className="hidden sm:flex bg-stone-900 border border-white/10 rounded-xl p-1 shrink-0 mx-4">
                            <button
                                type="button"
                                onClick={() => setInsertMode('single')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold transition-all cursor-pointer",
                                    insertMode === 'single' ? "bg-white/10 text-white" : "text-stone-500 hover:text-stone-300"
                                )}
                            >
                                <div className="flex items-center gap-1.5">
                                    <Layers className="w-3 h-3" />
                                    {t('single_slide', 'Single Slide')}
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setInsertMode('multiple')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold transition-all cursor-pointer",
                                    insertMode === 'multiple' ? "bg-white/10 text-white" : "text-stone-500 hover:text-stone-300"
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
                            disabled={selectedVerses.length === 0}
                            className={cn(
                                "px-8 py-2.5 font-black rounded-2xl transition-all border shadow-lg text-[10px] uppercase tracking-widest cursor-pointer",
                                selectedVerses.length > 0
                                    ? "bg-amber-500 text-black border-amber-600 shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98]"
                                    : "bg-stone-800 text-stone-500 border-stone-700 shadow-none cursor-not-allowed"
                            )}
                        >
                            {slideId ? t('update_slide', 'Update Slide') : (
                                insertMode === 'multiple' && selectedVerses.length > 1
                                    ? t('insert_slides_count', 'Insert {{count}} Slides', { count: selectedVerses.length })
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
