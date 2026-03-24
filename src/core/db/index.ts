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
        this.version(2).stores({
            verses: '++id, [translationId+bookId+chapter], translationId',
            books: '++id, [translationId+bookId], translationId',
            translations: 'id',
            settings: 'key',
            blocks: 'id',
            presentationFiles: 'id, updatedAt, workflowId, lastOpened, serviceId, binId',
            templates: 'id, category',
            logos: 'id',
            backgrounds: 'id',
            mediaPool: 'id, name, type, createdAt, binId',
            mediaBins: 'id, createdAt',
            presentationBins: 'id, createdAt',
            audioScopes: 'id, presentationId, startSlideId, endSlideId',
            serviceFiles: 'id, lastOpened, updatedAt',
        });

        this.on('populate', () => {
            this.seed();
        });
    }

    async seed() {
        const count = await this.translations.count();
        if (count === 0) {
            await this.transaction('rw', [this.verses, this.books, this.translations, this.blocks, this.templates], async () => {
                await this.translations.add(INITIAL_DATA.translation);
                await this.books.bulkAdd(INITIAL_DATA.books);
                await this.verses.bulkAdd(INITIAL_DATA.verses);

                // Only seed the minimal defaults — everything else comes from bundled templates
                await this.blocks.bulkAdd(DEFAULT_BLOCKS);
                await this.templates.bulkAdd(DEFAULT_TEMPLATES);
            });
        }
    }
}

export const db = new ScriptureDatabase();
