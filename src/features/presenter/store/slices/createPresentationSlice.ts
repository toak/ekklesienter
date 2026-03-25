import { db } from '@/core/db';
import { PresentationSliceCreator } from '../types';
import { IPresentationFile, IServiceFile } from '@/core/types';
import { toast } from '@/core/utils/toast';
import i18n from '@/core/i18n';

export const createPresentationSlice: PresentationSliceCreator = (set, get) => ({
    isSaving: false,

    createService: async (name) => {
        const serviceId = crypto.randomUUID();
        const now = new Date();
        const masterId = crypto.randomUUID();

        const newMaster: IPresentationFile = {
            id: masterId,
            name: `${name} (Master)`,
            serviceId: serviceId,
            isMaster: true,
            createdAt: now,
            updatedAt: now,
            lastOpened: now,
            slides: []
        };

        await db.presentationFiles.add(newMaster);

        const newService: IServiceFile = {
            id: serviceId,
            name,
            presentationIds: [masterId],
            masterPresentationId: masterId,
            createdAt: now,
            updatedAt: now,
            lastOpened: now
        };

        await db.serviceFiles.add(newService);
        await get().setActiveService(serviceId);
        await get().setActivePresentation(masterId);

        return serviceId;
    },

    createPresentation: async (name, options) => {
        const now = new Date();

        if (options?.isMaster && options.serviceId) {
            const existingMaster = await db.presentationFiles
                .where({ serviceId: options.serviceId, isMaster: true })
                .first();
            if (existingMaster) {
                toast.error(i18n.t('master_already_exists', 'A master presentation already exists for this service'));
                return existingMaster.id;
            }
        }

        const id = crypto.randomUUID();
        const newPresentation: IPresentationFile = {
            id,
            name,
            serviceId: options?.serviceId,
            isMaster: options?.isMaster,
            createdAt: now,
            updatedAt: now,
            lastOpened: now,
            slides: []
        };
        await db.presentationFiles.add(newPresentation);

        if (options?.serviceId) {
            const service = await db.serviceFiles.get(options.serviceId);
            if (service) {
                await db.serviceFiles.update(options.serviceId, {
                    presentationIds: [...service.presentationIds, id],
                    updatedAt: now
                });
                if (get().activeServiceId === options.serviceId) {
                    set({ activeService: { ...service, presentationIds: [...service.presentationIds, id], updatedAt: now } });
                }
            }
        }

        if (!options?.serviceId || options.isMaster) {
            await get().setActivePresentation(id);
        }
        return id;
    },

    renamePresentation: async (presentationId, newName) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (!pres || pres.isMaster) return;

        const now = new Date();
        await db.presentationFiles.update(presentationId, { name: newName, updatedAt: now });

        const { activePresentationId, activePresentation } = get();
        if (activePresentationId === presentationId && activePresentation) {
            set({ activePresentation: { ...activePresentation, name: newName, updatedAt: now } });
        }
        await get().loadRecents();
    },

    removePresentation: async (presentationId) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (!pres || pres.isMaster) return;

        const now = new Date();
        await db.presentationFiles.delete(presentationId);

        if (pres.serviceId) {
            const service = await db.serviceFiles.get(pres.serviceId);
            if (service) {
                const newIds = service.presentationIds.filter(id => id !== presentationId);
                await db.serviceFiles.update(pres.serviceId, { presentationIds: newIds, updatedAt: now });
                if (get().activeServiceId === pres.serviceId) {
                    set({ activeService: { ...service, presentationIds: newIds, updatedAt: now } });
                }
            }
        }

        if (get().activePresentationId === presentationId) {
            const service = pres.serviceId ? await db.serviceFiles.get(pres.serviceId) : null;
            if (service) {
                await get().setActivePresentation(service.masterPresentationId);
            } else {
                await get().setActivePresentation(null);
            }
        }
        await get().loadRecents();
    },

    saveActiveService: async () => {
        const { activeServiceId, activeService } = get();
        if (!activeServiceId || !activeService) return;

        set({ isSaving: true });
        try {
            const { EktService } = await import('../../services/ektService');
            if (activeService.fileHandle) {
                await EktService.save(activeServiceId);
            } else {
                const blob = await EktService.pack(activeServiceId);
                EktService.download(blob, activeService.name);
            }
        } catch (error) {
            console.error('Failed to save service:', error);
            throw error;
        } finally {
            set({ isSaving: false });
        }
    },

    saveActivePresentation: async () => {
        const { activePresentationId, activePresentation } = get();
        if (!activePresentationId || !activePresentation) return;
        set({ isSaving: true });
        try {
            await db.presentationFiles.update(activePresentationId, {
                slides: activePresentation.slides,
                updatedAt: new Date()
            });
        } finally {
            set({ isSaving: false });
        }
    },

    importSlidesToService: async (presentationName, slides) => {
        const { activeServiceId } = get();
        if (!activeServiceId) {
            toast.error(i18n.t('no_active_service', 'No active service available'));
            return;
        }

        const newPresId = await get().createPresentation(presentationName, { serviceId: activeServiceId });
        const processedSlides = slides.map((s, i) => ({
            ...s,
            id: crypto.randomUUID(),
            order: i
        }));

        await get().updatePresentationSlides(newPresId, processedSlides);
        toast.success(i18n.t('slides_imported_to_service', 'Slides imported successfully'));
    },
});
