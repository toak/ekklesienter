import JSZip from 'jszip';
import { db } from '@/core/db';
import { IServiceFile, IMediaBin } from '@/core/types';
import { EktpService } from './ektpService';
import { sha256, collectMediaRefs, mimeToExt, extToMime, getMediaBlob } from './mediaPackingUtils';
import { ThumbnailService } from './ThumbnailService';
import { APP_VERSION, EKT_SCHEMA_VERSION } from '@/core/constants';

// ------------------------------------------------------------------ //
// Types
// ------------------------------------------------------------------ //

export interface EktMediaManifest {
    [hash: string]: {
        filename: string;
        mimeType: string;
        originalName: string;
        size: number;
        role?: string;
    };
}

export interface EktImportPending {
    newServiceId: string;
    newMasterPresId: string;
    newPresentationIds: string[];
    sourceServiceId: string;
    serviceName: string;
    /** null = нет конфликта, можно сразу commitImport */
    conflict: IServiceFile | null;
    /** внутренние данные для commit */
    _newService: IServiceFile;
}

// ------------------------------------------------------------------ //
// Service
// ------------------------------------------------------------------ //

export const EktService = {

    // ---------------------------------------------------------------- //
    // EXPORT
    // ---------------------------------------------------------------- //

    async pack(serviceId: string): Promise<Blob> {
        const service = await db.serviceFiles.get(serviceId);
        if (!service) throw new Error(`Service ${serviceId} not found`);

        const zip = new JSZip();
        const presFolder   = zip.folder('presentations')!;
        const previewsFolder = zip.folder('previews')!;

        // Единый хеш-сет — медиа не дублируется между презентациями
        const globalHashSet = new Set<string>();
        const manifest_media: EktMediaManifest = {};

        // 1. Упаковать каждую презентацию через EktpService.pack()
        for (const presId of service.presentationIds) {
            const pres = await db.presentationFiles.get(presId);
            if (!pres) continue;

            // pack() рекурсивно упакует nested и заполнит globalHashSet, вернув manifest
            const { blob: ektpBlob, manifest } = await EktpService.pack(presId, globalHashSet);
            Object.assign(manifest_media, manifest);

            const filename = presId === service.masterPresentationId
                ? 'master.ektp'
                : `${presId}.ektp`;
            presFolder.file(filename, ektpBlob, { compression: 'STORE' });

            // Превью
            const thumbBlob = await ThumbnailService.generate(presId);
            if (thumbBlob) {
                previewsFolder.file(`${presId}.png`, thumbBlob);
                if (presId === service.masterPresentationId) {
                    zip.file('preview.png', thumbBlob);
                }
            }
        }

        // 2. Hoist all referenced media blobs to root media/ folder.
        // During EktpService.pack with globalHashSet, media is only bundled in the FIRST
        // .ektp that references it. We hoist here so prepareImport can pre-load everything.
        const mediaFolder = zip.folder('media')!;
        for (const [hash, meta] of Object.entries(manifest_media)) {
            const media = await getMediaBlob(hash);
            if (media) {
                mediaFolder.file(meta.filename, media.blob, { compression: 'STORE' });
            }
        }

        // 3. Media pool bins (structural metadata only — blobs are in media/)
        const mediaPoolFolder = zip.folder('media-pool')!;
        const bins  = await db.mediaBins.toArray();
        mediaPoolFolder.file('bins.json', JSON.stringify(bins, null, 2));

        // 4. Манифесты
        const { fileHandle, ...serviceManifest } = service as any;
        serviceManifest.version = EKT_SCHEMA_VERSION;
        serviceManifest.engineVersion = APP_VERSION;
        zip.file('service.json', JSON.stringify(serviceManifest, null, 2));
        zip.file('manifest_media.json', JSON.stringify(manifest_media, null, 2));

        return await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
        });
    },

    async save(serviceId: string): Promise<void> {
        const service = await db.serviceFiles.get(serviceId);
        if (!service?.fileHandle) return;

        const options = { mode: 'readwrite' };
        if (await (service.fileHandle as any).queryPermission(options) !== 'granted') {
            if (await (service.fileHandle as any).requestPermission(options) !== 'granted') {
                throw new Error('Permission denied');
            }
        }

        const blob = await this.pack(serviceId);
        const writable = await (service.fileHandle as any).createWritable();
        await writable.write(blob);
        await writable.close();
        await db.serviceFiles.update(serviceId, { updatedAt: new Date() });
    },

    // ---------------------------------------------------------------- //
    // IMPORT — Фаза 1: медиа + презентации, service ещё не создан
    // ---------------------------------------------------------------- //

    async prepareImport(blob: Blob | File): Promise<EktImportPending> {
        let zip: JSZip;
        try {
            zip = await JSZip.loadAsync(blob);
        } catch {
            throw new Error('Not a valid ZIP archive');
        }

        // Service manifest
        const serviceFile = zip.file('service.json');
        if (!serviceFile) throw new Error('Missing service.json');
        const service = JSON.parse(await serviceFile.async('string')) as IServiceFile;

        // Шаг 1: залить глобальную media/ в БД ДО импорта презентаций
        // Тогда EktpService.unpack() найдёт медиа по hash и не создаст дубли
        const manifestMediaFile = zip.file('manifest_media.json');
        const manifest_media: EktMediaManifest = manifestMediaFile
            ? JSON.parse(await manifestMediaFile.async('string'))
            : {};

        const mediaFiles = Object.keys(zip.files).filter(
            p => p.startsWith('media/') && !zip.files[p].dir
        );
        for (const path of mediaFiles) {
            const hashExt  = path.split('/').pop()!;
            const hash     = hashExt.split('.')[0];
            const meta     = manifest_media[hash];
            const data     = await zip.file(path)!.async('blob');
            const mimeType = meta?.mimeType ?? extToMime(hashExt);

            const alreadyBg    = await db.backgrounds.get(hash);
            const alreadyPool  = await db.mediaPool.get(hash);
            if (alreadyBg && alreadyPool) continue;

            const mediaName = meta?.originalName ?? hash;
            const mediaCategory = mimeType.startsWith('audio/') ? 'audio'
                : mimeType.startsWith('video/') ? 'video'
                : 'images';
            const organizedPath = `${service.name || 'Imported'}/${mediaCategory}`;

            if (mimeType.startsWith('image/') && !mimeType.includes('svg')) {
                if (!alreadyBg) {
                    await db.backgrounds.add({
                        id: hash,
                        name: mediaName,
                        data,
                        mimeType,
                    });
                }
                // Also add to mediaPool for reusability
                if (!alreadyPool) {
                    await db.mediaPool.add({
                        id: hash,
                        name: mediaName,
                        path: organizedPath,
                        type: 'image',
                        data,
                        createdAt: Date.now(),
                    });
                }
            } else {
                if (!alreadyPool) {
                    await db.mediaPool.add({
                        id: hash,
                        name: mediaName,
                        path: organizedPath,
                        type: mimeType.startsWith('audio/') ? 'audio'
                            : mimeType.startsWith('video/') ? 'video' : 'image',
                        data,
                        createdAt: Date.now(),
                    });
                }
            }
        }

        // Шаг 2: импортировать каждую презентацию через EktpService.unpack()
        // Nested рекурсивно обрабатываются внутри, дедупликация по ektpHash
        const oldToNewPresId = new Map<string, string>();

        const presFiles = Object.keys(zip.files).filter(
            p => p.startsWith('presentations/') && p.endsWith('.ektp')
        );
        for (const path of presFiles) {
            const ektpBlob = await zip.file(path)!.async('blob');
            const newPresId = await EktpService.unpack(ektpBlob);

            const filename = path.split('/').pop()!.replace('.ektp', '');
            const oldId = filename === 'master'
                ? service.masterPresentationId
                : filename;
            oldToNewPresId.set(oldId, newPresId);

            // Превью
            const previewFile = zip.file(`previews/${oldId}.png`);
            if (previewFile) {
                const previewBlob = await previewFile.async('blob');
                const reader = new FileReader();
                const thumbnailUrl = await new Promise<string>(resolve => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(previewBlob);
                });
                await db.presentationFiles.update(newPresId, { thumbnailUrl });
            }
        }

        // Шаг 3: подготовить новый service (ещё не писать в БД)
        const newServiceId     = crypto.randomUUID();
        const newMasterPresId  = oldToNewPresId.get(service.masterPresentationId)
            ?? service.masterPresentationId;
        const newPresentationIds = service.presentationIds
            .map(id => oldToNewPresId.get(id))
            .filter(Boolean) as string[];

        const newService: IServiceFile = {
            ...service,
            id: newServiceId,
            masterPresentationId: newMasterPresId,
            presentationIds: newPresentationIds,
            createdAt: new Date(),
            updatedAt: new Date(),
            fileHandle: 'name' in blob ? (blob as any).handle : undefined,
        };

        // Шаг 4: проверить конфликт
        const conflict = await db.serviceFiles.get(service.id) ?? null;

        // Мерж media-pool bins + items (только новое, не трогать существующее)
        // Делаем это здесь, чтобы не передавать zip в commitImport
        const binsFile = zip.file('media-pool/bins.json');
        if (binsFile) {
            const bins = JSON.parse(await binsFile.async('string')) as IMediaBin[];
            for (const bin of bins) {
                if (!(await db.mediaBins.get(bin.id))) {
                    await db.mediaBins.add(bin);
                }
            }
        }

        // NOTE: media-pool/items.json is intentionally NOT imported here.
        // Previously it created ghost entries with data: undefined, which interfered
        // with media lookups. All actual blobs are restored from the root media/ folder
        // above and from individual .ektp files during EktpService.unpack().

        return {
            newServiceId,
            newMasterPresId,
            newPresentationIds,
            sourceServiceId: service.id,
            serviceName: service.name,
            conflict,
            _newService: newService,
        };
    },

    // ---------------------------------------------------------------- //
    // IMPORT — Фаза 2: финализировать service после ответа пользователя
    // ---------------------------------------------------------------- //

    async commitImport(
        pending: EktImportPending,
        resolution: 'replace' | 'create_new'
    ): Promise<string> {
        const { _newService, newPresentationIds, newMasterPresId, conflict } = pending;

        let finalServiceId: string;

        if (resolution === 'replace' && conflict) {
            // Обновляем существующий service — сохраняем его оригинальный id
            finalServiceId = conflict.id;
            await db.serviceFiles.update(conflict.id, {
                ..._newService,
                id: conflict.id,
                updatedAt: new Date(),
            });
        } else {
            // Создаём новый — newServiceId уже заготовлен
            finalServiceId = _newService.id;
            await db.serviceFiles.add(_newService);
        }

        // Привязать все импортированные презентации к финальному service
        for (const presId of newPresentationIds) {
            await db.presentationFiles.update(presId, {
                serviceId: finalServiceId,
                isMaster: presId === newMasterPresId,
            });
        }

        return finalServiceId;
    },

    download(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.endsWith('.ekt') ? filename : `${filename}.ekt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
};
