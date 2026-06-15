import React, { useState } from 'react';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { createPortal } from 'react-dom';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { X, Palette, Type, Layout, RotateCcw, Languages, Image as ImageIcon, Underline } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { BackgroundPicker } from '../slide-properties/BackgroundPicker';
import { FontPicker } from '../fonts/FontPicker';
import { ReferenceStylePicker } from '../slide-properties/ReferenceStylePicker';
import { TranslationLabelPicker } from '../slide-properties/TranslationLabelPicker';
import { LayoutSettingsPicker } from '../slide-properties/LayoutSettingsPicker';
import { VerseDisplay } from '../bible/VerseDisplay';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { useContainFit } from '@/core/hooks/useContainFit';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { SlideBackground } from '../display/SlideBackground';
import { LogicalCanvas } from '../slide-editor/LogicalCanvas';
import { ParallelVerseDisplay } from '../bible/ParallelVerseDisplay';
import { MultiVerseDisplay } from '../bible/MultiVerseDisplay';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ICanvasSlide } from '@/core/types';

type Tab = 'background' | 'font' | 'translation' | 'style' | 'layout';

const CustomizationPanel: React.FC = () => {
    const { t } = useTranslation();
    const { closeModal, isModalOpen } = useModalStore();
    const {
        settings,
        draftSettings,
        startEditing,
        updateDraft,
        commitDraft,
        cancelEditing,
        resetSettings
    } = usePresenterStore();
    const {
        activeVerse,
        secondTranslationId,
        selectedVerses,
        isMultiVerseMode
    } = useBibleStore();

    const parallelVerse = useLiveQuery(
        async () => {
            if (!activeVerse || !secondTranslationId) return null;
            return await db.verses
                .where('[translationId+bookId+chapter]')
                .equals([secondTranslationId, activeVerse.bookId, activeVerse.chapter])
                .and(v => v.verseNumber === activeVerse.verseNumber)
                .first();
        },
        [activeVerse?.bookId, activeVerse?.chapter, activeVerse?.verseNumber, secondTranslationId]
    );

    const { activePresentation, previewSlideId } = usePresentationStore();
    const selectedSlide = activePresentation?.slides.find(s => s.id === previewSlideId);
    const isBibleSlide = selectedSlide?.blockId === 'bible';

    const [activeTab, setActiveTab] = useState<Tab>('background');

    const isOpen = isModalOpen(ModalType.CUSTOMIZATION);
    const ratio = settings.display.aspectRatio || 16 / 9;
    const { width: fitW, height: fitH, containerRef: previewRef } = useContainFit(ratio, 24);

    const canvasSlide = (isBibleSlide && selectedSlide?.type === 'normal') ? selectedSlide as ICanvasSlide : null;

    const currentVerse = canvasSlide?.content?.variables ? (
        {
            id: selectedSlide!.id,
            bookId: canvasSlide.content.variables.bookId as string || 'GEN',
            chapter: Number(canvasSlide.content.variables.chapter) || 1,
            verseNumber: Number(canvasSlide.content.variables.verseStart || canvasSlide.content.variables.verse) || 1,
            text: canvasSlide.content.variables.content as string || '',
            translationId: canvasSlide.content.variables.translationId as string || 'KJV'
        }
    ) : (activeVerse || {
        bookId: 'GEN',
        chapter: 1,
        verseNumber: 1,
        text: 'In the beginning God created the heaven and the earth.',
        translationId: 'KJV'
    });

    // Fetch multiple verses if it's a Bible slide with multiverses
    const bibleVerses = useLiveQuery(async () => {
        const canvasSlide = (isBibleSlide && selectedSlide?.type === 'normal') ? selectedSlide as ICanvasSlide : null;
        if (!canvasSlide || !canvasSlide.content?.variables?.verses) return null;
        try {
            const verseNumbers = JSON.parse(canvasSlide.content.variables.verses as string) as number[];
            const translationId = (canvasSlide.content.variables.translationId as string) || 'KJV';
            const bookId = (canvasSlide.content.variables.bookId as string) || 'GEN';
            const chapter = Number(canvasSlide.content.variables.chapter) || 1;

            return await db.verses
                .where('[translationId+bookId+chapter]')
                .equals([translationId, bookId, chapter])
                .filter(v => verseNumbers.includes(v.verseNumber))
                .toArray();
        } catch (e) {
            console.error('Failed to parse verses for customization panel preview', e);
            return null;
        }
    }, [selectedSlide]);

    const activeMultiVerses = isBibleSlide ? (bibleVerses || []) : selectedVerses;
    const isMultiMode = isBibleSlide ? (activeMultiVerses.length > 1) : (isMultiVerseMode || selectedVerses.length > 1);

    // Initialize/Cleanup Design Mode
    React.useEffect(() => {
        if (isOpen) {
            startEditing();
        } else {
            cancelEditing();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
        { id: 'background', icon: ImageIcon, label: t('background') },
        { id: 'font', icon: Type, label: t('typography') },
        { id: 'translation', icon: Languages, label: t('translations') },
        { id: 'style', icon: Underline, label: t('reference_style') },
        { id: 'layout', icon: Layout, label: t('layout') },
    ];

    const handleDone = () => {
        commitDraft();
        closeModal(ModalType.CUSTOMIZATION);
    };

    const handleCancel = () => {
        cancelEditing();
        closeModal(ModalType.CUSTOMIZATION);
    };

    return createPortal(
        <div className="fixed inset-0 z-10000 flex overflow-hidden bg-black/60 backdrop-blur-md animate-in fade-in duration-500">
            {/* Left Side: Live Preview */}
            <div ref={previewRef} className="flex-1 relative overflow-hidden p-6 flex items-center justify-center">
                {/* Close/Cancel Backdrop Click */}
                <button
                    type="button"
                    aria-label={t('cancel', 'Cancel')}
                    className="absolute inset-0 w-full h-full bg-transparent border-0 cursor-zoom-out pointer-events-auto"
                    onClick={handleCancel}
                />

                <LogicalCanvas
                    containerClassName="bg-black shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/10 ring-1 ring-white/5"
                    style={{
                        borderRadius: (draftSettings || settings).display.cornerRadius ? `${(draftSettings || settings).display.cornerRadius}px` : undefined,
                    }}
                >
                    <SlideBackground background={(draftSettings || settings).background} />
                    <div className="relative z-10 w-full h-full">
                        {isMultiMode && activeMultiVerses.length >= 2 ? (
                            <MultiVerseDisplay
                                verses={activeMultiVerses}
                                autoFit={true}
                                settings={draftSettings || settings}
                            />
                        ) : parallelVerse ? (
                            <ParallelVerseDisplay
                                verse1={currentVerse as any}
                                verse2={parallelVerse}
                                autoFit={true}
                                settings={draftSettings || settings}
                            />
                        ) : (
                            <VerseDisplay
                                verse={currentVerse as any}
                                settings={draftSettings || settings}
                                autoFit={true}
                                showReference={true}
                            />
                        )}
                    </div>

                    {/* Live Badge */}
                    <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-accent" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">{t('live_preview')}</span>
                    </div>
                </LogicalCanvas>
            </div>

            {/* ─── Right Panel: Design Studio ─── */}
            <div className="relative w-[460px] h-full flex flex-col animate-in slide-in-from-right duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
                {/* Background layers */}
                <div className="absolute inset-0 bg-stone-950/98 shadow-[-40px_0_80px_rgba(0,0,0,0.6)] border-l border-white/5" />
                {/* Noise overlay */}
                <div className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

                {/* ─── Header ─── */}
                <div className="relative z-10 px-6 pt-6 pb-0 shrink-0">
                    {/* Top Row: Title + Close */}
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                                <Palette className="w-4 h-4 text-accent" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white tracking-tight leading-none">
                                    {t('design_studio')}
                                </h2>
                                <p className="text-[9px] text-stone-600 uppercase tracking-[0.2em] font-bold mt-1">{t('appearance_editor')}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleCancel}
                            className="p-2 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl text-stone-500 transition-all border border-white/5 active:scale-95"
                            aria-label="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* ─── Segmented Tab Control ─── */}
                    <div className="bg-white/3 rounded-2xl border border-white/5 p-1 flex gap-1 shadow-inner">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex-1 flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-xl transition-all duration-200 relative group",
                                    activeTab === tab.id
                                        ? "text-accent bg-accent/10"
                                        : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
                                )}
                                title={tab.label}
                            >
                                <tab.icon className={cn("w-5 h-5 transition-transform duration-300", activeTab === tab.id && "scale-110")} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* ─── Scrollable Content ─── */}
                <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar px-6 py-6 scroll-smooth min-h-0">
                    <div className="pb-4">
                        {activeTab === 'background' && (
                            <BackgroundPicker
                                background={(draftSettings || settings).background}
                                onChange={(bg) => {
                                    updateDraft({ background: bg });
                                }}
                            />
                        )}
                        {activeTab === 'font' && <FontPicker />}
                        {activeTab === 'translation' && <TranslationLabelPicker />}
                        {activeTab === 'style' && <ReferenceStylePicker />}
                        {activeTab === 'layout' && <LayoutSettingsPicker />}
                    </div>
                </div>

                {/* ─── Footer Actions ─── */}
                <div className="relative z-10 px-6 pb-6 pt-4 border-t border-white/5 bg-stone-950/80 backdrop-blur-xl shrink-0">
                    <div className="flex gap-3">
                        <button
                            onClick={handleCancel}
                            className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-stone-500 hover:text-stone-200 rounded-2xl transition-all border border-white/5 active:scale-95 text-[11px] font-bold uppercase tracking-wider cursor-pointer"
                        >
                            {t('discard')}
                        </button>
                        <button
                            onClick={handleDone}
                            className="flex-2 py-3.5 bg-accent text-accent-foreground rounded-2xl transition-all border border-accent/20 shadow-[0_8px_30px_rgba(var(--accent-rgb),0.25)] hover:shadow-[0_8px_40px_rgba(var(--accent-rgb),0.35)] hover:scale-[1.02] active:scale-[0.98] text-[11px] font-black uppercase tracking-widest cursor-pointer"
                        >
                            {t('save_profile')}
                        </button>
                    </div>
                    <div className="mt-3 flex justify-center">
                        <button
                            onClick={resetSettings}
                            className="group flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                        >
                            <RotateCcw className="w-3 h-3 text-stone-700 group-hover:text-stone-400 transition-colors" />
                            <span className="text-[10px] font-bold text-stone-700 group-hover:text-stone-400 uppercase tracking-widest transition-colors">
                                {t('restore_factory_settings')}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CustomizationPanel;
