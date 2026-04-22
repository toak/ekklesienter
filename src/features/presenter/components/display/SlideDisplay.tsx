import React, { useCallback } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';

// Store imports
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import {
  sidebarOpenAtom,
  historyOpenAtom,
  slideDesignPanelOpenAtom,
  canvasZoomAtom,
  canvasOffsetAtom,
} from '@/core/store/uiAtoms';
import { useAtomValue } from 'jotai';

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
import SlideCanvas from '../slide-editor/SlideCanvas';
import SlideEditorToolbar from '../slide-editor/SlideEditorToolbar';
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
    presentation,
    selectedSlide,
    showRef,
    previewFontSize,
    presentationStore,
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
      hasActivePresentation={!!presentation}
      showRef={showRef}
      previewFontSize={previewFontSize}
      settings={settings}
      isProjector={isProjector}
      isPreloading={props.isPreloading}
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
  React.useEffect(() => {
    prevContentRef.current = content;
  }, [content, prevContentRef]);

  const sidebarOpen = useAtomValue(sidebarOpenAtom);
  const historyOpen = useAtomValue(historyOpenAtom);
  const designPanelOpen = useAtomValue(slideDesignPanelOpenAtom);

  const [zoom, setZoom] = useAtom(canvasZoomAtom);
  const [offset, setOffset] = useAtom(canvasOffsetAtom);

  // Reset zoom/offset when switching to Bible mode
  React.useEffect(() => {
    if (appMode === 'scripture' && !isProjector) {
      setZoom(1.0);
      setOffset({ x: 0, y: 0 });
    }
  }, [appMode, isProjector, setZoom, setOffset]);

  const viewportPadding = React.useMemo(() => {
    if (isProjector) return { top: 0, bottom: 0, left: 0, right: 0 };
    
    const baseGap = 32;
    let pr = baseGap;
    let pt = 80;
    // In presentation mode the timeline is always 300px (252+48).
    // Add baseGap so the slide preview never overlaps the timeline.
    let pb = appMode === 'presentation' ? 300 + baseGap : 48;
    let pl = baseGap;

    if (appMode === 'presentation') {
      if (designPanelOpen) pr = 320 + baseGap;
      else if (historyOpen) pr = 300 + baseGap;
    } else if (sidebarOpen || historyOpen) {
      pt = 80; pb = 192; pl = 48; pr = 48;
    } else {
      pt = 48; pb = 48; pl = 48; pr = 48;
    }

    return { top: pt, bottom: pb, left: pl, right: pr };
  }, [appMode, isProjector, sidebarOpen, historyOpen, designPanelOpen]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (isProjector || appMode === 'scripture') return;
    
    // Ctrl + Wheel is Pinch-to-Zoom on touchpad/trackpad
    const isPinch = e.ctrlKey;
    const delta = e.deltaY;
    
    // Calculate zoom factor
    const zoomIntensity = isPinch ? 0.01 : 0.05;
    const factor = Math.exp(-delta * zoomIntensity);
    const newZoom = Math.min(Math.max(zoom * factor, 0.1), 4);
    
    if (newZoom === zoom) return;

    // Zoom towards Mouse Position
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Center of the current container
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Mouse relative to center
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;

    // New offset to keep mouse point fixed
    // If we're at 100% (zoom=1.0), we reset offset if they zoom out to exactly 1.0 but usually we just transition.
    const sRatio = newZoom / zoom;
    const newOffset = {
      x: offset.x * sRatio - dx * (sRatio - 1),
      y: offset.y * sRatio - dy * (sRatio - 1)
    };

    setZoom(newZoom);
    setOffset(newOffset);
  }, [isProjector, zoom, offset, setZoom, setOffset]);

  return (
    <div
      className={cn(
        'h-full w-full relative group transition-all duration-300 ease-in-out',
        isProjector ? 'bg-black overflow-hidden' : 'bg-transparent'
      )}
      onWheel={handleWheel}
    >
      <LogicalCanvas
        aspectRatioOverride={appMode === 'presentation' ? (16 / 9) : undefined}
        autoFill={isProjector}
        viewportPadding={viewportPadding}
        containerClassName={cn(
          'relative',
          !isProjector && 'ring-1 ring-white/10 border border-white/5 shadow-2xl'
        )}
        zoom={zoom}
        offset={offset}
        style={{
          borderRadius: settings?.display?.cornerRadius ? `${settings.display.cornerRadius}px` : undefined,
        }}
      >
        <SlideBackground background={settings?.background} />
        <div className="relative z-10 w-full h-full">
          {prevSlideState && (
            <div key={prevSlideState.key} className="absolute inset-0 z-0 pointer-events-none overflow-visible">
              {prevSlideState.content}
            </div>
          )}
          <div key={currentKey} className="absolute inset-0 z-10 pointer-events-auto overflow-visible">
            {content}
          </div>
        </div>
      </LogicalCanvas>

      {/* 5. Editor Toolbar */}
      {appMode === 'presentation' && !isProjector && selectedSlide && (
        <SlideEditorToolbar />
      )}
    </div>
  );
};

export default SlideDisplay;

