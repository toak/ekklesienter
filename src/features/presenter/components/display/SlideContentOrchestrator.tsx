import React from 'react';
import { useTranslation } from 'react-i18next';
import { Presentation as PresentationIcon } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { Verse, ISlide, ICanvasSlide, PresenterSettings } from '@/core/types';

// Display components
import { VerseDisplay } from '../bible/VerseDisplay';
import { ParallelVerseDisplay } from '../bible/ParallelVerseDisplay';
import { MultiVerseDisplay } from '../bible/MultiVerseDisplay';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import SlideCanvas from '../slide-editor/SlideCanvas';

// Transitions
import { 
  CheckerboardTransition, 
  ComicDotsTransition, 
  normalizeTransitionType, 
  getTransitionVariables 
} from './transitions/SlideTransitions';

interface SlideContentOrchestratorProps {
  appMode: 'scripture' | 'presentation';
  isMultiVerseMode: boolean;
  multiVerses: Verse[] | null;
  activeVerse: Verse | null;
  parallelVerse: Verse | null;
  selectedSlide: ISlide | null;
  showRef: boolean;
  previewFontSize: number;
  settings: PresenterSettings;
  isProjector: boolean;
  lang: string;
  
  // Transition related
  isTransitioning: boolean;
  lastTransitionTrigger: number;
  navigationDirection: 'forward' | 'backward';
  
  // Data items for presentation mode
  bibleVerses: Verse[] | null;
  bibleSecondVerse: Verse | null;
  blocksMap: Map<string, any>;
  templatesMap: Map<string, any>;
}

export const SlideContentOrchestrator: React.FC<SlideContentOrchestratorProps> = ({
  appMode,
  isMultiVerseMode,
  multiVerses,
  activeVerse,
  parallelVerse,
  selectedSlide,
  showRef,
  previewFontSize,
  settings,
  isProjector,
  lang,
  isTransitioning,
  lastTransitionTrigger,
  navigationDirection,
  bibleVerses,
  bibleSecondVerse,
  blocksMap,
  templatesMap
}) => {
  const { t } = useTranslation();

  const renderScriptureContent = () => {
    if (isMultiVerseMode && multiVerses && multiVerses.length >= 2) {
      return (
        <MultiVerseDisplay
          verses={multiVerses}
          showReference={showRef}
          autoFit={true}
          className="h-full w-full"
          settings={settings}
        />
      );
    }

    if (!activeVerse) {
      return (
        <div className="h-full flex items-center justify-center text-stone-700 italic text-sm">
          <p>{t('no_verse_selected_short')}</p>
        </div>
      );
    }

    return parallelVerse ? (
      <ParallelVerseDisplay
        verse1={activeVerse}
        verse2={parallelVerse}
        fontSize={previewFontSize}
        autoFit={true}
        settings={settings}
      />
    ) : (
      <VerseDisplay
        key={`${activeVerse.bookId}.${activeVerse.chapter}.${activeVerse.verseNumber}`}
        verse={activeVerse}
        showReference={showRef}
        fontSize={previewFontSize}
        autoFit={true}
        className="h-full w-full"
        isProjector={isProjector}
        settings={settings}
      />
    );
  };

  const renderPresentationContent = () => {
    if (!selectedSlide) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-stone-700 italic gap-4">
          <PresentationIcon className="w-12 h-12 opacity-10" strokeWidth={1} />
          <p className="text-sm">{t('select_slide_hint', 'Select a slide to preview')}</p>
        </div>
      );
    }

    const block = blocksMap.get(selectedSlide.blockId);
    const template = templatesMap.get(selectedSlide.templateId);
    const transition = (selectedSlide as ICanvasSlide).transition || { type: 'none', duration: 0.5 };
    const normalizedType = normalizeTransitionType(transition.type);
    const transitionClass = normalizedType !== 'none' ? `transition-${normalizedType}` : '';

    let content: React.ReactNode;

    if (selectedSlide.blockId === 'bible') {
      const canvasSlide = selectedSlide as ICanvasSlide;
      const isMulti = !!canvasSlide.content.variables.verses && bibleVerses && bibleVerses.length > 1;
      const hasParallel = !isMulti && !!canvasSlide.content.variables.secondTranslationId && !!bibleSecondVerse;

      const primaryVerse: Verse = {
        id: 0,
        bookId: canvasSlide.content.variables.bookId as string || 'GEN',
        chapter: Number(canvasSlide.content.variables.chapter) || 1,
        verseNumber: Number(canvasSlide.content.variables.verseStart) || 1,
        text: canvasSlide.content.variables.content as string || '',
        translationId: canvasSlide.content.variables.translationId as string || 'KJV'
      };

      content = (
        <div className="relative z-10 w-full h-full max-w-full pointer-events-auto overflow-hidden">
          {isMulti ? (
            <MultiVerseDisplay
              verses={bibleVerses!}
              showReference={showRef}
              autoFit={true}
              className="h-full w-full"
              settings={settings}
            />
          ) : hasParallel ? (
            <ParallelVerseDisplay
              verse1={primaryVerse}
              verse2={bibleSecondVerse!}
              autoFit={true}
              settings={settings}
            />
          ) : (
            <VerseDisplay
              verse={primaryVerse}
              showReference={showRef}
              autoFit={true}
              className="h-full w-full"
              isProjector={isProjector}
              settings={settings}
            />
          )}
        </div>
      );
    } else {
      content = (
        <div className="relative z-10 w-full h-full pointer-events-auto">
          <SlideContentRenderer
            template={template}
            block={block}
            variables={(selectedSlide as ICanvasSlide).content?.variables}
            lang={lang}
            backgroundOverride={(selectedSlide as ICanvasSlide).backgroundOverride}
            canvasItems={isProjector ? (selectedSlide as ICanvasSlide).content?.canvasItems : undefined}
            slide={selectedSlide}
            slideId={selectedSlide.id}
            isPreview={!isProjector}
          />
          {!isProjector && (
            <SlideCanvas slideId={selectedSlide.id} canvasItems={(selectedSlide as ICanvasSlide).content?.canvasItems || []} />
          )}
        </div>
      );
    }

    return (
      <div
        key={`${selectedSlide.id}-${lastTransitionTrigger}`}
        className={cn(
          "relative origin-center pointer-events-none h-full w-full",
          transitionClass && "transition-active",
          transitionClass
        )}
        style={{
          ...getTransitionVariables(transition, navigationDirection === 'backward'),
          transform: transitionClass ? `translate(var(--tx-start, 0%), var(--ty-start, 0%)) scale(var(--s-start, 1))` : undefined,
          opacity: transitionClass ? `var(--op-start, 1)` : undefined,
        }}
      >
        {isTransitioning && normalizedType === 'checkerboard' ? (
          <CheckerboardTransition transition={transition}>
            {content}
          </CheckerboardTransition>
        ) : isTransitioning && normalizedType === 'comic-dots' ? (
          <ComicDotsTransition transition={transition}>
            {content}
          </ComicDotsTransition>
        ) : content}
      </div>
    );
  };

  return appMode === 'scripture' ? renderScriptureContent() : renderPresentationContent();
};
