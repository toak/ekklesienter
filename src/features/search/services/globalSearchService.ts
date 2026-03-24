import { db } from '@/core/db';
import { Verse } from '@/core/types';
import { sanitizeHtml } from '@/core/utils/sanitizeHtml';

export interface SearchResult {
    verse: Verse;
    highlightedText: string;
}

/**
 * Searches for keywords in the verses table across the current translation.
 */
export async function searchVerses(
    query: string,
    translationId: string,
    limit: number = 50
): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];

    const lowerQuery = query.toLowerCase();

    // We search in the current translation
    // Optimization: Scope by translationId index first, then filter.
    // This is much faster than a full-table filter.
    const verses = await db.verses
        .where('translationId')
        .equals(translationId)
        .filter(v => v.text.toLowerCase().includes(lowerQuery))
        .limit(limit)
        .toArray();

    return verses.map(v => ({
        verse: v,
        highlightedText: highlightMatches(v.text, query)
    }));
}

/**
 * Wraps matches in <mark> tags for highlighting
 */
function highlightMatches(text: string, query: string): string {
    if (!query) return text;
    const sanitized = sanitizeHtml(text);
    const regex = new RegExp(`(${query})`, 'gi');
    return sanitized.replace(regex, '<mark class="bg-accent/30 text-accent px-0.5 rounded-sm ring-1 ring-accent/20">$1</mark>');
}
