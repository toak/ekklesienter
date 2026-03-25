import React from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';

// Store imports
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import {
  sidebarOpenAtom,
  historyOpenAtom,
} from '@/core/store/uiAtoms';

// Hooks and Services
import { LiveSyncService } from '@/core/services/liveSyncService';
import { IpcService } from '@/core/services/IpcService';
import { useSlideDisplayData } from '../../hooks/useSlideDisplayData';
import { useSlideTransitionManager } from '../../hooks/useSlideTransitionManager';

// Utils and Types
import { cn } from '@/core/utils/cn';
import { SlideDisplayProps } from '@/core/types';

// Component imports
import { SlideBackground } from './SlideBackground';
import LogicalCanvas from '../slide-editor/LogicalCanvas';
import { SlideContentOrchestrator } from './SlideContentOrchestrator';

const SlideDisplay: React.FC<SlideDisplayProps> = (props) => {
  const { isProjector = false } = props;
  const { i18n } = useTranslation();
  const lang = i18n.language?.substring(0, 2) || 'en';

  // 1. Data Orchestration
  const data = useSlideDisplayData(props);
  const {
    appMode,
    settings,
    activeVerse,
    isMultiVerseMode,
    multiVerses,
    parallelVerse,
    selectedSlide,
    presentationStore,
    previewFontSize,
    showRef,
    activeOverride,
    bibleVerses,
    bibleSecondVerse,
    blocksMap,
    templatesMap
  } = data;

  const currentKey = `${appMode}-${appMode === 'scripture' ? activeVerse?.id : selectedSlide?.id}-${presentationStore.lastTransitionTrigger}`;

  // 2. Transition Management
  const {
    prevSlideState,
    isTransitioning,
    prevContentRef
  } = useSlideTransitionManager(currentKey, selectedSlide, presentationStore.lastTransitionTrigger);

  // 3. Side Effects (Projector Sync & Mode Sync)
  React.useEffect(() => {
    if (isProjector || !IpcService.isElectron()) return;

    const unsub = IpcService.on('projector-ready', () => {
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

  React.useEffect(() => {
    if (isProjector) return;
    LiveSyncService.showAppMode(appMode);
  }, [appMode, isProjector]);

  // 4. Render Content
  const content = (
    <SlideContentOrchestrator
      appMode={appMode}
      isMultiVerseMode={isMultiVerseMode}
      multiVerses={multiVerses}
      activeVerse={activeVerse}
      parallelVerse={parallelVerse}
      selectedSlide={selectedSlide}
      showRef={showRef}
      previewFontSize={previewFontSize}
      settings={settings}
      isProjector={isProjector}
      lang={lang}
      isTransitioning={isTransitioning}
      lastTransitionTrigger={presentationStore.lastTransitionTrigger}
      navigationDirection={presentationStore.navigationDirection}
      bibleVerses={bibleVerses}
      bibleSecondVerse={bibleSecondVerse}
      blocksMap={blocksMap}
      templatesMap={templatesMap}
    />
  );
  
  // Update ref for transition caching
  prevContentRef.current = content;

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
        aspectRatioOverride={appMode === 'presentation' ? (16 / 9) : undefined}
        autoFill={isProjector}
        containerClassName={cn(
          'transition-all duration-300',
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
