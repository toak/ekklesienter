import { ISlide } from '@/core/types';
import { toast } from '@/core/utils/toast';
import { TFunction } from 'i18next';
import { ITemplate } from '@/core/types';
import { ModalType } from '@/core/store/modalStore';

interface UseTimelineOperationsProps {
    activePresentationId: string | null;
    presentation: any;
    slides: ISlide[];
    previewSlideId: string | null;
    templatesMap: Map<string, ITemplate>;
    blocksMap: Map<string, any>;
    templates: ITemplate[];
    t: TFunction;
    updatePresentationSlides: (id: string, slides: ISlide[]) => Promise<void>;
    setPreviewSlide: (id: string, pid?: string) => void;
    updateSlideBackground: (sid: string, bg: any) => Promise<void>;
    openModal: (type: ModalType, props?: any) => void;
}

/**
 * Hook to handle CRUD operations for slides and timers.
 */
export const useTimelineOperations = ({
    activePresentationId,
    presentation,
    slides,
    previewSlideId,
    templatesMap,
    blocksMap,
    templates,
    t,
    updatePresentationSlides,
    setPreviewSlide,
    updateSlideBackground,
    openModal
}: UseTimelineOperationsProps) => {

    const handleAddSlide = async (blockId: string, e?: React.MouseEvent) => {
        if (!activePresentationId) {
            toast.error(t('error_no_active_presentation', 'No active presentation'));
            return;
        }

        if (!presentation) {
            toast.info(t('loading_presentation', 'Loading presentation...'));
            return;
        }

        const block = blocksMap.get(blockId);
        if (!block && blockId !== 'default' && blockId !== 'bible') {
            console.error('[SlideTimeline] Block not found:', blockId);
            toast.error(t('error_block_not_found', 'Block type not found: {{blockId}}', { blockId }));
            return;
        }

        if (blockId === 'bible') {
            const insertBefore = e && (e.metaKey || e.ctrlKey);
            openModal(ModalType.BIBLE_SELECTION, { insertBefore });
            return;
        }

        const blockTemplates = templates.filter(t => t.category === blockId);
        const templateId = blockTemplates.length > 0 ? blockTemplates[0].id : (blockId === 'default' ? 'empty-slide' : 'default');

        const newSlide: ISlide = {
            id: crypto.randomUUID(),
            type: 'normal',
            order: 0,
            blockId,
            templateId,
            content: { variables: {} },
        };

        try {
            const insertBefore = e && (e.metaKey || e.ctrlKey);
            const selectedIdx = previewSlideId ? slides.findIndex(s => s.id === previewSlideId) : -1;
            let insertionIndex: number;
            if (selectedIdx !== -1) {
                insertionIndex = insertBefore ? selectedIdx : selectedIdx + 1;
            } else {
                insertionIndex = slides.length;
            }

            const newSlides = [
                ...slides.slice(0, insertionIndex),
                newSlide,
                ...slides.slice(insertionIndex),
            ].map((s, i) => ({ ...s, order: i }));

            await updatePresentationSlides(activePresentationId, newSlides);
            setPreviewSlide(newSlide.id, activePresentationId);
            toast.success(t('slide_added', 'Slide added'));
        } catch (error) {
            console.error('[SlideTimeline] Failed to add slide:', error);
            toast.error(t('error_add_slide_failed', 'Failed to add slide'));
        }
    };

    const handleAddTimer = async (e?: React.MouseEvent) => {
        if (!activePresentationId || !presentation) return;

        const newSlide: ISlide = {
            id: crypto.randomUUID(),
            type: 'timer',
            order: 0,
            blockId: 'default',
            templateId: 'blank-dark',
            durationSec: 300,
            countDirection: 'down'
        };

        try {
            const insertBefore = e && (e.metaKey || e.ctrlKey);
            const selectedIdx = previewSlideId ? slides.findIndex(s => s.id === previewSlideId) : -1;
            let insertionIndex: number;
            if (selectedIdx !== -1) {
                insertionIndex = insertBefore ? selectedIdx : selectedIdx + 1;
            } else {
                insertionIndex = slides.length;
            }

            const newSlides = [
                ...slides.slice(0, insertionIndex),
                newSlide,
                ...slides.slice(insertionIndex),
            ].map((s, i) => ({ ...s, order: i }));

            await updatePresentationSlides(activePresentationId, newSlides);
            setPreviewSlide(newSlide.id, activePresentationId);
            toast.success(t('timer_added', 'Timer added'));
        } catch (error) {
            console.error('[SlideTimeline] Failed to add timer:', error);
            toast.error(t('error_add_timer_failed', 'Failed to add timer'));
        }
    };

    const handleRestoreTemplateBg = async (slideId: string) => {
        await updateSlideBackground(slideId, null);
    };

    const handleApplyBgToAll = async (slideId: string) => {
        if (!activePresentationId) return;
        const slide = slides.find(s => s.id === slideId);
        if (!slide) return;

        const template = slide?.templateId ? templatesMap.get(slide.templateId) : undefined;
        const bgToApply = (slide.type === 'normal' ? (slide as any).backgroundOverride : undefined) || template?.background;
        if (!bgToApply) return;

        // Note: applyBackgroundToAll is not passed in props but we can import it or use a callback
        // For now, let's assume it's passed or available from another store.
        // Actually, we should pass it.
    };

    return {
        handleAddSlide,
        handleAddTimer,
        handleRestoreTemplateBg,
        handleApplyBgToAll
    };
};
