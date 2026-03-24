import React, { useState, useCallback, useRef, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import NavigationPanel from '../features/bible-browser/components/NavigationPanel';
import VerseList from '../features/bible-browser/components/VerseList';
import SlideDisplay from '@/features/presenter/components/display/SlideDisplay';
import ProjectorView from '@/features/presenter/components/display/ProjectorView';
import { db } from '../core/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Verse, ILogo } from '../core/types';
import { getBookName } from '../core/data/bookData';
import { useAtom, useSetAtom } from 'jotai';
import { sidebarOpenAtom, themeAccentAtom, historyOpenAtom, searchOpenAtom, appModeAtom, activeOverrideAtom, liveLogoAtom, slideDesignPanelOpenAtom, isTimelineHoveredAtom, selectedCanvasItemIdsAtom, OverrideType } from '../core/store/uiAtoms';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import {
  SidebarClose, SidebarOpen, MonitorPlay, Clock,
  Search as SearchIcon, Palette, Square, Circle, Image as ImageIcon,
  CheckCircle2, Trash2, Undo2, Redo2
} from 'lucide-react';
import SettingsModal from '@/features/settings/components/SettingsModal';
import HistoryPanel from '../features/bible-browser/components/HistoryPanel';
import QuickSearchModal from '../features/search/components/QuickSearchModal';
import CustomizationPanel from '@/features/presenter/components/slide-properties/CustomizationPanel';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { processVerseText, truncateMiddle } from '@/core/utils/markdownUtils';
import { PRELOADED_LOGOS } from '@/core/data/logoData';
import { useLogoUrl } from '@/core/hooks/useLogoUrl';
import PresentationLibrary from '@/features/presenter/components/library/PresentationLibrary';
import SlideTimeline from '@/features/presenter/components/timeline/SlideTimeline';
import VariableEditor from '@/features/presenter/components/slide-editor/VariableEditor';
import BibleSelectionModal from '@/features/presenter/components/modals/BibleSelectionModal';
import TemplatePickerModal from '@/features/presenter/components/modals/TemplatePickerModal';
import SlideDesignPanel from '../features/presenter/components/SlideDesignPanel';
import AudioPickerModal from '@/features/presenter/components/modals/AudioPickerModal';
import AudioConflictModal from '@/features/presenter/components/modals/AudioConflictModal';
import SaveNestedConfirmModal from '@/features/presenter/components/modals/SaveNestedConfirmModal';
import PresentationImportModal from '@/features/presenter/components/modals/PresentationImportModal';
import PresentationPickerModal from '../features/presenter/components/modals/PresentationPickerModal';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { EktmpService } from '@/features/presenter/services/ektmpService';

import { audioService } from '@/features/presenter/services/AudioService';
import { Toaster } from 'sonner';
import { FontPrewarmer } from '@/features/presenter/components/fonts/FontPrewarmer';
import PromptModal from '@/shared/ui/modals/PromptModal';
import ConfirmModal from '@/shared/ui/modals/ConfirmModal';



// Custom resizable hook
function useResizable(
  storageKey: string,
  defaultSize: number,
  minSize: number,
  maxSize: number,
  orientation: 'horizontal' | 'vertical'
) {
  const [size, setSize] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? Number(saved) : defaultSize;
  });

  // Sync size when storageKey changes
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setSize(saved ? Number(saved) : defaultSize);
  }, [storageKey, defaultSize]);
  const isDragging = useRef(false);
  const startPos = useRef(0);
  const startSize = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startPos.current = orientation === 'horizontal' ? e.clientX : e.clientY;
    startSize.current = size;
    document.body.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [size, orientation]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const currentPos = orientation === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - startPos.current;
      const newSize = Math.min(maxSize, Math.max(minSize, startSize.current + delta));
      setSize(newSize);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem(storageKey, String(size));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [storageKey, size, minSize, maxSize, orientation]);

  return { size, handleMouseDown, containerRef };
}

const ControllerLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom);
  const [appMode] = useAtom(appModeAtom);
  const [themeAccent] = useAtom(themeAccentAtom);
  const [historyOpen, setHistoryOpen] = useAtom(historyOpenAtom);
  const [searchOpen, setSearchOpen] = useAtom(searchOpenAtom);
  const [selectedCanvasItemIds] = useAtom(selectedCanvasItemIdsAtom);
  const [isTimelineHovered] = useAtom(isTimelineHoveredAtom);
  const [designPanelOpen, setDesignPanelOpen] = useAtom(slideDesignPanelOpenAtom);
  const [projectorOpen, setProjectorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const activeVerse = useBibleStore((state) => state.activeVerse);
  const currentTranslationId = useBibleStore((state) => state.currentTranslationId);
  const setBook = useBibleStore((state) => state.setBook);
  const setChapter = useBibleStore((state) => state.setChapter);
  const setActiveVerse = useBibleStore((state) => state.setActiveVerse);
  const {
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

  // Audio Sync — use DB data directly for reliability (store's activePresentation can be stale)
  const audioPresentationSlides = useLiveQuery(
    () => activePresentationId ? db.presentationFiles.get(activePresentationId).then(p => p?.slides || []) : [],
    [activePresentationId]
  );
  useEffect(() => {
    if (!activePresentationId || !audioPresentationSlides?.length) {
      // Small delay to avoid stopping when switching presentations if the new one is still loading
      const timer = setTimeout(() => {
        if (!activePresentationId || !audioPresentationSlides?.length) {
          audioService.stopAll(1.0);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    audioService.sync(liveSlideId, audioPresentationSlides);
  }, [liveSlideId, audioPresentationSlides, activePresentationId]);
  const { t, i18n } = useTranslation();

  const lang = i18n.language?.substring(0, 2) || 'en';

  // Fetch next verse for preview
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

  // Fetch previous verse for preview
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

  useEffect(() => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('projector-opened', () => setProjectorOpen(true));
      window.electron.ipcRenderer.on('projector-closed', () => {
        setProjectorOpen(false);
        // Clear live states in both stores to ensure UI consistency
        useBibleStore.setState({ projectorIsLive: false });
        usePresentationStore.getState().setLiveSlide(null);
        audioService.stopAll(0.5); // Immediately stop all audio when projector closes
      });
    }

    // Initialize Template System
    const initTemplates = async () => {
      try {
        // 1. Seed bundled .ektmp files from app resources to user templates dir
        await window.electron?.templates?.seedBundled();
        // 2. Sync all filesystem templates into IndexedDB (also auto-creates blocks)
        await EktmpService.syncFileSystemTemplates();
      } catch (err) {
        console.error('Failed to initialize template system:', err);
      }
    };
    initTemplates();
  }, []);

  useEffect(() => {
  }, []);


  // Initialize store state from persisted IDs
  useEffect(() => {
    const initStore = async () => {
      const { activeServiceId, activePresentationId, selectedPresentationId, setActiveService, setActivePresentation, activeService, activePresentation, selectedPresentation } = usePresentationStore.getState();

      if (activeServiceId && !activeService) {
        await setActiveService(activeServiceId);
      }

      if (activePresentationId && !activePresentation) {
        await setActivePresentation(activePresentationId);
      }

      if (selectedPresentationId && !selectedPresentation && selectedPresentationId !== activePresentationId) {
        const { setPreviewSlide } = usePresentationStore.getState();
        // This will load the selected presentation into the store
        setPreviewSlide(usePresentationStore.getState().previewSlideId, selectedPresentationId);
      }
    };
    initStore();
  }, [activePresentationId, activeServiceId]);

  // Sync theme accent to the document to apply CSS variables
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeAccent);
  }, [themeAccent]);

  // Resizable navigation panel width - independent per mode
  const navPanel = useResizable(`nav-panel-width-${appMode}`, 200, 150, 350, 'horizontal');
  // Resizable side panel width - independent per mode
  const sidePanel = useResizable(`side-panel-width-${appMode}`, 280, 200, 500, 'horizontal');

  // Send current verse or multi-verses to projector — reads directly from store to avoid stale closures
  const sendVerseToProjector = useCallback(() => {
    const state = useBibleStore.getState();
    const { activeVerse, selectedVerses, isMultiVerseMode, secondTranslationId } = state;

    if (isMultiVerseMode && selectedVerses.length >= 2) {
      LiveSyncService.showMultiVerses(selectedVerses, secondTranslationId);
    } else if (activeVerse) {
      LiveSyncService.showVerse(activeVerse, secondTranslationId);
    }
  }, []);

  const openProjector = async () => {
    const displaySettings = usePresenterStore.getState().settings.display;
    if (window.electron && window.electron.ipcRenderer) {
      await window.electron.ipcRenderer.invoke('open-projector', displaySettings);
      setProjectorOpen(true);
      // Handshake listener in useEffect will trigger sendVerseToProjector() when window is ready
    } else {
      console.warn('Electron IPC not available');
      alert("Electron IPC not available. If you are in web mode, this feature requires Electron.");
    }
  };

  // Get navigation functions
  const navigateNext = useBibleStore((state) => state.navigateNext);
  const navigatePrev = useBibleStore((state) => state.navigatePrev);

  const handleNext = useCallback(async (detached?: boolean) => {
    if (appMode === 'scripture') {
      navigateNext(detached);
    } else {
      await usePresentationStore.getState().navigateNext(detached);
    }
  }, [appMode, navigateNext]);

  const handlePrev = useCallback(async (detached?: boolean) => {
    if (appMode === 'scripture') {
      navigatePrev(detached);
    } else {
      await usePresentationStore.getState().navigatePrev(detached);
    }
  }, [appMode, navigatePrev]);

  // Close projector window
  const closeProjector = useCallback(() => {
    LiveSyncService.clear();
    // Clear live states immediately for responsive UI
    useBibleStore.setState({ projectorIsLive: false });
    usePresentationStore.getState().setLiveSlide(null);

    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.invoke('close-projector');
    }
  }, []);

  // Keyboard shortcuts
  const executeHotkey = useCallback(async (e: {
    key: string;
    code?: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    preventDefault?: () => void;
  }) => {
    // Ignore if user is typing in an input
    const active = document.activeElement;
    if (active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.getAttribute('contenteditable') === 'true'
    )) {
      return;
    }

    const isMod = e.metaKey || e.ctrlKey;

    // Enter: Contextual Actions or Open Projector
    if (e.key === 'Enter') {
      if (appMode === 'presentation') {
        const uiState = await import('@/core/store/uiAtoms');
        const defaultStoreContext = await import('jotai/vanilla');
        const store = defaultStoreContext.getDefaultStore();

        const isPreviewHovered = store.get(uiState.slidePreviewHoveredAtom);
        const isDesignHovered = store.get(uiState.slideDesignHoveredAtom);
        const isTimelineHoveredGlobal = store.get(uiState.isTimelineHoveredAtom);
        const isNavHovered = store.get(uiState.sidebarOpenAtom); // Simplified proxy for nav hover if we wanted one, though user said "navigation panel". Here we assume if they are on timeline/nav it goes live.

        // 1. Hovering over Slide Preview AND items selected -> Edit selected text
        if (isPreviewHovered) {
          const selectedItemIds = store.get(uiState.selectedCanvasItemIdsAtom);
          if (selectedItemIds.length > 0) {
            const firstId = selectedItemIds[selectedItemIds.length - 1]; // or [0]
            store.set(uiState.editingCanvasItemIdAtom as import('jotai').WritableAtom<string | null, [string | null], void>, firstId);
            store.set(uiState.canvasToolAtom, 'text');
            e.preventDefault?.();
            return;
          }
        }

        // 2. Default Contextual Actions / Go Live
        if (isMod) {
          const slides = activePresentation?.slides || [];
          if (slides.length > 0) {
            e.preventDefault?.();
            const firstId = slides[0].id;
            setPreviewSlide(firstId);
            setLiveSlide(firstId);
            openProjector();
            return;
          }
        }

        if (previewSlideId) {
          e.preventDefault?.();
          setLiveSlide(previewSlideId);
          openProjector();
          return;
        }
      } else {
        // Scripture Mode Default Enter behavior
        const canProject = (appMode === 'scripture' && (useBibleStore.getState().activeVerse || useBibleStore.getState().selectedVerses.length >= 2));

        if (canProject) {
          e.preventDefault?.();
          useBibleStore.getState().commitToProjector();
          openProjector();
        }
      }
    }

    // Escape: Clear presentation & Close Projector
    if (e.key === 'Escape') {
      e.preventDefault?.();
      closeProjector();
    }

    // Arrow Right or Down: Next
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault?.();
      await handleNext(isMod);
    }

    // Arrow Left or Up: Previous
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault?.();
      await handlePrev(isMod);
    }

    // Ctrl+H: Toggle History
    if (isMod && (e.code === 'KeyH' || e.key.toLowerCase() === 'h')) {
      e.preventDefault?.();
      setHistoryOpen(prev => !prev);
    }

    // H: Sync Preview to Live (Layout independent)
    if (!isMod && (e.code === 'KeyH' || e.key.toLowerCase() === 'h')) {
      if (appMode === 'presentation' && previewSlideId) {
        e.preventDefault?.();
        usePresentationStore.getState().syncPreviewToLive();
      }
    }

    // Ctrl+Shift+C: Copy current verse
    if (isMod && e.shiftKey && (e.code === 'KeyC' || e.key.toLowerCase() === 'c')) {
      if (activeVerse) {
        e.preventDefault?.();
        const text = `${activeVerse.bookId} ${activeVerse.chapter}:${activeVerse.verseNumber} (${activeVerse.translationId})\n${activeVerse.text}`;
        navigator.clipboard.writeText(text);
      }
    }

    // Ctrl+F: Open search
    if (isMod && (e.code === 'KeyF' || e.key.toLowerCase() === 'f')) {
      e.preventDefault?.();
      setSearchOpen(true);
    }

    // Live Controls shortcuts
    if (e.code === 'KeyB' || e.key.toLowerCase() === 'b') {
      e.preventDefault?.();
      toggleOverride('blackout');
    }
    if (e.code === 'KeyW' || e.key.toLowerCase() === 'w') {
      e.preventDefault?.();
      toggleOverride('whiteout');
    }
    if (e.code === 'KeyL' || e.key.toLowerCase() === 'l') {
      e.preventDefault?.();
      toggleOverride('logo');
    }

    // Undo/Redo Shortcuts
    if (isMod && (e.code === 'KeyZ' || e.key.toLowerCase() === 'z')) {
      e.preventDefault?.();
      if (e.shiftKey) {
        await redo();
      } else {
        await undo();
      }
    }
    if (isMod && (e.code === 'KeyY' || e.key.toLowerCase() === 'y')) {
      e.preventDefault?.();
      await redo();
    }

    // Slide Management Shortcuts
    if (appMode === 'presentation') {
      const { activePresentationId, previewSlideId, selectedPresentationId, duplicateSlide, moveSlide, removeSlide, selectedAudioScopeId, removeAudioScope } = usePresentationStore.getState();

      // Cmd/Ctrl + D: Duplicate
      if (isMod && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
        if (previewSlideId && selectedPresentationId) {
          e.preventDefault?.();
          await duplicateSlide(selectedPresentationId, previewSlideId);
        }
      }

      // Movement: Cmd + [ or ]
      if (isMod && previewSlideId && selectedPresentationId) {
        if (e.key === '[' || e.code === 'BracketLeft') {
          e.preventDefault?.();
          await moveSlide(selectedPresentationId, previewSlideId, e.shiftKey ? 'start' : 'back');
        } else if (e.key === ']' || e.code === 'BracketRight') {
          e.preventDefault?.();
          await moveSlide(selectedPresentationId, previewSlideId, e.shiftKey ? 'end' : 'forth');
        }
      }

      // Delete/Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const canDeleteSlide = isTimelineHovered && selectedCanvasItemIds.length === 0 && !selectedAudioScopeId;

        if (selectedAudioScopeId) {
          e.preventDefault?.();
          await removeAudioScope(selectedAudioScopeId);
        } else if (selectedCanvasItemIds.length > 0) {
          // Canvas items deletion is handled by SlideCanvas.tsx key listener if it's focused,
          // but if we are here, we might want to handle it globally or just avoid deleting the slide.
          // For now, if elements are selected, we DO NOT delete the slide.
        } else if (canDeleteSlide && previewSlideId && selectedPresentationId) {
          // Delete slide ONLY if timeline is hovered and NO elements are selected
          e.preventDefault?.();
          await removeSlide(selectedPresentationId, previewSlideId);
        }
      }
    }    // Ctrl+S: Save
    if (isMod && (e.code === 'KeyS' || e.key.toLowerCase() === 's')) {
      e.preventDefault?.();

      const {
        activeServiceId,
        activeService,
        saveActiveService,
        saveActivePresentation,
        activePresentationId
      } = usePresentationStore.getState();

      // If we have an active service and it has a file handle, save it
      if (activeServiceId && activeService?.fileHandle) {
        try {
          await saveActiveService();
          import('sonner').then(({ toast }) => toast.success(t('service_saved', 'Service saved successfully')));
          return;
        } catch (err) {
          console.error('Auto-save failed:', err);
        }
      }

      // Fallback: If we graduated to a save choice for nested changes
      if (appMode === 'presentation') {
        useModalStore.getState().openModal(ModalType.SAVE_NESTED_CONFIRM);
      }
    }

  }, [appMode, previewSlideId, activePresentation, activeVerse, handleNext, handlePrev, closeProjector, openProjector, undo, redo, setSearchOpen, setHistoryOpen]);

  // Keyboard shortcuts and Relayed hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => executeHotkey(e);
    window.addEventListener('keydown', handleKeyDown, true); // capture phase: fires before stopPropagation in children

    let unsubscribeRelay: (() => void) | undefined;
    if (window.electron?.ipcRenderer) {
      unsubscribeRelay = window.electron.ipcRenderer.on('relay-keydown', (payload: any) => {
        executeHotkey(payload);
      });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      unsubscribeRelay?.();
    };
  }, [executeHotkey]);


  // Listen for projector-ready event (Handshake for release builds)
  useEffect(() => {
    if (!window.electron?.ipcRenderer) return;

    const unsubscribe = window.electron.ipcRenderer.on('projector-ready', (payload?: { ratio: number }) => {
      if (payload?.ratio) {
        usePresenterStore.getState().updateDisplay({ aspectRatio: payload.ratio });
      }
      // Send initial theme
      window.electron?.ipcRenderer.send('projector-command', 'update-theme', themeAccent);

      // Send current override state
      const uiState = {
        activeOverride: (activeOverrideAtom as any).init, // This might not be right
      };
      // Better: just call the setOverride with current state
      LiveSyncService.setOverride(activeOverride as OverrideType | null, activeOverride === 'logo' ? activeLogo : null);

      sendVerseToProjector();
    });

    return () => {
      unsubscribe?.();
    };
  }, [sendVerseToProjector]);

  // Detect external display aspect ratio at startup
  useEffect(() => {
    if (!window.electron?.ipcRenderer) return;

    const detectDisplayRatio = async () => {
      try {
        const data = await window.electron.ipcRenderer.invoke('get-displays');
        if (!data || data.length === 0) return;

        const { settings } = usePresenterStore.getState();
        if (!settings.display.autoDefine) return;

        // Prefer external display, fall back to primary
        const external = data.find((d: { bounds: { x: number; y: number } }) => d.bounds.x !== 0 || d.bounds.y !== 0);
        const display = external || data[0];
        const ratio = display.size.width / display.size.height;

        if (settings.display.aspectRatio !== ratio) {
          usePresenterStore.getState().updateDisplay({ aspectRatio: ratio });
        }
      } catch (err) {
        console.error('Failed to detect display ratio:', err);
      }
    };

    detectDisplayRatio();
  }, []);

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
    setActiveOverride((prev: OverrideType | null) => prev === type ? null : type);
  }, [setActiveOverride]);

  useEffect(() => {
    // Sync latest settings first so projector has correct override backgrounds
    usePresenterStore.getState().syncSettings();
    LiveSyncService.setOverride(activeOverride as OverrideType | null, activeOverride === 'logo' ? activeLogo : null);
  }, [activeOverride, activeLogo]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-stone-950 text-stone-200">
      {/* Sidebar Area */}
      {sidebarOpen && (
        <>
          {/* Column 1: Navigation / Library */}
          <div style={{ width: navPanel.size }} className="h-full shrink-0">
            <NavigationPanel onOpenSettings={() => setSettingsOpen(true)} />
          </div>

          {/* Resize Handle */}
          <div
            onMouseDown={navPanel.handleMouseDown}
            className="w-1 bg-stone-800 hover:bg-accent transition-colors cursor-col-resize shrink-0"
          />

          <div style={{ width: sidePanel.size }} className="h-full shrink-0">
            {appMode === 'scripture' ? (
              <VerseList />
            ) : (
              <PresentationLibrary />
            )}
          </div>

          {/* Resize Handle */}
          <div
            onMouseDown={sidePanel.handleMouseDown}
            className="w-1 bg-stone-800 hover:bg-accent transition-colors cursor-col-resize shrink-0"
          />
        </>
      )}

      {/* Main Stage (Slide Display) */}
      <main className="flex-1 h-full relative flex flex-col min-w-0 @container">
        {/* Toggle Buttons Area */}
        <div className="absolute top-4 left-4 z-50 flex gap-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 bg-stone-900/80 text-stone-400 rounded-md hover:text-amber-400 hover:bg-stone-800 border border-stone-800 backdrop-blur-md transition-colors"
            title={sidebarOpen ? t('hide_controls') : t('show_controls')}
          >
            {sidebarOpen ? <SidebarClose className="w-5 h-5" /> : <SidebarOpen className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className={cn(
              "p-2 rounded-md border backdrop-blur-md transition-colors",
              historyOpen
                ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                : "bg-stone-900/80 text-stone-400 hover:text-amber-400 hover:bg-stone-800 border-stone-800"
            )}
            title={t('history')}
          >
            <Clock className="w-5 h-5" />
          </button>

          <div className="h-9 w-px bg-white/5 mx-1" />

          <button
            onClick={() => usePresentationStore.getState().undo()}
            className="p-2 rounded-md bg-stone-900/80 text-stone-400 hover:text-accent hover:bg-stone-800 border border-stone-800 backdrop-blur-md transition-colors"
            title={`${t('undo', 'Undo')} (Cmd+Z)`}
          >
            <Undo2 className="w-5 h-5" />
          </button>

          <button
            onClick={() => usePresentationStore.getState().redo()}
            className="p-2 rounded-md bg-stone-900/80 text-stone-400 hover:text-accent hover:bg-stone-800 border border-stone-800 backdrop-blur-md transition-colors"
            title={`${t('redo', 'Redo')} (Cmd+Shift+Z)`}
          >
            <Redo2 className="w-5 h-5" />
          </button>

          <div className="h-9 w-px bg-white/5 mx-1" />

          <button
            onClick={openProjector}
            className="p-2 bg-stone-900/80 text-stone-400 rounded-md hover:text-accent hover:bg-stone-800 border border-stone-800 backdrop-blur-md transition-colors"
            title={t('open_projector')}
          >
            <MonitorPlay className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              if (appMode === 'presentation') {
                const { activePresentation, previewSlideId } = usePresentationStore.getState();
                const selectedSlide = activePresentation?.slides.find(s => s.id === previewSlideId);
                const isBibleSlide = selectedSlide?.blockId === 'bible';

                if (isBibleSlide) {
                  useModalStore.getState().openModal(ModalType.CUSTOMIZATION);
                } else {
                  setDesignPanelOpen(!designPanelOpen);
                }
              } else {
                useModalStore.getState().openModal(ModalType.CUSTOMIZATION);
              }
            }}
            className={cn(
              "p-2 rounded-md border backdrop-blur-md transition-colors",
              designPanelOpen && appMode === 'presentation'
                ? "bg-accent/20 text-accent border-accent/50"
                : "bg-stone-900/80 text-stone-400 hover:text-accent hover:bg-stone-800 border-stone-800"
            )}
            title={t('customization')}
          >
            <Palette className="w-5 h-5" />
          </button>

          {/* Emergency Modes Controls */}
          <div className="h-9 w-px bg-white/5 mx-1" />

          <button
            onClick={() => toggleOverride('blackout')}
            className={cn(
              "p-2 rounded-md border backdrop-blur-md transition-all flex items-center justify-center relative group overflow-hidden",
              activeOverride === 'blackout'
                ? "bg-red-500/20 text-red-500 border-red-500/50 shadow-lg shadow-red-500/10"
                : "bg-stone-900/80 text-stone-400 hover:text-white hover:bg-stone-800 border-stone-800"
            )}
            title={`${t('blackout', 'Black Out')} (B)`}
          >
            <Square className={cn("w-5 h-5 fill-current transition-transform", activeOverride === 'blackout' ? "scale-110" : "scale-90 opacity-10")} />
            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black uppercase tracking-tighter">{t('blackout_short')}</div>
          </button>

          <button
            onClick={() => toggleOverride('whiteout')}
            className={cn(
              "p-2 rounded-md border backdrop-blur-md transition-all flex items-center justify-center relative group overflow-hidden",
              activeOverride === 'whiteout'
                ? "bg-stone-100 text-black border-white shadow-lg shadow-white/10"
                : "bg-stone-900/80 text-stone-400 hover:text-white hover:bg-stone-800 border-stone-800"
            )}
            title={`${t('whiteout', 'White Out')} (W)`}
          >
            <Square className={cn("w-5 h-5 fill-current transition-transform", activeOverride === 'whiteout' ? "scale-110" : "scale-90 opacity-10")} />
            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black uppercase tracking-tighter">{t('whiteout_short')}</div>
          </button>

          <button
            onClick={() => toggleOverride('logo')}
            className={cn(
              "p-2 rounded-md border backdrop-blur-md transition-all flex items-center justify-center relative group overflow-hidden min-w-[38px] min-h-[38px]",
              activeOverride === 'logo'
                ? "bg-accent/20 text-accent border-accent/50 shadow-lg shadow-accent/10"
                : "bg-stone-900/80 text-stone-400 hover:text-white hover:bg-stone-800 border-stone-800"
            )}
            title={`${t('logo_mode', 'Show Logo')} (L)`}
          >
            {activeLogoUrl ? (
              <div className="w-5 h-5 rounded-sm overflow-hidden flex items-center justify-center">
                <img src={activeLogoUrl} alt={activeLogo?.name || 'Logo'} className="w-full h-full object-contain" />
              </div>
            ) : (
              <>
                <ImageIcon className={cn("w-5 h-5 transition-transform", activeOverride === 'logo' ? "scale-110" : "scale-90")} />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 bg-black/40">L</div>
              </>
            )}
          </button>

          {/* Live Indicator */}
          {activeOverride && (
            <div className="ml-2 px-3 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{t('live_override_active', 'Live Override Active')}</span>
            </div>
          )}

          {/* Saving Indicator */}
          {usePresentationStore.getState().isSaving && (
            <div className="ml-2 px-3 flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
              <span className="text-[10px] font-bold text-accent uppercase tracking-widest">{t('saving', 'Saving...')}</span>
            </div>
          )}
        </div>

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


        {/* Slider Navigation */}
        <SlideDisplay />

        {/* Slide Timeline (Bottom) */}
        {appMode === 'presentation' && <SlideTimeline />}

        {/* Customization Panel */}
        <CustomizationPanel />

        {/* Bible Selection Modal */}
        <BibleSelectionModal />
        <TemplatePickerModal />
        <AudioPickerModal />
        <AudioConflictModal />
        <SaveNestedConfirmModal />
        <PresentationImportModal />
        <PresentationPickerModal />
        {/* Previous Verse Preview (Bottom Left) */}
        {prevVersePreview && appMode === 'scripture' && !useModalStore.getState().isModalOpen(ModalType.CUSTOMIZATION) && (
          <div className="absolute bottom-6 left-6 z-40">
            <button
              onClick={() => {
                setActiveVerse(prevVersePreview);
              }}
              className="bg-stone-900/90 border border-white/10 px-4 py-3 rounded-xl backdrop-blur-xl shadow-2xl hover:border-accent/50 transition-all text-left group animate-in slide-in-from-bottom-4 duration-500 flex flex-col gap-1 @md:w-72 @md:h-32 @md:p-4 @md:rounded-2xl"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest leading-none whitespace-nowrap">
                  {t('prev_verse', 'Previous Verse')}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white leading-tight">
                {getBookName(prevVersePreview.bookId, lang)} {prevVersePreview.chapter}:{prevVersePreview.verseNumber}
              </h4>
              <p className="hidden @md:block text-[10px] text-stone-400 line-clamp-3 italic leading-relaxed mt-1">
                {processVerseText(truncateMiddle(prevVersePreview.text, 120))}
              </p>
            </button>
          </div>
        )}

        {/* Next Verse Preview (Bottom Right) */}
        {nextVersePreview && appMode === 'scripture' && !useModalStore.getState().isModalOpen(ModalType.CUSTOMIZATION) && (
          <div className="absolute bottom-6 right-6 z-40">
            <button
              onClick={() => {
                setActiveVerse(nextVersePreview);
              }}
              className="bg-stone-900/90 border border-white/10 px-4 py-3 rounded-xl backdrop-blur-xl shadow-2xl hover:border-amber-500/50 transition-all text-left group animate-in slide-in-from-bottom-4 duration-500 flex flex-col gap-1 @md:w-72 @md:h-32 @md:p-4 @md:rounded-2xl"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest leading-none whitespace-nowrap">
                  {t('next_verse', 'Next Verse')}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white leading-tight">
                {getBookName(nextVersePreview.bookId, lang)} {nextVersePreview.chapter}:{nextVersePreview.verseNumber}
              </h4>
              <p className="hidden @md:block text-[10px] text-stone-400 line-clamp-3 italic leading-relaxed mt-1">
                {processVerseText(truncateMiddle(nextVersePreview.text, 120))}
              </p>
            </button>
          </div>
        )}
      </main>

      {/* Slide Design Panel (Right Side) — presentation mode only */}
      {designPanelOpen && appMode === 'presentation' && (
        <div style={{ width: 460 }} className="h-full shrink-0 animate-in slide-in-from-right duration-300">
          <SlideDesignPanel />
        </div>
      )}

      {/* History Panel (Right Side) */}
      {historyOpen && (
        <div style={{ width: 300 }} className="h-full shrink-0 animate-in slide-in-from-right duration-300">
          <HistoryPanel />
        </div>
      )}

      {/* Global Modals */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <QuickSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
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