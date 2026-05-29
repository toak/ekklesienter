import { IpcService } from '@/core/services/IpcService';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';

/**
 * Service for high-level presentation orchestration, including navigation logic
 * across different app modes and projector window management.
 */
export class PresentationService {
  /**
   * Opens the projector window with current display settings.
   */
  static async openProjector(): Promise<boolean> {
    if (!IpcService.isElectron()) return false;
    
    const displaySettings = usePresenterStore.getState().settings.display;
    await IpcService.invoke('open-projector', displaySettings);
    return true;
  }

  /**
   * Closes the projector window and clears live states.
   */
  static closeProjector() {
    LiveSyncService.clear();
    useBibleStore.setState({ projectorIsLive: false });
    usePresentationStore.getState().setLiveSlide(null);
    if (IpcService.isElectron()) {
      IpcService.invoke('close-projector');
    }
  }

  /**
   * Unified navigation to the next item based on current app mode.
   */
  static async navigateNext(appMode: 'scripture' | 'presentation', detached?: boolean, preferLiveAnchor?: boolean) {
    if (appMode === 'scripture') {
      useBibleStore.getState().navigateNext(detached, preferLiveAnchor);
    } else {
      await usePresentationStore.getState().navigateNext(detached, preferLiveAnchor);
    }
  }

  /**
   * Unified navigation to the previous item based on current app mode.
   */
  static async navigatePrev(appMode: 'scripture' | 'presentation', detached?: boolean, preferLiveAnchor?: boolean) {
    if (appMode === 'scripture') {
      useBibleStore.getState().navigatePrev(detached, preferLiveAnchor);
    } else {
      await usePresentationStore.getState().navigatePrev(detached, preferLiveAnchor);
    }
  }

  /**
   * Opens a global modal.
   */
  static openGlobalModal(type: ModalType) {
    useModalStore.getState().openModal(type);
  }
}
