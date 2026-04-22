import { db } from '@/core/db';
import { Verse } from '@/core/types';
import { sanitizeHtml } from '@/core/utils/sanitizeHtml';
import { extractWords } from '@/features/search/utils/bibleSearchUtils';

export interface SearchResult {
    verse: Verse;
    highlightedText: string;
    isDiscovery?: boolean; // True if found via another translation
    sourceTranslationId?: string;
}

/**
 * Searches for keywords in the verses table.
 * Uses optimized word-based indexing.
 */
export async function searchVerses(
    query: string,
    translationId: string,
    limit: number = 50
): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];

    const words = extractWords(query);
    if (words.length === 0) return [];

    // 1. PRIMARY SEARCH: Current Translation
    let results = await performKeywordSearch(words, translationId, limit);

    // 2. DISCOVERY SEARCH: Fallback to other translations if no results
    if (results.length === 0) {
        const allTranslations = await db.translations.toArray();
        const otherTranslationIds = allTranslations
            .map(t => t.id)
            .filter(id => id !== translationId);

        for (const otherId of otherTranslationIds) {
            const discoveryResults = await performKeywordSearch(words, otherId, limit);
            if (discoveryResults.length > 0) {
                // We found matches in another translation!
                // Now resolve these references back to the target translation
                const resolvedResults: SearchResult[] = [];
                for (const res of discoveryResults) {
                    const targetVerse = await db.verses
                        .where('[translationId+bookId+chapter]')
                        .equals([translationId, res.bookId, res.chapter])
                        .and(v => v.verseNumber === res.verseNumber)
                        .first();

                    if (targetVerse) {
                        resolvedResults.push({
                            verse: targetVerse,
                            highlightedText: highlightMatches(targetVerse.text, query),
                            isDiscovery: true,
                            sourceTranslationId: otherId
                        });
                    }
                }

                if (resolvedResults.length > 0) {
                    return resolvedResults;
                }
            }
        }
    }

    return results.map(v => ({
        verse: v,
        highlightedText: highlightMatches(v.text, query)
    }));
}

/**
 * Optimized indexed search for a set of words in a specific translation
 */
async function performKeywordSearch(words: string[], translationId: string, limit: number): Promise<Verse[]> {
    // Multi-entry index search: query for the first (likely rarest or just first) word
    // and then filter results for the rest of the words.
    const firstWord = words[0];
    const otherWords = words.slice(1);

    return await db.verses
        .where('words')
        .equals(firstWord)
        .and(v => {
            if (v.translationId !== translationId) return false;
            return otherWords.every(w => v.words?.includes(w));
        })
        .limit(limit)
        .toArray();
}

/**
 * Wraps matches in <mark> tags for highlighting
 */
function highlightMatches(text: string, query: string): string {
    if (!query) return text;
    const sanitized = sanitizeHtml(text);
    // Escape regex characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return sanitized.replace(regex, '<mark class="bg-accent/30 text-accent px-0.5 rounded-sm ring-1 ring-accent/20 font-bold">$1</mark>');
}
