import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAtom } from 'jotai';
import {
  Monitor, Music, Coins, Baby, Mic2, Megaphone,
  Presentation as PresentationIcon, CheckCircle2, Trash2
} from 'lucide-react';

// Store imports
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import {
  previewFontSizeAtom,
  showReferenceAtom,
  appModeAtom,
  sidebarOpenAtom,
  historyOpenAtom,
  activeOverrideAtom
} from '@/core/store/uiAtoms';

// Hooks and Services
import { useContainFit } from '@/core/hooks/useContainFit';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { db } from '@/core/db';

// Utils and Types
import { cn } from '@/core/utils/cn';
import { Verse, ISlide, ICanvasSlide, IVerseSlide, ISlideTransition, PresenterSettings } from '@/core/types';

// Component imports
import { VerseDisplay } from '../bible/VerseDisplay';
import { ParallelVerseDisplay } from '../bible/ParallelVerseDisplay';
import { MultiVerseDisplay } from '../bible/MultiVerseDisplay';
import { SlideBackground } from './SlideBackground';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import SlideCanvas from '../slide-editor/SlideCanvas';
import LogicalCanvas from '../slide-editor/LogicalCanvas';

const TileContent = React.memo(({ children }: { children: React.ReactNode }) => (
  <div className="w-full h-full overflow-hidden">
    {children}
  </div>
));

