import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAtom } from 'jotai';
import { db } from '@/core/db';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { useMetadata } from './useMetadata';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useShallow } from 'zustand/react/shallow';
import { appModeAtom, previewFontSizeAtom, showReferenceAtom, activeOverrideAtom } from '@/core/store/uiAtoms';
import { Verse, ISlide, ICanvasSlide, PresenterSettings, SlideDisplayProps } from '@/core/types';

/**
 * Hook to orchestrate all data fetching and store state for SlideDisplay
 */
export function useSlideDisplayData(options: SlideDisplayProps) {
  const { 
    isProjector,
    activeVerse: propVerse,
    selectedSlide: propSlide,
    parallelVerse: propParallel, 
    multiVerses: propMultiVerses,
    isMultiVerseMode: propIsMultiVerseMode,
    appMode: propAppMode,
    settings: propSettings 
  } = options;

  const bibleStore = useBibleStore();
  const { settings: globalSettings } = usePresenterStore();
  
  const presentationStore = usePresentationStore(useShallow(s => ({
    selectedPresentationId: s.selectedPresentationId,
    activePresentationId: s.activePresentationId,
    selectedPresentation: s.selectedPresentation,
    activePresentation: s.activePresentation,
    previewSlideId: s.previewSlideId,
    lastTransitionTrigger: s.lastTransitionTrigger,
    navigationDirection: s.navigationDirection
  })));
  
  const [storeAppMode] = useAtom(appModeAtom);
  const [previewFontSize] = useAtom(previewFontSizeAtom);
  const [showRef] = useAtom(showReferenceAtom);
  const [activeOverride] = useAtom(activeOverrideAtom);

  const settings = propSettings || globalSettings;
  const appMode = propAppMode !== undefined ? propAppMode : storeAppMode;

  // 1. Bible Data
  const activeVerse = isProjector ? propVerse : bibleStore.activeVerse;
  const isMultiVerseMode = isProjector
    ? !!propIsMultiVerseMode
    : (bibleStore.isMultiVerseMode || bibleStore.selectedVerses.length >= 2);
  const multiVerses = isProjector ? propMultiVerses : bibleStore.selectedVerses;

  const parallelVerseFromStore = useLiveQuery(
    async () => {
      if (!activeVerse || !bibleStore.secondTranslationId || appMode !== 'scripture' || isMultiVerseMode) return null;
      return await db.verses
        .where('[translationId+bookId+chapter]')
        .equals([bibleStore.secondTranslationId, activeVerse.bookId, activeVerse.chapter])
        .and(v => v.verseNumber === activeVerse.verseNumber)
        .first();
    },
    [activeVerse?.bookId, activeVerse?.chapter, activeVerse?.verseNumber, bibleStore.secondTranslationId, appMode, isMultiVerseMode]
  );
  const parallelVerse = (isProjector && propParallel !== undefined) ? propParallel : parallelVerseFromStore;

  // 2. Presentation Data
  const targetPresentationId = presentationStore.selectedPresentationId || presentationStore.activePresentationId;
  const dbPresentation = useLiveQuery(
    () => targetPresentationId ? db.presentationFiles.get(targetPresentationId) : undefined,
    [targetPresentationId]
  );

  const presentation = useMemo(() => {
    if (presentationStore.selectedPresentation && presentationStore.selectedPresentation.id === presentationStore.selectedPresentationId) return presentationStore.selectedPresentation;
    if (presentationStore.activePresentation && presentationStore.activePresentation.id === presentationStore.activePresentationId) return presentationStore.activePresentation;
    return dbPresentation;
  }, [presentationStore.selectedPresentation, presentationStore.selectedPresentationId, presentationStore.activePresentation, presentationStore.activePresentationId, dbPresentation]);

  const selectedSlideFromStore = useMemo(() =>
    presentation?.slides?.find(s => s.id === presentationStore.previewSlideId),
    [presentation, presentationStore.previewSlideId]
  );
  const selectedSlide = isProjector ? propSlide : selectedSlideFromStore;

  // 3. Bible Block Data (for slides containing Bible content)
  const bibleVerses = useLiveQuery(async () => {
    if (selectedSlide?.blockId !== 'bible' || !(selectedSlide as ICanvasSlide).content?.variables?.verses) return null;
    try {
      const canvasSlide = selectedSlide as ICanvasSlide;
      const verseNumbers = JSON.parse(canvasSlide.content.variables.verses as string) as number[];
      const transId = canvasSlide.content.variables.translationId as string;
      const bId = canvasSlide.content.variables.bookId as string;
      const chap = Number(canvasSlide.content.variables.chapter);

      return await db.verses
        .where('[translationId+bookId+chapter]')
        .equals([transId || 'KJV', bId || 'GEN', chap || 1])
        .filter(v => verseNumbers.includes(v.verseNumber))
        .toArray();
    } catch (e) { return null; }
  }, [selectedSlide]);

  const bibleSecondVerse = useLiveQuery(async () => {
    if (selectedSlide?.blockId !== 'bible') return null;
    const canvasSlide = selectedSlide as ICanvasSlide;
    const vars = canvasSlide.content.variables;
    const secTransId = vars.secondTranslationId as string | undefined;
    if (!secTransId || !vars.bookId || !vars.chapter || !vars.verseStart) return null;
    
    return await db.verses
      .where('[translationId+bookId+chapter]')
      .equals([secTransId, vars.bookId as string, Number(vars.chapter)])
      .and(v => v.verseNumber === Number(vars.verseStart))
      .first() ?? null;
  }, [selectedSlide]);

  // 4. Global Metadata
  const { blocksMap, templatesMap } = useMetadata();

  return {
    appMode,
    settings,
    activeVerse,
    isMultiVerseMode,
    multiVerses,
    parallelVerse,
    presentation,
    selectedSlide,
    bibleVerses,
    bibleSecondVerse,
    blocksMap,
    templatesMap,
    previewFontSize,
    showRef,
    activeOverride,
    presentationStore
  };
}
