import React, { useState, useCallback, useRef, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { db } from '@/core/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Verse, ILogo } from '@/core/types';
import { getBookName } from '@/core/data/bookData';
import { useAtom } from 'jotai';
import { 
  sidebarOpenAtom, 
  themeAccentAtom, 
  historyOpenAtom, 
  searchOpenAtom, 
  appModeAtom, 
  activeOverrideAtom, 
  liveLogoAtom, 
  slideDesignPanelOpenAtom, 
  isTimelineHoveredAtom, 
  selectedCanvasItemIdsAtom, 
  OverrideType 
} from '@/core/store/uiAtoms';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import {
  Trash2, CheckCircle2
} from 'lucide-react';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useTranslation } from 'react-i18next';
import { PRELOADED_LOGOS } from '@/core/data/logoData';
import { useLogoUrl } from '@/core/hooks/useLogoUrl';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { IpcService } from '@/core/services/IpcService';
import { Toaster } from 'sonner';
import { FontPrewarmer } from '@/features/presenter/components/fonts/FontPrewarmer';
import PromptModal from '@/shared/ui/modals/PromptModal';
import ConfirmModal from '@/shared/ui/modals/ConfirmModal';

import SlideDisplay from '@/features/presenter/components/display/SlideDisplay';
import ProjectorView from '@/features/presenter/components/display/ProjectorView';
import SlideTimeline from '@/features/presenter/components/timeline/SlideTimeline';
import SlideDesignPanel from '@/features/presenter/components/SlideDesignPanel';
import HistoryPanel from '@/features/bible-browser/components/HistoryPanel';

import { useAppInitialization } from './hooks/useAppInitialization';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useAudioSync } from './hooks/useAudioSync';
import { AppSidebar } from './components/AppSidebar';
import { AppToolbar } from './components/AppToolbar';
import { StatusOverlay } from './components/StatusOverlay';
import { VersePreviews } from './components/VersePreviews';
import { AppModals } from './components/AppModals';


const ControllerLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom);
  const [historyOpen, setHistoryOpen] = useAtom(historyOpenAtom);
  const [searchOpen, setSearchOpen] = useAtom(searchOpenAtom);
  const [appMode] = useAtom(appModeAtom);
  const [themeAccent] = useAtom(themeAccentAtom);
  const [designPanelOpen, setDesignPanelOpen] = useAtom(slideDesignPanelOpenAtom);
  const isTimelineHovered = useAtom(isTimelineHoveredAtom)[0];
  const selectedCanvasItemIds = useAtom(selectedCanvasItemIdsAtom)[0];

  const [projectorOpen, setProjectorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    activeVerse,
    currentTranslationId,
    setActiveVerse,
    isMultiVerseMode,
    selectedVerses,
    commitToProjector,
    exitMultiVerseMode,
    projectorIsLive
  } = useBibleStore();
  const {
    liveSlideId,
    activeServiceId,
    activePresentationId,
    activePresentation,
    previewSlideId,
    setActivePresentation,
    setPreviewSlide,
    setLiveSlide,
    undo,
    redo
  } = usePresentationStore();

  // 1. App-level Initialization (Templates, Persisted State)
  useAppInitialization(themeAccent);

  // 2. Audio State Synchronization
  useAudioSync();

  const { t, i18n } = useTranslation();
  const lang = i18n.language?.substring(0, 2) || 'en';

  // 3. Verse Previews (Scripture Mode)
  const nextVersePreview = useLiveQuery(
    async () => {
      if (!activeVerse) return null;
      return await db.verses
        .where('[translationId+bookId+chapter]')
        .equals([currentTranslationId, activeVerse.bookId, activeVerse.chapter])
        .and(v => v.verseNumber === activeVerse.verseNumber + 1)
        .first();
    },
    [activeVerse?.id, currentTranslationId]
  );

  const prevVersePreview = useLiveQuery(
    async () => {
      if (!activeVerse) return null;
      return await db.verses
        .where('[translationId+bookId+chapter]')
        .equals([currentTranslationId, activeVerse.bookId, activeVerse.chapter])
        .and(v => v.verseNumber === activeVerse.verseNumber - 1)
        .first();
    },
    [activeVerse?.id, currentTranslationId]
  );

  const [activeOverride, setActiveOverride] = useAtom(activeOverrideAtom) as any;
  const [activeLogo, setActiveLogo] = useAtom(liveLogoAtom) as any;
  const { settings } = usePresenterStore();
  const activeLogoUrl = useLogoUrl(activeLogo);

  // Sync active logo object to atom for live display
  useEffect(() => {
    const allLogos = [
      ...settings.logo.customLogos,
      ...settings.logo.customGroups.flatMap(g => g.logos),
      ...settings.logo.logoGroups.flatMap(g => g.logos),
      ...PRELOADED_LOGOS.flatMap(g => g.logos)
    ];
    const active = allLogos.find(l => l.id === settings.logo.activeLogoId);
    setActiveLogo(active || null);
  }, [settings.logo.activeLogoId, settings.logo.customLogos, settings.logo.customGroups, settings.logo.logoGroups, setActiveLogo]);

  const toggleOverride = useCallback((type: OverrideType) => {
    setActiveOverride((prev: OverrideType | null) => {
        const next = prev === type ? null : type;
        // If we are activating an override, ensure the projector has the latest settings first
        if (next) {
            LiveSyncService.syncSettings(usePresenterStore.getState().settings);
        }
        return next;
    });
  }, [setActiveOverride]);

  useEffect(() => {
    // Sync latest override to projector
    LiveSyncService.setOverride(activeOverride as OverrideType | null, activeOverride === 'logo' ? activeLogo : null);
  }, [activeOverride, activeLogo]);

  useEffect(() => {
    // Proactively sync settings whenever they change
    LiveSyncService.syncSettings(settings);
  }, [settings]);

  const openGlobalModal = useCallback((type: ModalType) => {
    useModalStore.getState().openModal(type);
  }, []);

  // Projector Actions
  const openProjector = async () => {
    const displaySettings = usePresenterStore.getState().settings.display;
    if (IpcService.isElectron()) {
      await IpcService.invoke('open-projector', displaySettings);
      setProjectorOpen(true);
    }
  };

  const closeProjector = useCallback(() => {
    LiveSyncService.clear();
    useBibleStore.setState({ projectorIsLive: false });
    usePresentationStore.getState().setLiveSlide(null);
    if (IpcService.isElectron()) IpcService.invoke('close-projector');
  }, []);

  // Navigation Actions
  const handleNext = useCallback(async (detached?: boolean) => {
    if (appMode === 'scripture') {
      useBibleStore.getState().navigateNext(detached);
    } else {
      await usePresentationStore.getState().navigateNext(detached);
    }
  }, [appMode]);

  const handlePrev = useCallback(async (detached?: boolean) => {
    if (appMode === 'scripture') {
      useBibleStore.getState().navigatePrev(detached);
    } else {
      await usePresentationStore.getState().navigatePrev(detached);
    }
  }, [appMode]);

  // 4. Global Keyboard Shortcuts
  useGlobalShortcuts({
    appMode,
    previewSlideId,
    activePresentation,
    activeVerse,
    selectedCanvasItemIds,
    isTimelineHovered,
    handleNext,
    handlePrev,
    openProjector,
    closeProjector,
    toggleOverride
  });

  // Projector Handshake
  useEffect(() => {
    if (!IpcService.isElectron()) return;
    const unsub = IpcService.on('projector-ready', (p?: { ratio: number }) => {
      if (p?.ratio) usePresenterStore.getState().updateDisplay({ aspectRatio: p.ratio });
      IpcService.send('projector-command', 'update-theme', themeAccent);
      
      // Sync full settings on startup/handshake
      LiveSyncService.syncSettings(usePresenterStore.getState().settings);
      
      // Delay override sync slightly to ensure settings are processed
      setTimeout(() => {
        LiveSyncService.setOverride(activeOverride as OverrideType | null, activeOverride === 'logo' ? activeLogo : null);
        if (appMode === 'scripture' && useBibleStore.getState().activeVerse) {
          LiveSyncService.showVerse(useBibleStore.getState().activeVerse!, useBibleStore.getState().secondTranslationId);
        }
      }, 100);
    });
    return () => unsub();
  }, [themeAccent, activeOverride, activeLogo, appMode]);

    const isBibleSlide = React.useMemo(() => {
        if (!activePresentation || !previewSlideId) return false;
        const slide = activePresentation.slides.find(s => s.id === previewSlideId);
        return slide?.blockId === 'bible';
    }, [activePresentation, previewSlideId]);

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-stone-950 text-stone-200">
            {/* Sidebar Area */}
            {sidebarOpen && (
                <AppSidebar
                    appMode={appMode}
                    onOpenSettings={() => setSettingsOpen(true)}
                />
            )}

            {/* Main Stage (Slide Display) */}
            <main className="flex-1 h-full relative flex flex-col min-w-0 @container">
                <AppToolbar
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                    historyOpen={historyOpen}
                    setHistoryOpen={setHistoryOpen}
                    designPanelOpen={designPanelOpen}
                    setDesignPanelOpen={setDesignPanelOpen}
                    appMode={appMode}
                    activeOverride={activeOverride}
                    toggleOverride={toggleOverride}
                    activeLogoUrl={activeLogoUrl}
                    activeLogoName={activeLogo?.name}
                    undo={() => usePresentationStore.getState().undo()}
                    redo={() => usePresentationStore.getState().redo()}
                    openProjector={openProjector}
                    openGlobalModal={openGlobalModal}
                    isBibleSlide={isBibleSlide}
                />

        <StatusOverlay activeOverride={activeOverride} />

        {/* Multiverse Controls (Top Right) */}
        {(isMultiVerseMode || selectedVerses.length >= 2) && (
          <div className="absolute top-4 right-4 z-50 flex gap-2 animate-in fade-in slide-in-from-right-4 duration-500">
            {isMultiVerseMode ? (
              <button
                onClick={() => exitMultiVerseMode()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-2xl transition-all active:scale-95 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 backdrop-blur-xl"
              >
                <Trash2 className="w-4 h-4" />
                <span className="uppercase tracking-widest">{t('exit_mode', 'Exit Mode')}</span>
              </button>
            ) : (
              <button
                onClick={() => commitToProjector()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-2xl transition-all active:scale-95 bg-accent hover:bg-accent-hover text-accent-foreground border border-accent/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span className="uppercase tracking-widest">
                  {t('send_to_projector', 'Send to projector')}
                </span>
                <span className="ml-1 opacity-50 font-medium">[Enter]</span>
              </button>
            )}
          </div>
        )}

        {/* Main Display Area */}
        <div className="flex-1 min-h-0 relative z-0">
          <SlideDisplay />
        </div>

        {/* Slide Timeline (Bottom) */}
        {appMode === 'presentation' && <SlideTimeline openProjector={openProjector} />}

        {/* Slide Design Panel — self-managed visibility via createPortal */}
        {appMode === 'presentation' && <SlideDesignPanel />}

        {/* Verse Previews (Contextual Bottom Left/Right) */}
        <VersePreviews
          appMode={appMode}
          lang={lang}
          prevVersePreview={prevVersePreview}
          nextVersePreview={nextVersePreview}
          setActiveVerse={setActiveVerse}
        />
      </main>


      {historyOpen && (
        <div style={{ width: 300 }} className="h-full shrink-0 animate-in slide-in-from-right duration-300">
          <HistoryPanel />
        </div>
      )}

      {/* Global Modals & Feature Registry */}
      <AppModals
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Toaster position="top-center" expand={false} visibleToasts={5} />
      <FontPrewarmer />
      <PromptModal />
      <ConfirmModal />
      <Routes>
        <Route path="/" element={<ControllerLayout />} />
        <Route path="/projector" element={<ProjectorView />} />
      </Routes>
    </HashRouter>
  );
};

export default App;