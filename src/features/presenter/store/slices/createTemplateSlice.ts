import { db } from '@/core/db';
import { PresentationSliceCreator } from '../types';
import { ITemplate, ISlide, ICanvasSlide, IPresentationBin } from '@/core/types';
import { toast } from '@/core/utils/toast';
import i18n from '@/core/i18n';

export const createTemplateSlice: PresentationSliceCreator = (set, get) => ({
    setTemplateNavPath: (path) => set({ templateNavPath: path }),
    pushTemplateNav: (item) => set({ templateNavPath: [...get().templateNavPath, item] }),
    popTemplateNav: () => set({ templateNavPath: get().templateNavPath.slice(0, -1) }),

    updateTemplate: async (templateId, updates, force) => {
        const template = await db.templates.get(templateId);
        if (!template || (!template.isUserCreated && !force)) return;
        await db.templates.update(templateId, updates);
    },

    removeTemplate: async (templateId, force) => {
        const template = await db.templates.get(templateId);
        if (!template || (!template.isUserCreated && !force)) return;
        await db.templates.delete(templateId);
    },

    overrideTemplateSlide: async (templateId, layoutSlideId, sourceSlide, force) => {
        const template = await db.templates.get(templateId);
        if (!template || (!template.isUserCreated && !force)) return;

        const templateSlides = template.templateSlides || [];
        const updatedSlides = templateSlides.map(s => {
            if (s.id === layoutSlideId && s.type === 'normal') {
                if (sourceSlide.type !== 'normal') return s;
                const normalSource = sourceSlide as ICanvasSlide;
                return {
                    ...s,
                    canvasItems: normalSource.content.canvasItems || [],
                    backgroundOverride: normalSource.backgroundOverride
                };
            }
            return s;
        });

        await db.templates.update(templateId, { templateSlides: updatedSlides });
        toast.success(i18n.t('template_slide_overridden', 'Template slide updated'));
    },

    renameTemplateSlide: async (templateId, slideId, newName, force) => {
        const template = await db.templates.get(templateId);
        if (!template || (!template.isUserCreated && !force)) return;

        const templateSlides = template.templateSlides || [];
        const isRu = i18n.language.startsWith('ru');
        const updatedSlides = templateSlides.map(s => {
            if (s.id === slideId) {
                return isRu ? { ...s, nameRu: newName } : { ...s, name: newName };
            }
            return s;
        });

        await db.templates.update(templateId, { templateSlides: updatedSlides });
        toast.success(i18n.t('template_slide_renamed', 'Template slide renamed'));
    },

    removeTemplateSlide: async (templateId, slideId, force) => {
        const template = await db.templates.get(templateId);
        if (!template || (!template.isUserCreated && !force)) return;

        const templateSlides = template.templateSlides || [];
        const updatedSlides = templateSlides.filter(s => s.id !== slideId);

        await db.templates.update(templateId, { templateSlides: updatedSlides });
        toast.success(i18n.t('template_slide_removed', 'Template slide removed'));
    },

    setPresentationBinNavPath: (path) => set({ presentationBinNavPath: path }),

    createPresentationBin: async (name) => {
        const { presentationBinNavPath } = get();
        const parentId = presentationBinNavPath.length > 0 ? presentationBinNavPath[presentationBinNavPath.length - 1] : undefined;

        const bin: IPresentationBin = {
            id: crypto.randomUUID(),
            name,
            createdAt: Date.now(),
            parentId
        };
        await db.presentationBins.add(bin);
        toast.success(i18n.t('presentation_bin_created', 'Presentation bin created'));
        return bin.id;
    },

    renamePresentationBin: async (id, newName) => {
        await db.presentationBins.update(id, { name: newName });
        toast.success(i18n.t('presentation_bin_renamed', 'Presentation bin renamed'));
    },

    removePresentationBin: async (id) => {
        await db.transaction('rw', [db.presentationBins, db.presentationFiles], async () => {
            await db.presentationBins.delete(id);
            await db.presentationFiles.where('binId').equals(id).modify({ binId: undefined });
        });
        toast.success(i18n.t('presentation_bin_removed', 'Presentation bin removed'));
    },

    movePresentationToBin: async (presentationId, binId) => {
        await db.presentationFiles.update(presentationId, {
            binId: binId || undefined,
            updatedAt: new Date()
        });
        toast.success(i18n.t('presentation_moved_to_bin', 'Presentation moved'));
    },

    addMediaBin: async (name) => {
        const newBin = { id: crypto.randomUUID(), name, mediaIds: [] };
        set({ graceLibMediaBins: [...get().graceLibMediaBins, newBin] });
    },

    updateMediaBin: async (binId, updates) => {
        set({
            graceLibMediaBins: get().graceLibMediaBins.map(b => b.id === binId ? { ...b, ...updates } : b)
        });
    },

    removeMediaBin: async (binId) => {
        set({
            graceLibMediaBins: get().graceLibMediaBins.filter(b => b.id !== binId)
        });
    },

    addPresentationToGraceLib: async (presentationId) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (pres) {
            await db.presentationFiles.update(presentationId, { serviceId: undefined, isMaster: false });
            await get().loadRecents();
        }
    },
});
