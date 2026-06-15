import { BOOK_ORDER, getBookName } from '@/core/data/bookData';

/**
 * Tokenizes text into a normalized array of words for indexing.
 * Removes punctuation, normalizes to lowercase.
 */
export function extractWords(text: string): string[] {
    if (!text) return [];
    
    // Normalize: lowercase, remove special characters (keep Cyrillic and Latin chars, numbers)
    return text
        .toLowerCase()
        .replace(/[^\w\sа-яА-ЯёЁ]/gu, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 2); // Only index words with 2 or more characters
}

/**
 * Levenshtein distance calculation for fuzzy matching
 */
export function levenshteinDistance(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) matrix[i] = [i];
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }
    return matrix[len1][len2];
}

/**
 * Intelligent book name resolution.
 * Handled: "1 J", "J316", "Genisis", "1Jn"
 */
export function findBookIdFuzzy(input: string, lang: string = 'en'): { id: string; name: string; isCorrected: boolean } | null {
    const query = input.toLowerCase().trim().replace(/[\s\.]/g, '');
    if (!query) return null;

    // 1. Check direct standard ID match (3-char codes)
    const upperQuery = query.toUpperCase();
    if (BOOK_ORDER.some(b => b.id === upperQuery)) {
        return { id: upperQuery, name: getBookName(upperQuery, lang), isCorrected: false };
    }

    // 2. Prepare normalization for all books in multiple languages
    const candidates: { id: string; matches: string[] }[] = BOOK_ORDER.map(b => {
        const names = new Set<string>();
        // Add ID
        names.add(b.id.toLowerCase());
        // Add localized names from common languages
        ['en', 'ru', 'uk', 'de'].forEach(l => {
            const name = getBookName(b.id, l).toLowerCase().replace(/[\s\.]/g, '');
            names.add(name);
        });
        return { id: b.id, matches: Array.from(names) };
    });

    // 3. Exact candidate match (highest priority)
    for (const c of candidates) {
        if (c.matches.some(m => m === query)) {
            return { id: c.id, name: getBookName(c.id, lang), isCorrected: false };
        }
    }

    // 4. Wisdom (abbreviations) - Check this before prefix match to avoid "J" matching "Joshua" (JOS) instead of "John" (JHN)
    const wisdom: Record<string, string> = {
        'j': 'JHN', 'jn': 'JHN', 'ин': 'JHN', 'иоан': 'JHN',
        '1j': '1JN', '1jn': '1JN', '1ин': '1JN', '1иоан': '1JN',
        '2j': '2JN', '2jn': '2JN', '2ин': '2JN', '2иоан': '2JN',
        '3j': '3JN', '3jn': '3JN', '3ин': '3JN', '3иоан': '3JN',
        'gn': 'GEN', 'ex': 'EXO', 'lv': 'LEV', 'nm': 'NUM', 'dt': 'DEU',
        'mt': 'MAT', 'mk': 'MRK', 'lk': 'LUK',
        'быт': 'GEN', 'исх': 'EXO', 'лев': 'LEV', 'чис': 'NUM', 'втор': 'DEU',
        'нав': 'JOS', 'суд': 'JDG', 'руф': 'RUT', 'езд': 'EZR', 'неем': 'NEH', 'есф': 'EST',
        'иов': 'JOB', 'пс': 'PSA', 'прит': 'PRO', 'еккл': 'ECC', 'песн': 'SNG',
        'ис': 'ISA', 'иер': 'JER', 'плач': 'LAM', 'иез': 'EZK', 'дан': 'DAN',
        'ос': 'HOS', 'иоил': 'JOL', 'ам': 'AMO', 'авд': 'OBA', 'ион': 'JON', 'мих': 'MIC',
        'наум': 'NAM', 'авв': 'HAB', 'соф': 'ZEP', 'агг': 'HAG', 'зах': 'ZEC', 'мал': 'MAL',
        'мф': 'MAT', 'мат': 'MAT', 'мк': 'MRK', 'мар': 'MRK', 'лк': 'LUK', 'лук': 'LUK',
        'деян': 'ACT', 'иак': 'JAS', 'рим': 'ROM', 'гал': 'GAL', 'еф': 'EPH',
        'флп': 'PHP', 'кол': 'COL', 'тит': 'TIT', 'флм': 'PHM', 'евр': 'HEB', 'откр': 'REV',
        '1пар': '1CH', '2пар': '2CH', '1цар': '1SA', '2цар': '2SA', '3цар': '1KI', '4цар': '2KI',
        '1кор': '1CO', '2кор': '2CO', '1фес': '1TH', '2фес': '2TH', '1тим': '1TI', '2тим': '2TI', '1пет': '1PE', '2пет': '2PE'
    };
    
    if (wisdom[query]) {
        const id = wisdom[query];
        return { id, name: getBookName(id, lang), isCorrected: false };
    }

    // 5. Exact prefix match 
    for (const c of candidates) {
        if (c.matches.some(m => m.startsWith(query))) {
            return { id: c.id, name: getBookName(c.id, lang), isCorrected: true };
        }
    }

    // 6. Fuzzy distance match (fallback for typos)
    let bestMatch: { id: string; distance: number } | null = null;
    for (const c of candidates) {
        for (const m of c.matches) {
            if (Math.abs(m.length - query.length) > 2) continue;
            const dist = levenshteinDistance(query, m);
            if (dist <= 2 && (!bestMatch || dist < bestMatch.distance)) {
                bestMatch = { id: c.id, distance: dist };
            }
        }
    }

    if (bestMatch && bestMatch.distance <= 1) { // Tighten fuzzy tolerance to 1 for short strings
        return { id: bestMatch.id, name: getBookName(bestMatch.id, lang), isCorrected: true };
    }

    return null;
}
