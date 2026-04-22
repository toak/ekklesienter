import { db } from '@/core/db';
import { PresentationSliceCreator } from '../types';
import { ISlide } from '@/core/types';
import { toast } from '@/core/utils/toast';
import i18n from '@/core/i18n';

export const createNestedPresentationSlice: PresentationSliceCreator = (set, get) => ({
    nestedPresentationsCache: {},
    toggleSlideExpansion: async (slideId) => {
        const { activePresentationId, activePresentation } = get();
        if (!activePresentationId || !activePresentation) return;

        const newSlides = activePresentation.slides.map(s => {
            if (s.id === slideId) {
                return { ...s, isExpanded: !s.isExpanded };
            }
            return s;
        });

        await get().updatePresentationSlides(activePresentationId, newSlides);
    },

    detachNestedInstance: async (slideId) => {
        const { activePresentationId, activePresentation } = get();
        if (!activePresentationId || !activePresentation) return;

        const slideIndex = activePresentation.slides.findIndex(s => s.id === slideId);
        if (slideIndex === -1) return;

        const slide = activePresentation.slides[slideIndex];
        if (slide.type !== 'normal') return;
        if (!slide.linkedPresentationId && !slide.masterPresentationId) return;

        const newSlides = [...activePresentation.slides];
        newSlides[slideIndex] = {
            ...slide,
            localNestedPresentationId: slide.linkedPresentationId || slide.masterPresentationId,
            linkedPresentationId: undefined,
            masterPresentationId: undefined
        } as any;

        await get().updatePresentationSlides(activePresentationId, newSlides);
    },

    addPresentationToTimeline: async (presentationId, index) => {
        const { activePresentationId, activePresentation, activeServiceId } = get();
        if (!activePresentationId || !activePresentation || !activeServiceId) return;

        // Prevent recursive nesting (adding current presentation to its own timeline)
        if (presentationId === activePresentationId) {
            toast.error(i18n.t('error_recursive_nesting', 'Cannot add a presentation to itself'));
            return;
        }

        const libraryPres = await db.presentationFiles.get(presentationId);
        if (!libraryPres) return;

        try {
            let masterPresentationId: string;
            let linkedPresentationId: string | undefined;

            // If this presentation already belongs to the current service, use it directly
            if (libraryPres.serviceId === activeServiceId) {
                masterPresentationId = presentationId;
                linkedPresentationId = undefined; // Already in service, no need to link for sync
            } else {
                // Otherwise create a snapshot to "import" it into this service
                const snapshotPresId = await get().createPresentation(`${libraryPres.name} (Snapshot)`, { serviceId: activeServiceId });
                
                const processedSlides = libraryPres.slides.map((s, i) => ({
                    ...s,
                    id: crypto.randomUUID(),
                    order: i
                }));
                await get().updatePresentationSlides(snapshotPresId, processedSlides);
                
                masterPresentationId = snapshotPresId;
                linkedPresentationId = presentationId;
            }

            const newSlide: ISlide = {
                id: crypto.randomUUID(),
                type: 'normal',
                order: 0, 
                blockId: 'master-presentation',
                templateId: 'default',
                content: { variables: {} },
                masterPresentationId,
                linkedPresentationId,
                lastSyncedAt: libraryPres.updatedAt ? new Date(libraryPres.updatedAt).toISOString() : new Date().toISOString(),
                isExpanded: true
            } as any;

            const updatedSlides = [...activePresentation.slides];
            const insertIdx = index !== undefined ? index : updatedSlides.length;
            updatedSlides.splice(insertIdx, 0, newSlide);

            const ordered = updatedSlides.map((s, i) => ({ ...s, order: i }));
            await get().updatePresentationSlides(activePresentationId, ordered);

            get().setSelectedSlideIds([newSlide.id]);
            get().setPreviewSlide(newSlide.id, activePresentationId);

            toast.success(i18n.t('presentation_added_to_timeline', 'Presentation added to timeline'));
        } catch (err) {
            console.error('[addPresentationToTimeline] ERROR', err);
        }
    },

    syncNestedPresentation: async (parentSlideId) => {
        const { activePresentationId, activePresentation } = get();
        if (!activePresentationId || !activePresentation) return;

        const parentSlide = activePresentation.slides.find(s => s.id === parentSlideId);
        if (!parentSlide || parentSlide.type !== 'normal' || !parentSlide.linkedPresentationId || !parentSlide.masterPresentationId) return;

        const libraryPres = await db.presentationFiles.get(parentSlide.linkedPresentationId);
        if (!libraryPres) {
            toast.error(i18n.t('library_presentation_not_found', 'Library presentation not found'));
            return;
        }

        const processedSlides = libraryPres.slides.map((s, i) => ({
            ...s,
            id: crypto.randomUUID(),
            order: i
        }));
        await get().updatePresentationSlides(parentSlide.masterPresentationId, processedSlides);

        const updatedSlides = activePresentation.slides.map(s => {
            if (s.id === parentSlideId) {
                return {
                    ...s,
                    lastSyncedAt: libraryPres.updatedAt.toISOString()
                };
            }
            return s;
        });

        await get().updatePresentationSlides(activePresentationId, updatedSlides);
        toast.success(i18n.t('nested_presentation_synced', 'Nested presentation synced'));
    },

    saveNestedChanges: async (options) => {
        const { syncBack } = options;
    },
    
    setCachedNestedPresentation: (id, presentation) => {
        set((state) => ({
            nestedPresentationsCache: {
                ...state.nestedPresentationsCache,
                [id]: presentation
            }
        }));
    },
});
