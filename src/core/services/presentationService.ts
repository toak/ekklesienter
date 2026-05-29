import { ipcService } from '@/core/services/ipcService';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';

/**
 * Service for high-level presentation orchestration, including navigation logic
 * across different app modes and projector window management.
 */
export const presentationService = {
  /**
   * Opens the projector window with current display settings.
   */
  async openProjector(): Promise<boolean> {
    if (!ipcService.isElectron()) return false;
    
    const displaySettings = usePresenterStore.getState().settings.display;
    await ipcService.invoke('open-projector', displaySettings);
    
    if (displaySettings.stageDisplayId !== undefined) {
      await ipcService.invoke('open-stage', displaySettings);
    }
    
    return true;
  },

  /**
   * Closes the projector window and clears live states.
   */
  closeProjector() {
    LiveSyncService.clear();
    useBibleStore.setState({ projectorIsLive: false });
    usePresentationStore.getState().setLiveSlide(null);
    if (ipcService.isElectron()) {
      ipcService.invoke('close-projector').catch((err) => {
        console.error('[PresentationService] Failed to close projector:', err);
      });
      ipcService.invoke('close-stage').catch((err) => {
        console.error('[PresentationService] Failed to close stage:', err);
      });
    }
  },

  /**
 Unified navigation to the next item based on current app mode.
   */
  async navigateNext(appMode: 'scripture' | 'presentation', detached?: boolean, preferLiveAnchor?: boolean) {
    if (appMode === 'scripture') {
      useBibleStore.getState().navigateNext(detached, preferLiveAnchor);
    } else {
      await usePresentationStore.getState().navigateNext(detached, preferLiveAnchor);
    }
  },

  /**
 Unified navigation to the previous item based on current app mode.
   */
  async navigatePrev(appMode: 'scripture' | 'presentation', detached?: boolean, preferLiveAnchor?: boolean) {
    if (appMode === 'scripture') {
      useBibleStore.getState().navigatePrev(detached, preferLiveAnchor);
    } else {
      await usePresentationStore.getState().navigatePrev(detached, preferLiveAnchor);
    }
  },

  /**
   * Opens a global modal.
   */
  openGlobalModal(type: ModalType) {
    useModalStore.getState().openModal(type);
  }
};

/** @deprecated Use presentationService instead. */
export const PresentationService = presentationService;
