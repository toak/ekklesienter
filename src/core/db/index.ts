import Dexie, { type EntityTable } from 'dexie';
import { Verse, Book, Translation, IBlock, IPresentationFile, IServiceFile, ITemplate, ILogoEntry, IBackgroundEntry, IMediaItem, IMediaBin, IPresentationBin, IAudioScope } from '../types';
import { IErrorLog } from '../types/error';
import { INITIAL_DATA } from '../data/bibleData';
import { extractWords } from '@/features/search/utils/bibleSearchUtils';
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
    error_logs!: EntityTable<IErrorLog, 'id'>;

    // Loading status trackers
    private _isInitializing = false;
    private _initPromise: Promise<void> | null = null;
    public progress = 0;

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

        // v5: Added *words index for fast keyword search
        this.version(5).stores({
            verses: '++id, [translationId+bookId+chapter], translationId, *words',
        });

        // v6: Added error_logs for stability tracking
        this.version(6).stores({
            error_logs: 'id, timestamp, severity',
        });


        // Seed initial data if needed
        this.on('populate', () => {
            this.seed();
        });

        // The 'ready' hook in Dexie runs before DB is fully available to the app
        this.on('ready', () => {
             this._initPromise = this.internalInit();
             return this._initPromise;
        });
    }

    /**
     * Public method to await full database readiness (including reindexing)
     */
    public async waitForFullReady(): Promise<void> {
        await this.open();
        if (this._initPromise) await this._initPromise;
    }

    private async internalInit() {
        if (this._isInitializing) return;
        this._isInitializing = true;
        try {
            await this.sanitize();
            await this.reindexVerses();
        } finally {
            this._isInitializing = false;
        }
    }

    async reindexVerses() {
        try {
            // Check if we've already completed v5 reindexing
            const setting = await this.settings.get('verses_indexed_v5');
            if (setting?.value === true) return;
            
            // Proceed in batches to avoid locking the whole DB for long periods
            const BATCH_SIZE = 1000;
            let offset = 0;
            let count = 0;

            while (true) {
                const batch = await this.verses.offset(offset).limit(BATCH_SIZE).toArray();
                if (batch.length === 0) break;

                const updates: Verse[] = [];
                for (const v of batch) {
                    if (!v.words || v.words.length === 0) {
                        v.words = extractWords(v.text);
                        updates.push(v);
                    }
                }

                if (updates.length > 0) {
                    await this.verses.bulkPut(updates);
                    count += updates.length;
                    // Optional: You could expose a callback for this, but for now we'll just log
                    console.log(`[DB] Reindexed ${count} verses...`);
                }

                offset += BATCH_SIZE;
                // Add a small delay to prevent blocking the UI thread entirely
                await new Promise(r => setTimeout(r, 0));
            }

            await this.settings.put({ key: 'verses_indexed_v5', value: true });
        } catch (err) {
            console.error('[DB] Reindexing failed:', err);
        }
    }

    async sanitize() {
        try {
            // Optimization: Only run sanitize if we haven't done it this session or periodically
            // This is less critical than reindexing, so we keep it simple but faster.

            // 1. Sanitize Media Pool - using indexed search instead of full table filter if possible
            // Since we can't easily index "startsWith('blob:')" as a range, we still filter 
            // but we limit it to suspicious items if we had a more specific index. 
            // For now, let's keep it but make it non-blocking.
            const brokenItems = await this.mediaPool
                .filter(item => 
                    typeof item.path === 'string' && (
                        item.path.startsWith('blob:') || 
                        item.path.includes('webkit-fake-url')
                    )
                )
                .toArray();
            
            if (brokenItems.length > 0) {
                console.warn(`[DB] Sanitizing ${brokenItems.length} broken media items...`);
                await this.mediaPool.bulkDelete(brokenItems.map(i => i.id));
            }

            // 2. Sanitize Presentation Thumbnails (One-time check)
            const presentations = await this.presentationFiles.toArray();
            const updates = presentations
                .filter(pres => pres.thumbnailUrl?.startsWith('blob:') || pres.thumbnailUrl?.includes('webkit-fake-url'))
                .map(pres => ({ id: pres.id, thumbnailUrl: undefined }));
            
            if (updates.length > 0) {
                for (const update of updates) {
                    await this.presentationFiles.update(update.id, { thumbnailUrl: undefined });
                }
            }
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
                // Tokenize initial verses
                const versesWithWords = INITIAL_DATA.verses.map(v => ({
                    ...v,
                    words: extractWords(v.text)
                }));
                await this.verses.bulkAdd(versesWithWords);
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
