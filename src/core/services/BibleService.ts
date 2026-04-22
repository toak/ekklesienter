import { db } from '@/core/db';
import { BibleData, Translation, Verse, Book } from '@/core/types';

/**
 * Service for managing Bible translations and data.
 * Centralizes all IndexedDB operations for verses, books, and translations.
 */
export const BibleService = {
    /**
     * Retrieves all installed translations.
     */
    async getAllTranslations(): Promise<Translation[]> {
        return await db.translations.toArray();
    },

    /**
     * Saves a complete bible dataset (translation info + books + verses).
     * Uses an atomic transaction to ensure data integrity.
     */
    async saveBibleData(data: BibleData): Promise<void> {
        await db.transaction('rw', [db.translations, db.books, db.verses], async () => {
            await db.translations.put(data.translation);
            await db.books.bulkPut(data.books);
            await db.verses.bulkPut(data.verses);
        });
    },

    /**
     * Saves partial Bible metadata (translation and books).
     * Used in chunked/streamed import flows to prepare the DB.
     */
    async saveTranslationAndBooks(translation: Translation, books: Book[]): Promise<void> {
        await db.transaction('rw', [db.translations, db.books], async () => {
            await db.translations.put(translation);
            await db.books.bulkPut(books);
        });
    },

    /**
     * Efficiently saves a chunk of verses to the database.
     * Use this for large Bibles to prevent memory pressure or UI blocking.
     */
    async saveVerseChunk(verses: Verse[]): Promise<void> {
        await db.verses.bulkPut(verses);
    },

    /**
     * Deletes a translation and its associated books and verses.
     */
    async deleteTranslation(translationId: string): Promise<void> {
        await db.transaction('rw', [db.translations, db.books, db.verses], async () => {
            await db.translations.delete(translationId);
            await db.books.where('translationId').equals(translationId).delete();
            await db.verses.where('translationId').equals(translationId).delete();
        });
    },

    /**
     * Checks if a translation exists by ID.
     */
    async hasTranslation(translationId: string): Promise<boolean> {
        const count = await db.translations.where('id').equals(translationId).count();
        return count > 0;
    },

    /**
     * Finds the next verse in context.
     */
    async getNextVerse(anchor: Verse): Promise<Verse | null> {
        return await db.verses
            .where('[translationId+bookId+chapter]')
            .equals([anchor.translationId, anchor.bookId, anchor.chapter])
            .and(v => v.verseNumber === anchor.verseNumber + 1)
            .first() || null;
    },

    /**
     * Finds the previous verse in context.
     */
    async getPrevVerse(anchor: Verse): Promise<Verse | null> {
        return await db.verses
            .where('[translationId+bookId+chapter]')
            .equals([anchor.translationId, anchor.bookId, anchor.chapter])
            .and(v => v.verseNumber === anchor.verseNumber - 1)
            .first() || null;
    },

    /**
     * Updates the text of a specific verse.
     */
    async updateVerseText(verseId: number, newText: string): Promise<void> {
        await db.verses.update(verseId, { text: newText });
    }
};
