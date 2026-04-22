import { findBookIdFuzzy } from './bibleSearchUtils';
import { findTopics } from '@/core/data/topicalData';

export interface ParseResult {
    type: 'reference' | 'topic' | 'keyword';
    items: ParsedItem[];
    originalQuery: string;
}

export interface ParsedItem {
    type: 'reference' | 'topic' | 'keyword';
    bookId?: string;
    bookName?: string;
    chapter?: number;
    verse?: number;
    verseEnd?: number; // For ranges
    isCorrected?: boolean;
    query: string;
    refs?: string[]; // For topics
}

/**
 * Parses a search query into multi-type results (batch support)
 */
export function parseSearchQuery(query: string, lang: string = 'en'): ParseResult {
    const trimmed = query.trim();
    if (!trimmed) return { type: 'keyword', items: [], originalQuery: '' };

    // Batch support: split by comma
    const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
    const parsedItems: ParsedItem[] = [];

    for (const part of parts) {
        const item = parseSingleItem(part, lang);
        parsedItems.push(item);
    }

    // Determine primary type
    let primaryType: 'reference' | 'topic' | 'keyword' = 'keyword';
    if (parsedItems.some(i => i.type === 'reference')) primaryType = 'reference';
    else if (parsedItems.some(i => i.type === 'topic')) primaryType = 'topic';

    return {
        type: primaryType,
        items: parsedItems,
        originalQuery: trimmed
    };
}

function parseSingleItem(query: string, lang: string): ParsedItem {
    // 1. Try Topic match first (exact or startsWith)
    const topics = findTopics(query, lang);
    if (topics.length > 0) {
        return {
            type: 'topic',
            query,
            refs: topics[0].refs // Take first matching topic
        };
    }

    // 2. Try Reference match
    // Pattern: [BookPart] [Num1] [Sep] [Num2] [RangeSep] [Num3]
    // Handled: "1 J 3 1", "J316", "Jn 3:16-18", "3:16"
    
    // Regex explanation:
    // Group 1: Book name part (optional, can have digits at start)
    // Group 2: Chapter
    // Group 3: Optional separator (: or space)
    // Group 4: Verse Start
    // Group 5: Optional range separator (-)
    // Group 6: Verse End
    const refRegex = /^((?:\d\s*)?[a-zA-Zа-яА-ЯёЁ\s]+)?\s*(\d+)(?:[\s:]+(\d+)(?:\s*-\s*(\d+))?)?$/;
    
    // For compact "J316", we need another approach: split letters and numbers
    let workingQuery = query;
    const compactMatch = query.match(/^([a-zA-Zа-яА-ЯёЁ]+)(\d+)$/);
    if (compactMatch) {
        const bookStr = compactMatch[1];
        const numStr = compactMatch[2]; // e.g., "316"
        
        // Strategy for "316": if 3 chars, probably 3:16. If 2 chars, probably 3:1 (wait, usually 31:6 or 31:6).
        // Let's be smart: if it's 3 digits, usually C:VV. 
        if (numStr.length === 3) {
            workingQuery = `${bookStr} ${numStr[0]} ${numStr.substring(1)}`;
        } else if (numStr.length === 4) {
            workingQuery = `${bookStr} ${numStr.substring(0, 2)} ${numStr.substring(2)}`;
        } else if (numStr.length === 2) {
            workingQuery = `${bookStr} ${numStr[0]} ${numStr[1]}`;
        }
    }

    const match = workingQuery.match(refRegex);
    if (match) {
        const bookPart = match[1]?.trim();
        const chapter = parseInt(match[2]);
        const verse = match[3] ? parseInt(match[3]) : undefined;
        const verseEnd = match[4] ? parseInt(match[4]) : undefined;

        if (bookPart) {
            const resolvedBook = findBookIdFuzzy(bookPart, lang);
            if (resolvedBook) {
                return {
                    type: 'reference',
                    bookId: resolvedBook.id,
                    bookName: resolvedBook.name,
                    chapter,
                    verse,
                    verseEnd,
                    isCorrected: resolvedBook.isCorrected,
                    query: workingQuery
                };
            }
        } else {
            // No book part, e.g., "3:16" - caller handles currentBookId
            return {
                type: 'reference',
                chapter,
                verse,
                verseEnd,
                query: workingQuery
            };
        }
    }

    // 3. Fallback to Keyword
    return {
        type: 'keyword',
        query
    };
}
