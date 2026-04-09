import Dexie, { type EntityTable } from 'dexie';
import { Verse, Book, Translation, IBlock, IPresentationFile, IServiceFile, ITemplate, ILogoEntry, IBackgroundEntry, IMediaItem, IMediaBin, IPresentationBin, IAudioScope } from '../types';
import { INITIAL_DATA } from '../data/bibleData';
import { DEFAULT_BLOCKS, DEFAULT_TEMPLATES } from '../data/presentationData';

interface Setting {
    key: string;
    value: unknown;
}

const DB_NAME = 'ScripturePresenterDB';

// NOTE: If you get schema errors, clear IndexedDB in browser DevTools
// Application > Storage > IndexedDB > Delete "ScripturePresenterDB"

export class ScriptureDatabase extends Dexie {
    verses!: EntityTable<Verse, 'id'>;
    books!: EntityTable<Book, 'id'>;
    settings!: EntityTable<Setting, 'key'>;
    translations!: EntityTable<Translation, 'id'>;

    // Presentation tables
    blocks!: EntityTable<IBlock, 'id'>;
    presentationFiles!: EntityTable<IPresentationFile, 'id'>;
    serviceFiles!: EntityTable<IServiceFile, 'id'>;
    templates!: EntityTable<ITemplate, 'id'>;
    logos!: EntityTable<ILogoEntry, 'id'>;
    backgrounds!: EntityTable<IBackgroundEntry, 'id'>;
    mediaPool!: EntityTable<IMediaItem, 'id'>;
    mediaBins!: EntityTable<IMediaBin, 'id'>;
    presentationBins!: EntityTable<IPresentationBin, 'id'>;
    audioScopes!: EntityTable<IAudioScope, 'id'>;

    constructor() {
        super(DB_NAME);

        // Single consolidated schema — all tables defined upfront.
        // Previous migrations (v1–v16) have been collapsed since there are no existing users.
        this.version(4).stores({
            verses: '++id, [translationId+bookId+chapter], translationId',
            books: '++id, [translationId+bookId], translationId',
            translations: 'id',
            settings: 'key',
            blocks: 'id',
            presentationFiles: 'id, updatedAt, workflowId, lastOpened, serviceId, binId, ektpHash',
            templates: 'id, category',
            logos: 'id',
            backgrounds: 'id',
            mediaPool: 'id, name, path, type, createdAt, binId',
            mediaBins: 'id, createdAt',
            presentationBins: 'id, createdAt',
            audioScopes: 'id, presentationId, startSlideId, endSlideId',
            serviceFiles: 'id, lastOpened, updatedAt',
        });

        this.on('populate', () => {
            this.seed();
        });

        // Cleanup broken media on startup
        this.on('ready', () => {
            this.sanitize();
        });
    }

    async sanitize() {
        try {
            console.log('[DB] Starting database sanitization...');

            // 1. Sanitize Media Pool
            const brokenItems = await this.mediaPool
                .filter(item => 
                    typeof item.path === 'string' && (
                        item.path.startsWith('blob:') || 
                        item.path.includes('webkit-fake-url')
                    )
                )
                .toArray();
            
            if (brokenItems.length > 0) {
                console.warn(`[DB] Sanitizing ${brokenItems.length} broken media items from pool...`);
                await this.mediaPool.bulkDelete(brokenItems.map(i => i.id));
            }

            // 2. Sanitize Presentation Thumbnails
            const presentations = await this.presentationFiles.toArray();
            for (const pres of presentations) {
                if (pres.thumbnailUrl?.startsWith('blob:') || pres.thumbnailUrl?.includes('webkit-fake-url')) {
                    console.warn(`[DB] Clearing stale blob thumbnail for presentation: ${pres.name} (${pres.id})`);
                    await this.presentationFiles.update(pres.id, { thumbnailUrl: undefined });
                }
            }

            // 3. Sanitize Template Thumbnails
            const templates = await this.templates.toArray();
            for (const template of templates) {
                if (template.thumbnail?.startsWith('blob:') || template.thumbnail?.includes('webkit-fake-url')) {
                    console.warn(`[DB] Clearing stale blob thumbnail for template: ${template.name} (${template.id})`);
                    await this.templates.update(template.id, { thumbnail: undefined });
                }
            }

            console.log('[DB] Sanitization complete.');
        } catch (err) {
            console.error('[DB] Sanitization failed:', err);
        }
    }

    async seed() {
        // Individual checks for each core table to ensure survivors from older versions get new metadata
        const transCount = await this.translations.count();
        if (transCount === 0) {
            await this.transaction('rw', [this.verses, this.books, this.translations], async () => {
                await this.translations.add(INITIAL_DATA.translation);
                await this.books.bulkAdd(INITIAL_DATA.books);
                await this.verses.bulkAdd(INITIAL_DATA.verses);
            });
        }

        const blocksCount = await this.blocks.count();
        if (blocksCount === 0) {
            await this.blocks.bulkAdd(DEFAULT_BLOCKS);
        }

        const templatesCount = await this.templates.count();
        if (templatesCount === 0) {
            await this.templates.bulkAdd(DEFAULT_TEMPLATES);
        }
    }
}

export const db = new ScriptureDatabase();
