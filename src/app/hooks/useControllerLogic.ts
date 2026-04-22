import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { getBookName } from '@/core/data/bookData';
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
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { PRELOADED_LOGOS } from '@/core/data/logoData';
import { useLogoUrl } from '@/core/hooks/useLogoUrl';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { IpcService } from '@/core/services/IpcService';
import { BibleNavigationService } from '@/features/bible-browser/services/BibleNavigationService';
import { RemoteSyncService } from '@/core/services/RemoteSyncService';
import { PresentationService } from '@/core/services/PresentationService';
import { useAppInitialization } from './useAppInitialization';
import { useAudioSync } from './useAudioSync';
import { useGlobalShortcuts } from './useGlobalShortcuts';

/**
 * Custom hook to encapsulate the main controller logic, state management, 
 * and orchestration that previously lived in App.tsx.
 */
export function useControllerLogic() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.substring(0, 2) || 'en';

  // --- UI Atoms ---
  const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom);
  const [historyOpen, setHistoryOpen] = useAtom(historyOpenAtom);
  const [searchOpen, setSearchOpen] = useAtom(searchOpenAtom);
  const [appMode] = useAtom(appModeAtom);
  const [themeAccent] = useAtom(themeAccentAtom);
  const [designPanelOpen, setDesignPanelOpen] = useAtom(slideDesignPanelOpenAtom);
  const isTimelineHovered = useAtom(isTimelineHoveredAtom)[0];
  const selectedCanvasItemIds = useAtom(selectedCanvasItemIdsAtom)[0];
  const [activeOverride, setActiveOverride] = useAtom(activeOverrideAtom) as any;
  const [activeLogo, setActiveLogo] = useAtom(liveLogoAtom) as any;

  // --- Component Local State ---
  const [projectorOpen, setProjectorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const lastRemoteUpdateId = useRef(0);

  // --- Store Selectors ---
  const activeVerse = useBibleStore(s => s.activeVerse);
  const currentTranslationId = useBibleStore(s => s.currentTranslationId);
  const setActiveVerse = useBibleStore(s => s.setActiveVerse);
  const isMultiVerseMode = useBibleStore(s => s.isMultiVerseMode);
  const selectedVerses = useBibleStore(s => s.selectedVerses);
  const commitToProjector = useBibleStore(s => s.commitToProjector);
  const exitMultiVerseMode = useBibleStore(s => s.exitMultiVerseMode);
  const projectorIsLive = useBibleStore(s => s.projectorIsLive);

  const liveSlideId = usePresentationStore(s => s.liveSlideId);
  const activePresentationId = usePresentationStore(s => s.activePresentationId);
  const activePresentation = usePresentationStore(s => s.activePresentation);
  const previewSlideId = usePresentationStore(s => s.previewSlideId);
  const setPreviewSlide = usePresentationStore(s => s.setPreviewSlide);
  const setLiveSlide = usePresentationStore(s => s.setLiveSlide);
  const undo = usePresentationStore(s => s.undo);
  const redo = usePresentationStore(s => s.redo);
  const presentationStack = usePresentationStore(s => s.presentationStack);
  const selectedPresentation = usePresentationStore(s => s.selectedPresentation);

  const settings = usePresenterStore(s => s.settings);
  const activeLogoUrl = useLogoUrl(activeLogo);

  // --- Global Initialization & Sync Hooks ---
  useAppInitialization(themeAccent);
  useAudioSync();

  // --- Bible Verse Previews ---
  const nextVersePreview = useLiveQuery(
    () => activeVerse ? BibleNavigationService.getNextVerse(activeVerse, currentTranslationId) : null,
    [activeVerse?.id, currentTranslationId]
  );

  const prevVersePreview = useLiveQuery(
    () => activeVerse ? BibleNavigationService.getPrevVerse(activeVerse, currentTranslationId) : null,
    [activeVerse?.id, currentTranslationId]
  );

  // --- Sync Effects ---

  // 1. Logo Sync
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

  // 2. Override Sync
  useEffect(() => {
    LiveSyncService.setOverride(activeOverride as OverrideType | null, activeOverride === 'logo' ? activeLogo : null);
  }, [activeOverride, activeLogo]);

  // 3. Settings Sync
  useEffect(() => {
    LiveSyncService.syncSettings(settings);
  }, [settings]);

  // --- Actions ---

  const toggleOverride = useCallback((type: OverrideType) => {
    setActiveOverride((prev: OverrideType | null) => {
        const next = prev === type ? null : type;
        if (next) {
            LiveSyncService.syncSettings(usePresenterStore.getState().settings);
        }
        return next;
    });
  }, [setActiveOverride]);

  const openGlobalModal = useCallback((type: ModalType) => {
    PresentationService.openGlobalModal(type);
  }, []);

  const openProjector = async () => {
    const success = await PresentationService.openProjector();
    if (success) setProjectorOpen(true);
  };

  const closeProjector = useCallback(() => {
    PresentationService.closeProjector();
    setProjectorOpen(false);
  }, []);

  const handleNext = useCallback(async (detached?: boolean, preferLiveAnchor?: boolean) => {
    await PresentationService.navigateNext(appMode as any, detached, preferLiveAnchor);
  }, [appMode]);

  const handlePrev = useCallback(async (detached?: boolean, preferLiveAnchor?: boolean) => {
    await PresentationService.navigatePrev(appMode as any, detached, preferLiveAnchor);
  }, [appMode]);

  // --- Shortcuts ---
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

  // --- Handshakes & Status Listeners ---

  useEffect(() => {
    if (!IpcService.isElectron()) return;
    const unsub = IpcService.on('projector-ready', (p?: { ratio: number }) => {
      if (p?.ratio) usePresenterStore.getState().updateDisplay({ aspectRatio: p.ratio });
      IpcService.send('projector-command', 'update-theme', themeAccent);
      LiveSyncService.syncSettings(usePresenterStore.getState().settings);
      
      setTimeout(() => {
        LiveSyncService.setOverride(activeOverride as OverrideType | null, activeOverride === 'logo' ? activeLogo : null);
        if (appMode === 'scripture' && useBibleStore.getState().activeVerse) {
          LiveSyncService.showVerse(useBibleStore.getState().activeVerse!, useBibleStore.getState().secondTranslationId);
        }
      }, 100);
    });
    return () => unsub();
  }, [themeAccent, activeOverride, activeLogo, appMode]);

  useEffect(() => {
    if (!IpcService.isElectron()) return;
    const unsub = LiveSyncService.onTimerAction(({ action, payload }) => {
        if (action === 'next_slide') {
            handleNext(false, true); // true = preferLiveAnchor
        } else if (action === 'prev_slide') {
            handlePrev(false, true);
        } else if (action === 'navigate_to' && payload?.slideId) {
            setLiveSlide(payload.slideId);
        } else if (action === 'override') {
            toggleOverride(payload);
        }
    });
    return () => unsub();
  }, [handleNext, handlePrev]);

  useEffect(() => {
    if (!IpcService.isElectron()) return;
    const unsub = LiveSyncService.onVideoStatus(({ isPlaying: vPlaying }) => {
      setIsPlaying(vPlaying);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setIsPlaying(false);
  }, [liveSlideId, appMode, activeVerse?.id]);

  useEffect(() => {
    if (!IpcService.isElectron()) return;
    const unsub = IpcService.on('remote:request-media', async ({ id, requestId }) => {
        try {
            let entry: any = await db.backgrounds.get(id);
            if (!entry) entry = await db.mediaPool.get(id);

            if (entry?.data) {
                const buffer = await entry.data.arrayBuffer();
                IpcService.send('remote:media-response', { 
                    requestId, 
                    data: buffer, 
                    mimeType: entry.mimeType || 'image/jpeg' 
                });
            } else {
                IpcService.send('remote:media-response', { requestId, error: 'Media not found' });
            }
        } catch (err) {
            IpcService.send('remote:media-response', { requestId, error: 'Database access error' });
        }
    });
    return () => unsub();
  }, []);


  // --- Remote State Management ---

  const updateRemoteState = useCallback(async () => {
    const { 
      activePresentation: aPres, 
      selectedPresentation: sPres, 
      presentationStack: pStack 
    } = usePresentationStore.getState();

    await RemoteSyncService.updateRemoteState({
        appMode,
        activeVerse,
        activePresentation: aPres,
        selectedPresentation: sPres,
        presentationStack: pStack,
        projectorIsLive,
        liveSlideId,
        previewSlideId,
        lang,
        themeAccent,
        isPlaying,
        activeOverride,
        activeLogo,
        activeLogoUrl,
        settings
    });
  }, [appMode, activeVerse, activePresentation, projectorIsLive, liveSlideId, previewSlideId, lang, themeAccent, isPlaying, activeOverride, activeLogoUrl, activeLogo, settings, selectedPresentation]);

  useEffect(() => { updateRemoteState(); }, [updateRemoteState]);

  useEffect(() => {
    if (!IpcService.isElectron()) return;
    const unsub = IpcService.on('remote:request-state', () => updateRemoteState());
    return () => unsub();
  }, [updateRemoteState]);

  const isBibleSlide = useMemo(() => {
    if (!activePresentation || !previewSlideId) return false;
    const slide = activePresentation.slides.find(s => s.id === previewSlideId);
    return slide?.blockId === 'bible';
  }, [activePresentation, previewSlideId]);

  return {
    state: {
      sidebarOpen,
      historyOpen,
      searchOpen,
      appMode,
      themeAccent,
      designPanelOpen,
      isTimelineHovered,
      selectedCanvasItemIds,
      projectorOpen,
      settingsOpen,
      activeVerse,
      activePresentation,
      previewSlideId,
      activeLogo,
      activeLogoUrl,
      activeOverride,
      isMultiVerseMode,
      selectedVerses,
      lang,
      prevVersePreview,
      nextVersePreview,
      isBibleSlide
    },
    actions: {
      setSidebarOpen,
      setHistoryOpen,
      setSearchOpen,
      setDesignPanelOpen,
      setSettingsOpen,
      setActiveVerse,
      toggleOverride,
      undo,
      redo,
      openProjector,
      closeProjector,
      handleNext,
      handlePrev,
      exitMultiVerseMode,
      commitToProjector,
      openGlobalModal
    }
  };
}