const CheckerboardTransition: React.FC<{
  children: React.ReactNode;
  transition: ISlideTransition;
}> = ({ children, transition }) => {
  const rows = 9; // Perfectly square in 16:9
  const cols = 16;
  const cells = Array.from({ length: rows * cols });

  const duration = transition.duration;
  const maxDist = Math.sqrt(Math.pow((cols - 1) / 2, 2) + Math.pow((rows - 1) / 2, 2));

  return (
    <div
      className="transition-checkerboard-container w-full h-full grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        '--transition-duration': `${duration}s`
      } as React.CSSProperties}
    >
      {cells.map((_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const isB = (r + c) % 2 === 0;

        const dc = c - (cols - 1) / 2;
        const dr = r - (rows - 1) / 2;
        const dist = Math.sqrt(dc * dc + dr * dr);
        const staggerProgress = dist / maxDist; // 0 to 1

        const phaseDelay = isB ? 0 : duration * 0.15;
        const staggerDelay = staggerProgress * (duration * 0.3); // Even snappier
        const totalDelay = phaseDelay + staggerDelay;
        const cellDuration = duration * 0.55;

        return (
          <div
            key={i}
            className="transition-checkerboard-cell relative"
            style={{
              '--tile-delay': `${totalDelay.toFixed(3)}s`,
              '--tile-duration': `${cellDuration.toFixed(3)}s`,
              width: '100%',
              height: '100%',
              willChange: 'transform, opacity',
              transform: 'translateZ(0)',
              contain: 'paint',
            } as React.CSSProperties}
          >
            <div
              className="absolute pointer-events-none overflow-hidden"
              style={{
                width: `${cols * 100}%`,
                height: `${rows * 100}%`,
                left: `-${c * 100}%`,
                top: `-${r * 100}%`,
              }}
            >
              <TileContent>{children}</TileContent>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ComicDotsTransition: React.FC<{
  children: React.ReactNode;
  transition: ISlideTransition;
}> = ({ children, transition }) => {
  const rows = 9; // Perfectly square in 16:9
  const cols = 16;
  const cells = Array.from({ length: rows * cols });

  return (
    <div
      className="transition-comic-dots-container w-full h-full grid overflow-hidden"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        '--transition-duration': `${transition.duration}s`
      } as any}
    >
      {cells.map((_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;

        const sizeFactor = (c + (rows - 1 - r)) / (cols + rows - 2);
        const staggerFactor = (c + (rows - 1 - r)) / (cols + rows - 2);
        const delay = staggerFactor * transition.duration * 0.6;

        const dotPeak = 1.3 + sizeFactor * 0.2;

        return (
          <div
            key={i}
            className="relative overflow-hidden"
          >
            <div
              className="transition-comic-dot-cell absolute overflow-hidden"
              style={{
                '--tile-delay': `${delay.toFixed(3)}s`,
                '--dot-peak': dotPeak.toFixed(2),
                width: '100%',
                height: '100%',
                willChange: 'transform, opacity',
                transform: 'translateZ(0)',
              } as React.CSSProperties}
            >
              <div
                className="absolute pointer-events-none"
                style={{
                  width: `${cols * 100}%`,
                  height: `${rows * 100}%`,
                  left: `-${c * 100}%`,
                  top: `-${r * 100}%`,
                }}
              >
                <TileContent>{children}</TileContent>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const normalizeTransitionType = (type: string): string => {
  if (type.startsWith('slide-')) return 'slide';
  if (type.startsWith('push-')) return 'push';
  if (type.startsWith('pan-')) return 'pan';
  if (type.startsWith('zoom-')) return 'zoom';
  return type;
};

const normalizeTransitionDirection = (type: string, direction?: string, reverse?: boolean): string => {
  let dir = direction;
  if (!dir) {
    if (type.endsWith('-up')) dir = 'top';
    else if (type.endsWith('-down')) dir = 'bottom';
    else if (type.endsWith('-left')) dir = 'left';
    else if (type.endsWith('-right')) dir = 'right';
    else if (type.endsWith('-in')) dir = 'in';
    else if (type.endsWith('-out')) dir = 'out';
    else dir = 'right';
  }

  if (reverse) {
    const opposites: Record<string, string> = {
      'top': 'bottom',
      'bottom': 'top',
      'left': 'right',
      'right': 'left',
      'in': 'out',
      'out': 'in'
    };
    return opposites[dir] || dir;
  }
  return dir;
};

const getTransitionVariables = (transition: ISlideTransition, reverse?: boolean): React.CSSProperties => {
  // Normalize legacy and generic transition values
  const normalizedType = normalizeTransitionType(transition.type);
  const dir = normalizeTransitionDirection(transition.type, transition.direction, reverse);

  let tx = '0%';
  let ty = '0%';
  let s = '1';
  let op = '1';

  if (['slide', 'push', 'pan'].includes(normalizedType)) {
    const isBig = normalizedType !== 'pan';
    const offset = (dir === 'left' || dir === 'top')
      ? (isBig ? '100%' : '-10%')
      : (isBig ? '-100%' : '10%');

    if (dir === 'top' || dir === 'bottom') ty = offset;
    if (dir === 'left' || dir === 'right') tx = offset;
  }

  if (normalizedType === 'zoom') {
    s = dir === 'in' ? '0.5' : '1.5';
    op = '0';
  }

  if (normalizedType === 'slide') {
    s = '0.95'; // Modern subtle scale up effect
  }

  return {
    '--transition-duration': `${transition.duration}s`,
    '--tx-start': tx,
    '--ty-start': ty,
    '--s-start': s,
    '--op-start': op,
  } as React.CSSProperties;
};

interface SlideDisplayProps {
  isProjector?: boolean;
  activeVerse?: Verse | null;
  selectedSlide?: ISlide | null;
  parallelVerse?: Verse | null;
  multiVerses?: Verse[] | null;
  isMultiVerseMode?: boolean;
  appMode?: 'scripture' | 'presentation';
  settings?: PresenterSettings;
}

const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

const SlideDisplay: React.FC<SlideDisplayProps> = ({
  isProjector: isProjectorProp,
  activeVerse: propVerse,
  selectedSlide: propSlide,
  parallelVerse: propParallel,
  multiVerses: propMultiVerses,
  isMultiVerseMode: propIsMultiVerseMode,
  appMode: propAppMode,
  settings: propSettings,
}) => {
  // ... existing store hooks ...
  const {
    activeVerse: storeVerse,
    navigateNext,
    navigatePrev,
    secondTranslationId,
    selectedVerses,
    isMultiVerseMode: storeIsMultiVerseMode,
    commitToProjector,
    exitMultiVerseMode,
    projectorIsLive,
  } = useBibleStore();
  const { settings: globalSettings, updateBackground } = usePresenterStore();

  const settings = propSettings || globalSettings;
  const activePresentationId = usePresentationStore(s => s.activePresentationId);
  const selectedPresentationId = usePresentationStore(s => s.selectedPresentationId);
  const activePresentation = usePresentationStore(s => s.activePresentation);
  const selectedPresentation = usePresentationStore(s => s.selectedPresentation);
  const previewSlideId = usePresentationStore(s => s.previewSlideId);
  const setPreviewSlide = usePresentationStore(s => s.setPreviewSlide);
  const lastTransitionTrigger = usePresentationStore(s => s.lastTransitionTrigger);
  const navigationDirection = usePresentationStore(s => s.navigationDirection);

  const [storeAppMode] = useAtom(appModeAtom);
  const [previewFontSize] = useAtom(previewFontSizeAtom);
  const [showRef] = useAtom(showReferenceAtom);
  const [activeOverride] = useAtom(activeOverrideAtom);
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.substring(0, 2) || 'en';

  const isProjector = !!isProjectorProp;
  const [windowRatio, setWindowRatio] = React.useState(window.innerWidth / window.innerHeight);

  const appMode = propAppMode !== undefined ? propAppMode : storeAppMode;

  React.useEffect(() => {
    if (!isProjector) return;
    const handleResize = () => setWindowRatio(window.innerWidth / window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isProjector]);

  // Priority 1: Current selected presentation from store (nested editor)
  const activeVerse = isProjector ? propVerse : storeVerse;

  const isMultiVerseMode = isProjector
    ? !!propIsMultiVerseMode
    : (storeIsMultiVerseMode || selectedVerses.length >= 2);

  const multiVerses = isProjector ? propMultiVerses : selectedVerses;

  // DB Query for persistence/fallback
  const dbPresentation = useLiveQuery(
    () => {
      const targetId = selectedPresentationId || activePresentationId;
      return targetId ? db.presentationFiles.get(targetId) : undefined;
    },
    [selectedPresentationId, activePresentationId]
  );

  // Priority 1: Current selected presentation from store (nested editor)
  // Priority 2: Active presentation from store (master timeline)
  // Priority 3: Database fallback
  const presentation = useMemo(() => {
    if (selectedPresentation && selectedPresentation.id === selectedPresentationId) return selectedPresentation;
    if (activePresentation && activePresentation.id === activePresentationId) return activePresentation;
    return dbPresentation;
  }, [selectedPresentation, selectedPresentationId, activePresentation, activePresentationId, dbPresentation]);

  const blocks = useLiveQuery(() => db.blocks.toArray()) || [];
  const blocksMap = useMemo(() => new Map(blocks.map(b => [b.id, b])), [blocks]);
  const templates = useLiveQuery(() => db.templates.toArray()) || [];
  const templatesMap = useMemo(() => new Map(templates.map(t => [t.id, t])), [templates]);

  // Derived slide selection
  const selectedSlideFromStore = useMemo(() =>
    presentation?.slides?.find(s => s.id === previewSlideId),
    [presentation, previewSlideId]
  );
  const selectedSlide = isProjector ? propSlide : selectedSlideFromStore;

  const currentKey = `${appMode}-${appMode === 'scripture' ? activeVerse?.id : selectedSlide?.id}-${lastTransitionTrigger}`;
  const currentKeyRef = React.useRef(currentKey);
  const prevContentRef = React.useRef<React.ReactNode>(null);
  const [prevSlideState, setPrevSlideState] = React.useState<{ key: string, content: React.ReactNode } | null>(null);
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  // Synchronous phase: detect slide change and cache previous
  if (currentKey !== currentKeyRef.current) {
    setPrevSlideState({ key: currentKeyRef.current, content: prevContentRef.current });
    currentKeyRef.current = currentKey;

    // Synchronously set isTransitioning for complex transitions to avoid flicker
    const transition = (selectedSlide as ICanvasSlide)?.transition || { type: 'none', duration: 0.5 };
    const type = normalizeTransitionType(transition.type);
    if (type === 'checkerboard' || type === 'comic-dots') {
      setIsTransitioning(true);
    } else {
      setIsTransitioning(false);
    }
  }

  React.useEffect(() => {
    if (prevSlideState) {
      const transition = (selectedSlide as ICanvasSlide)?.transition || { type: 'none', duration: 0.5 };
      const dur = Math.max(transition.duration * 1000 + 200, 100);
      const timer = setTimeout(() => {
        setPrevSlideState(curr => curr?.key === prevSlideState.key ? null : curr);
      }, dur);
      return () => clearTimeout(timer);
    }
  }, [prevSlideState?.key, (selectedSlide as ICanvasSlide)?.transition]);

  // Handle complex transition timeout
  React.useEffect(() => {
    if (isTransitioning && selectedSlide) {
      const transition = (selectedSlide as ICanvasSlide).transition || { type: 'none', duration: 0.5 };
      const timeout = Math.max(transition.duration * 1000 + 50, 100);
      const timer = setTimeout(() => setIsTransitioning(false), timeout);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning, selectedSlide?.id, lastTransitionTrigger]);

  const parallelVerseFromStore = useLiveQuery(
    async () => {
      if (!activeVerse || !secondTranslationId || appMode !== 'scripture' || isMultiVerseMode) return null;
      return await db.verses
        .where('[translationId+bookId+chapter]')
        .equals([secondTranslationId, activeVerse.bookId, activeVerse.chapter])
        .and(v => v.verseNumber === activeVerse.verseNumber)
        .first();
    },
    [activeVerse?.bookId, activeVerse?.chapter, activeVerse?.verseNumber, secondTranslationId, appMode, isMultiVerseMode]
  );
  const parallelVerse = (isProjector && propParallel !== undefined) ? propParallel : parallelVerseFromStore;

  // ... navigation effect ...
  // Scripture-mode keyboard navigation (presentation mode is handled by useTimelineHotkeys)

  // ... projector-ready effect ...
  React.useEffect(() => {
    if (isProjector || !window.electron?.ipcRenderer) return;

    const unsub = window.electron.ipcRenderer.on('projector-ready', () => {
      const store = useBibleStore.getState();
      const { activeVerse, isMultiVerseMode: multiMode, selectedVerses, secondTranslationId: secId } = store;

      LiveSyncService.showAppMode(appMode);

      if (appMode === 'scripture') {
        if (multiMode && selectedVerses.length >= 2) {
          LiveSyncService.showMultiVerses(selectedVerses, secId);
        } else if (activeVerse) {
          LiveSyncService.showVerse(activeVerse, secId);
        }
      }
    });

    return () => unsub?.();
  }, [isProjector, appMode, selectedSlide]);

  // ... app mode sync effects ...
  React.useEffect(() => {
    if (isProjector) return;
    LiveSyncService.showAppMode(appMode);
  }, [appMode, isProjector]);

  // Fetch verses if it's a multi-verse Bible slide
  // We move this to the top level to follow rules of hooks
  const bibleVerses = useLiveQuery(async () => {
    if (selectedSlide?.blockId !== 'bible' || !(selectedSlide as ICanvasSlide).content?.variables?.verses) return null;
    try {
      const canvasSlide = selectedSlide as ICanvasSlide;
      const verseNumbers = JSON.parse(canvasSlide.content.variables.verses as string) as number[];
      const translationId = canvasSlide.content.variables.translationId as string;
      const bookId = canvasSlide.content.variables.bookId as string;
      const chapter = Number(canvasSlide.content.variables.chapter);

      return await db.verses
        .where('[translationId+bookId+chapter]')
        .equals([translationId || 'KJV', bookId || 'GEN', chapter || 1])
        .filter(v => verseNumbers.includes(v.verseNumber))
        .toArray();
    } catch (e) {
      return null;
    }
  }, [selectedSlide]);

  // Fetch second translation verse for bible slides with parallel translation
  const bibleSecondVerse = useLiveQuery(async () => {
    if (selectedSlide?.blockId !== 'bible') return null;
    const canvasSlide = selectedSlide as ICanvasSlide;
    const vars = canvasSlide.content.variables;
    const secTranslationId = vars.secondTranslationId as string | undefined;
    if (!secTranslationId) return null;
    const bookId = vars.bookId as string;
    const chapter = Number(vars.chapter);
    const verseStart = Number(vars.verseStart);
    if (!bookId || !chapter || !verseStart) return null;
    return await db.verses
      .where('[translationId+bookId+chapter]')
      .equals([secTranslationId, bookId, chapter])
      .and(v => v.verseNumber === verseStart)
      .first() ?? null;
  }, [selectedSlide]);


  // ─── Render ───────────────────────────────────────────────────────────────
  const renderContent = () => {
    if (appMode === 'scripture') {
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
    }

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

    // Presentation Mode Scale Calculation
    const scale = 1;

    if (selectedSlide.blockId === 'bible') {
      const canvasSlide = selectedSlide as ICanvasSlide;
      const isMulti = !!canvasSlide.content.variables.verses && bibleVerses && bibleVerses.length > 1;
      const hasParallel = !isMulti && !!canvasSlide.content.variables.secondTranslationId && !!bibleSecondVerse;

      const primaryVerse: Verse = {
        id: 0, // Slides don't have numeric IDs, use 0 for display
        bookId: canvasSlide.content.variables.bookId as string || 'GEN',
        chapter: Number(canvasSlide.content.variables.chapter) || 1,
        verseNumber: Number(canvasSlide.content.variables.verseStart) || 1,
        text: canvasSlide.content.variables.content as string || '',
        translationId: canvasSlide.content.variables.translationId as string || 'KJV'
      };

      const content = (
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

      return (
        <div
          key={`${selectedSlide.id}-${lastTransitionTrigger}`}
          className={cn(
            "relative origin-center pointer-events-none overflow-hidden h-full w-full",
            transitionClass && "transition-active",
            transitionClass
          )}
          style={{
            ...getTransitionVariables(transition, navigationDirection === 'backward'),
            // Force initial state synchronously to prevent flicker before animation starts
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
    }

    const content = (
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
          // Force initial state synchronously to prevent flicker before animation starts
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

  const content = renderContent();
  prevContentRef.current = content; // Keep the ref updated with the output of the current render.

  const [sidebarOpen] = useAtom(sidebarOpenAtom);
  const [historyOpen] = useAtom(historyOpenAtom);

  return (
    <div
      className={cn(
        'h-full w-full relative group overflow-hidden flex items-center justify-center transition-all duration-500 ease-in-out',
        isProjector ? 'bg-black' : cn(
          'bg-black/20',
          appMode === 'presentation'
            ? 'pt-[80px] pb-[260px] px-6'
            : (sidebarOpen || historyOpen) ? 'pt-20 pb-48 px-12' : 'p-12'
        )
      )}
    >
      <LogicalCanvas
        // ЖЕСТКАЯ ФИКСАЦИЯ: Слайд и его рамка всегда будут 16:9 в режиме презентации
        aspectRatioOverride={appMode === 'presentation' ? (16 / 9) : undefined}
        autoFill={isProjector}

        containerClassName={cn(
          'transition-all duration-300',
          // ИСПРАВЛЕНИЕ: Полностью удалили shadow-[0_40px_100px_rgba(0,0,0,0.8)]
          !isProjector && 'ring-1 ring-white/10 border border-white/5'
        )}
        className="overflow-hidden"
        style={{
          borderRadius: settings?.display?.cornerRadius ? `${settings.display.cornerRadius}px` : undefined,
        }}
      >
        <SlideBackground background={settings?.background} />
        <div className="relative z-10 w-full h-full">
          {prevSlideState && (
            <div key={prevSlideState.key} className="absolute inset-0 z-0 pointer-events-none">
              {prevSlideState.content}
            </div>
          )}
          <div key={currentKey} className="absolute inset-0 z-10 pointer-events-auto">
            {content}
          </div>
        </div>
      </LogicalCanvas>
    </div>
  );
};

export default SlideDisplay;
