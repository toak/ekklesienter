import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, CheckCircle2 } from 'lucide-react';
import {
  AppSidebar,
  AppToolbar,
  StatusOverlay,
  VersePreviews,
  AppModals
} from '../components/';
import SlideDisplay from '@/features/presenter/components/display/SlideDisplay';
import SlideTimeline from '@/features/presenter/components/timeline/SlideTimeline';
import SlideDesignPanel from '@/features/presenter/components/SlideDesignPanel';
import HistoryPanel from '@/features/bible-browser/components/HistoryPanel';
import { useControllerLogic } from '../hooks/useControllerLogic';

/**
 * Presentational layout for the main controller view.
 * Uses useControllerLogic to handle state and orchestrations.
 */
export const ControllerLayout: React.FC = () => {
  const { t } = useTranslation();
  const { state, actions } = useControllerLogic();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-stone-950 text-stone-200">
      {/* Sidebar Area */}
      {state.sidebarOpen && (
        <AppSidebar
          appMode={state.appMode}
          onOpenSettings={() => actions.setSettingsOpen(true)}
        />
      )}

      {/* Main Stage (Slide Display) */}
      <main className="flex-1 h-full relative flex flex-col min-w-0 @container">
        <AppToolbar
          sidebarOpen={state.sidebarOpen}
          setSidebarOpen={actions.setSidebarOpen}
          historyOpen={state.historyOpen}
          setHistoryOpen={actions.setHistoryOpen}
          designPanelOpen={state.designPanelOpen}
          setDesignPanelOpen={actions.setDesignPanelOpen}
          appMode={state.appMode}
          activeOverride={state.activeOverride}
          toggleOverride={actions.toggleOverride}
          activeLogoUrl={state.activeLogoUrl}
          activeLogoName={state.activeLogo?.name}
          undo={actions.undo}
          redo={actions.redo}
          openProjector={actions.openProjector}
          openGlobalModal={actions.openGlobalModal}
          isBibleSlide={state.isBibleSlide}
        />

        <StatusOverlay activeOverride={state.activeOverride} />

        {/* Multiverse Controls (Top Right) */}
        {(state.isMultiVerseMode || state.selectedVerses.length >= 2) && (
          <div className="absolute top-4 right-4 z-50 flex gap-2 animate-in fade-in slide-in-from-right-4 duration-500">
            {state.isMultiVerseMode ? (
              <button
                onClick={() => actions.exitMultiVerseMode()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-2xl transition-all active:scale-95 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 backdrop-blur-xl"
              >
                <Trash2 className="w-4 h-4" />
                <span className="uppercase tracking-widest">{t('exit_mode', 'Exit Mode')}</span>
              </button>
            ) : (
              <button
                onClick={() => actions.commitToProjector()}
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
        {state.appMode === 'presentation' && <SlideTimeline openProjector={actions.openProjector} />}

        {/* Slide Design Panel — self-managed visibility via createPortal */}
        {state.appMode === 'presentation' && <SlideDesignPanel />}

        {/* Verse Previews (Contextual Bottom Left/Right) */}
        <VersePreviews
          appMode={state.appMode}
          lang={state.lang}
          prevVersePreview={state.prevVersePreview}
          nextVersePreview={state.nextVersePreview}
          setActiveVerse={actions.setActiveVerse}
        />
      </main>

      {state.historyOpen && (
        <div style={{ width: 300 }} className="h-full shrink-0 animate-in slide-in-from-right duration-300">
          <HistoryPanel />
        </div>
      )}

      {/* Global Modals & Feature Registry */}
      <AppModals
        settingsOpen={state.settingsOpen}
        setSettingsOpen={actions.setSettingsOpen}
        searchOpen={state.searchOpen}
        setSearchOpen={actions.setSearchOpen}
      />
    </div>
  );
};
