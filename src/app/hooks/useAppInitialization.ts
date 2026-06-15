import { useEffect } from 'react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { IpcService } from '@/core/services/ipcService';
import { EktmpService } from '@/features/presenter/services/ektmpService';
import { useLoadingStore } from '@/core/store/loadingStore';
import { db } from '@/core/db';

/**
 * Hook to handle application-level initialization logic.
 * Seeds templates, initializes store state from persisted IDs, and syncs theme.
 * Reports progress to the global LoadingScreen.
 */
export function useAppInitialization(themeAccent: string) {
    const { setPhase, setProgress, setLoaded } = useLoadingStore();

    useEffect(() => {
        const performInit = async () => {
            try {
                // Phase 1: Database Initialization
                setPhase('database');
                setProgress(10);
                await db.waitForFullReady();
                setProgress(30);

                // Phase 2: Template Seeding
                setPhase('templates');
                if (IpcService.isElectron()) {
                    await IpcService.templates.seedBundled();
                }
                setProgress(50);
                await EktmpService.syncFileSystemTemplates();
                setProgress(70);

                // Phase 3: Font Warming
                setPhase('fonts');
                // Ensure browser has registered the font faces
                await document.fonts.ready;
                setProgress(85);
                
                // Extra tick for smooth UI transition
                await new Promise(r => setTimeout(r, 300));

                // Phase 4: Store State Restoration
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
                setProgress(90);

                if (activePresentationId && !activePresentation) {
                    await setActivePresentation(activePresentationId);
                }
                setProgress(95);

                if (selectedPresentationId && !selectedPresentation && selectedPresentationId !== activePresentationId) {
                    const { setPreviewSlide } = usePresentationStore.getState();
                    const previewSlideId = usePresentationStore.getState().previewSlideId;
                    setPreviewSlide(previewSlideId, selectedPresentationId);
                }

                // Final Step: Complete
                setPhase('ready');
                setProgress(100);
                
                // Allow the "Ready" state to be seen slightly
                setTimeout(() => setLoaded(true), 600);
                
            } catch (err) {
                console.error('Application initialization failed:', err);
                // Even on error, we must eventually hide the screen or show a crash screen.
                // For now, we allow it to complete so the user isn't stuck.
                setLoaded(true);
            }
        };

        performInit();
    }, [setPhase, setProgress, setLoaded]);

    // Sync theme accent to the document (immediate)
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', themeAccent);
    }, [themeAccent]);
}
