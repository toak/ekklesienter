import React from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Languages, BookOpen, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { Verse, PresenterSettings } from '@/core/types';
import { SlideBackground } from '../display/SlideBackground';
import { LogicalCanvas } from '../slide-editor/LogicalCanvas';
import { VerseDisplay } from '../bible/VerseDisplay';
import { MultiVerseDisplay } from '../bible/MultiVerseDisplay';
import { ParallelVerseDisplay } from '../bible/ParallelVerseDisplay';

interface BibleSelectionPreviewProps {
  selectedVerses: Verse[];
  secondTranslationId: string | null;
  secondTranslationVerse: Verse | null;
  secondTranslationVerses: Verse[];
  showSecondTranslation: boolean;
  setShowSecondTranslation: (show: boolean) => void;
  setSecondTranslationId: (id: string | null) => void;
  translations: any[];
  selectedTranslationId: string;
  insertMode: 'single' | 'multiple';
  carouselIndex: number;
  setCarouselIndex: React.Dispatch<React.SetStateAction<number>>;
  settings: PresenterSettings;
  referenceText: string;
}

export const BibleSelectionPreview: React.FC<BibleSelectionPreviewProps> = ({
  selectedVerses,
  secondTranslationId,
  secondTranslationVerse,
  secondTranslationVerses,
  showSecondTranslation,
  setShowSecondTranslation,
  setSecondTranslationId,
  translations,
  selectedTranslationId,
  insertMode,
  carouselIndex,
  setCarouselIndex,
  settings,
  referenceText
}) => {
  const { t } = useTranslation();

  const showCarousel = insertMode === 'multiple' && selectedVerses.length > 1;
  const totalCarouselSlides = showCarousel ? selectedVerses.length : 1;
  const clampedIndex = Math.min(carouselIndex, Math.max(0, totalCarouselSlides - 1));

  const renderContent = () => {
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

    if (showCarousel) {
      const currentVerse = selectedVerses[clampedIndex];
      const matchingSecondVerse = secondTranslationId
        ? secondTranslationVerses.find(sv => sv.verseNumber === currentVerse?.verseNumber)
        : null;

      return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 gap-3">
          <div className="flex-1 flex items-center justify-center w-full min-h-0 px-2">
            <LogicalCanvas containerClassName="rounded-xl ring-1 ring-white/5">
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
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5">
              {selectedVerses.map((v, idx) => (
                <button
                  type="button"
                  key={v.verseNumber}
                  onClick={() => setCarouselIndex(idx)}
                  className={cn(
                    "transition-all rounded-full cursor-pointer",
                    idx === clampedIndex ? "w-6 h-2 bg-amber-500" : "w-2 h-2 bg-stone-700 hover:bg-stone-500"
                  )}
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
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="text-[10px] font-bold text-stone-600 shrink-0">
            {t('slide_of', 'Slide {{current}} of {{total}}', { current: clampedIndex + 1, total: totalCarouselSlides })}
          </span>
        </div>
      );
    }

    const isMulti = selectedVerses.length > 1;
    const hasSecondTranslation = !!secondTranslationId;

    return (
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        <LogicalCanvas containerClassName="rounded-xl ring-1 ring-white/5">
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

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-stone-950/30">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Monitor className="w-3.5 h-3.5 text-stone-500" />
          <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
            {t('slide_preview', 'Slide Preview')}
          </span>
        </div>
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
                  onClick={() => setSecondTranslationId(secondTranslationId === tr.id ? null : tr.id)}
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

      <div className="flex-1 flex flex-col min-h-0 p-4">
        {renderContent()}
      </div>

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
  );
};
