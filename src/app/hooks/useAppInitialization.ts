import { useEffect } from 'react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { IpcService } from '@/core/services/IpcService';
import { EktmpService } from '@/features/presenter/services/ektmpService';

/**
 * Hook to handle application-level initialization logic.
 * Seeds templates, initializes store state from persisted IDs, and syncs theme.
 */
export function useAppInitialization(themeAccent: string) {
    // 1. Initialize Templates
    useEffect(() => {
        const initTemplates = async () => {
            try {
                if (IpcService.isElectron()) {
                    await IpcService.templates.seedBundled();
                }
                await EktmpService.syncFileSystemTemplates();
            } catch (err) {
                console.error('Failed to initialize template system:', err);
            }
        };
        initTemplates();
    }, []);

    // 2. Initialize Store state from persisted IDs
    useEffect(() => {
        const initStore = async () => {
            const { 
                activeServiceId, 
                activePresentationId, 
                selectedPresentationId, 
                setActiveService, 
                setActivePresentation, 
                activeService, 
                activePresentation, 
                selectedPresentation 
            } = usePresentationStore.getState();

            if (activeServiceId && !activeService) {
                await setActiveService(activeServiceId);
            }

            if (activePresentationId && !activePresentation) {
                await setActivePresentation(activePresentationId);
            }

            if (selectedPresentationId && !selectedPresentation && selectedPresentationId !== activePresentationId) {
                const { setPreviewSlide, previewSlideId } = usePresentationStore.getState();
                setPreviewSlide(previewSlideId, selectedPresentationId);
            }
        };
        initStore();
    }, []);

    // 3. Sync theme accent to the document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', themeAccent);
    }, [themeAccent]);
}
