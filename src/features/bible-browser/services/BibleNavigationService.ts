import { db } from '@/core/db';
import { Verse } from '@/core/types';

/**
 * Service for handling Bible navigation logic, such as finding neighboring verses
 * or resolving references relative to the current position.
 */
export class BibleNavigationService {
    /**
     * Finds the next verse in the current chapter/translation.
     */
    static async getNextVerse(currentVerse: Verse, translationId: string): Promise<Verse | null> {
        return await db.verses
            .where('[translationId+bookId+chapter]')
            .equals([translationId, currentVerse.bookId, currentVerse.chapter])
            .and(v => v.verseNumber === currentVerse.verseNumber + 1)
            .first() || null;
    }

    /**
     * Finds the previous verse in the current chapter/translation.
     */
    static async getPrevVerse(currentVerse: Verse, translationId: string): Promise<Verse | null> {
        return await db.verses
            .where('[translationId+bookId+chapter]')
            .equals([translationId, currentVerse.bookId, currentVerse.chapter])
            .and(v => v.verseNumber === currentVerse.verseNumber - 1)
            .first() || null;
    }
}
