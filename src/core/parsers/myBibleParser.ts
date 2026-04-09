import initSqlJs, { Database } from 'sql.js';
import { BibleData, Book, Verse, Translation } from '@/core/types';
import {
    MYBIBLE_TO_STANDARD,
    SEQUENTIAL_TO_STANDARD,
    getBookName,
    getBookOrder,
    BOOK_ORDER,
    BOOK_NAMES
} from '@/core/data/bookData';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

/**
 * MyBible SQLite Parser
 * Parses .sqlite3 / .SQLite3 files from MyBible app ecosystem
 * Reference: http://mb.igr.bible
 */

/**
 * Clean MyBible text by removing HTML-like tags
 */
function cleanText(text: string): string {
    return text
        // Remove Strong's numbers: <S>1234</S>
        .replace(/<S>.*?<\/S>/gi, '')
        // Remove Jesus words markers: <J>...</J> (keep the content)
        .replace(/<\/?J>/gi, '')
        // Replace paragraph breaks with special marker that survives generic tag stripping
        .replace(/<pb\/?>/gi, '\n¶\n')
        // Remove footnotes: <RF>...</RF>
        .replace(/<RF>.*?<\/RF>/gi, '')
        // Remove other common tags
        .replace(/<\/?[a-zA-Z][^>]*>/g, '')
        // Clean up extra whitespace
        .replace(/\s+/g, ' ')
        // Restore paragraph breaks (replace marker with double newline)
        .replace(/\s*¶\s*/g, '\n\n')
        .trim();
}

/**
 * Detect which book mapping to use based on book numbers in the database
 */
function detectMappingType(bookNumbers: number[]): 'mybible' | 'sequential' {
    const maxNum = Math.max(...bookNumbers);

    // Critical Heuristic: MyBible uses 10, 20... 730+. Sequential uses 1..66.
    // If we see any number > 80, it is almost certainly MyBible (or at least NOT sequential).
    if (maxNum > 80) {
        return 'mybible';
    }

    let myBibleScore = 0;
    let sequentialScore = 0;

    for (const num of bookNumbers) {
        if (MYBIBLE_TO_STANDARD[num]) myBibleScore++;
        if (SEQUENTIAL_TO_STANDARD[num]) sequentialScore++;
    }

    // Heuristic: Choose the mapping that recognizes more books.
    // If tie, prefer MyBible (standard for .sqlite3) unless we have strong Sequential signals (like books 1-9)
    if (sequentialScore > myBibleScore) {
        return 'sequential';
    }

    // Tie-breaker: If scores are equal, check for book 1 (Genesis in Sequential)
    if (sequentialScore === myBibleScore) {
        if (bookNumbers.includes(1)) return 'sequential';
    }

    return 'mybible';
}

export class MyBibleParser {
    private sqlPromise: Promise<typeof import('sql.js')> | null = null;

    private async getSql() {
        if (!this.sqlPromise) {
            this.sqlPromise = initSqlJs({
                // Load wasm from Vite-managed URL
                locateFile: (file) => {
                    console.log(`[MyBibleParser] Locating SQL.js file: ${file}, using wasmUrl: ${wasmUrl}`);
                    return wasmUrl;
                }
            });
        }
        return this.sqlPromise;
    }

    async parse(fileBuffer: ArrayBuffer, fileName: string): Promise<BibleData> {
        console.log(`[MyBibleParser] Starting parse of "${fileName}" (${fileBuffer.byteLength} bytes)`);
        const SQL = await this.getSql();
        let db: Database;
        
        try {
            db = new SQL.Database(new Uint8Array(fileBuffer));
            console.log(`[MyBibleParser] Database initialized successfully for ${fileName}`);
        } catch (e) {
            console.error(`[MyBibleParser] Failed to initialize SQLite database for ${fileName}:`, e);
            throw new Error(`Failed to initialize database: ${e instanceof Error ? e.message : String(e)}`);
        }

        try {
            // 1. Get translation info from 'info' table
            let translationName = fileName.replace(/\.sqlite3?$/i, '');
            let language = 'en';

            try {
                const infoResult = db.exec("SELECT name, value FROM info");
                if (infoResult.length > 0) {
                    const infoRows = infoResult[0].values;
                    for (const row of infoRows) {
                        const name = String(row[0]).toLowerCase();
                        const value = String(row[1]);
                        if (name === 'description' || name === 'title') {
                            translationName = value;
                        }
                        if (name === 'language') {
                            language = value.substring(0, 2).toLowerCase();
                        }
                    }
                }
            } catch {
                // Info table might not exist, use filename
            }

            // 2. Try to read info (skipped here, handled later or not needed for names)
            const translationId = fileName
                .replace(/\.sqlite3?$/i, '')
                .replace(/[^a-zA-Z0-9]/g, '_')
                .toUpperCase();

            const translation: Translation = {
                id: translationId,
                name: translationName,
                language
            };

            // 3. Get all verses
            const versesResult = db.exec("SELECT book_number, chapter, verse, text FROM verses ORDER BY book_number, chapter, verse");
            if (versesResult.length === 0) {
                console.error(`[MyBibleParser] No verses found in "verses" table for ${fileName}`);
                throw new Error("No verses found in database");
            }

            const rawVerses = versesResult[0].values;
            console.log(`[MyBibleParser] Found ${rawVerses.length} raw verses.`);

            // Detect mapping type
            const bookNumberSet = new Set<number>();
            for (const row of rawVerses) {
                bookNumberSet.add(Number(row[0]));
            }
            const bookNumbers = Array.from(bookNumberSet).sort((a, b) => a - b);
            const mappingType = detectMappingType(bookNumbers);

            // DIAGNOSTIC LOG: Print ALL unique book IDs found in the file

            const bookMap = mappingType === 'mybible' ? MYBIBLE_TO_STANDARD : SEQUENTIAL_TO_STANDARD;

            // DIAGNOSTIC LOG: Print IDs that are NOT in the chosen map
            const unmappedIds = bookNumbers.filter(id => !bookMap[id]);
            if (unmappedIds.length > 0) {
                console.warn(`[MyBibleParser] WARNING: Found ${unmappedIds.length} unmapped Book IDs: [${unmappedIds.join(', ')}]`);
            }

            // Build books and verses
            const booksMap = new Map<string, { chapters: Set<number>; name: string }>();
            const verses: Verse[] = [];

            // STEP 0: valid "books" table check to build dynamic map
            const myBibleBookMap: Record<number, string> = {}; // number -> STANDARD_ID
            const customBookNames: Record<number, string> = {};

            try {
                // Try to read the 'books' table to get accurate names and mappings
                const booksRows = db.exec("SELECT book_number, short_name, long_name FROM books");
                if (booksRows.length > 0 && booksRows[0].values) {

                    for (const row of booksRows[0].values) {
                        const bNum = Number(row[0]);
                        const shortName = String(row[1]).trim(); // e.g., "Gn", "Ex", "Mat"
                        const longName = cleanText(String(row[2]));

                        customBookNames[bNum] = longName;

                        // Try to map via short_name (very reliable for standard MyBible modules)
                        // We need a map of MyBible short names to Standard IDs
                        // For now, we can try to heuristically match or just store it for the fuzzy matcher

                        // If we can match shortName to a standard ID, cache it immediately
                        // Common MyBible short names: Gn, Ex, Lv, Nm, Dt, Js, Jg, Rt, 1Sm, 2Sm...
                        // This is safer than guessing IDs.
                    }
                }
            } catch (e) {
                console.warn("[MyBibleParser] Could not read 'books' table or it does not verify:", e);
            }

            // Cache for dynamic ID mapping (fuzzy match results)
            const dynamicBookMap: Record<number, string> = {};

            for (const row of rawVerses) {
                const bookNumber = Number(row[0]);
                const chapter = Number(row[1]);
                const verseNumber = Number(row[2]);
                const text = cleanText(String(row[3]));

                // CHECK 1: Standard Static Mapping
                let bookId = bookMap[bookNumber];

                // CHECK 2: Dynamic Cache (Previously matched)
                if (!bookId && dynamicBookMap[bookNumber]) {
                    bookId = dynamicBookMap[bookNumber];
                }

                // Get book name early to help with ID detection
                let bookName = '';

                // Use the custom name from 'books' table if available
                if (customBookNames[bookNumber]) {
                    bookName = customBookNames[bookNumber];
                } else if (bookId) {
                    bookName = getBookName(bookId, language);
                }

                // Fallback: If ID not found by number AND not in cache, try to fuzzy match by name
                if (!bookId && bookName) {
                    // TRACE: Specific check for ID 670 (Esther)
                    if (bookNumber === 670 || bookNumber === 730) {
                        console.warn(`[MyBibleParser] TRACE #${bookNumber}: Name="${bookName}", bookId="${bookId}", dynamicMap=${dynamicBookMap[bookNumber]}, bookMap[${bookNumber}]=${bookMap[bookNumber]}`);
                    }

                    // Only log attempting fuzzy match once per book
                    if (chapter === 1 && verseNumber === 1) {
                        console.warn(`[MyBibleParser] ID not found for #${bookNumber} ("${bookName}"). Attempting fuzzy match...`);
                    }

                    // Create reverse lookup for current language + EN + RU
                    const cleanName = bookName.toLowerCase().trim();

                    // Specific overrides for common Russian genitive forms/variations found in modules
                    const RUSSIAN_ALIASES: Record<string, string> = {
                        'притчей': 'PRO', 'притчи': 'PRO',
                        'екклесиаста': 'ECC', 'екклесиаст': 'ECC',
                        'песни песней': 'SNG', 'песнь песней': 'SNG',
                        'исаии': 'ISA', 'исаия': 'ISA',
                        'иеремии': 'JER', 'иеремия': 'JER',
                        'плач иеремии': 'LAM',
                        'иезекииля': 'EZK', 'иезекииль': 'EZK',
                        'даниила': 'DAN', 'даниил': 'DAN',
                        'осии': 'HOS', 'осия': 'HOS',
                        'иоиля': 'JOL', 'иоиль': 'JOL',
                        'амоса': 'AMO', 'амос': 'AMO',
                        'авдия': 'OBA', 'авдий': 'OBA',
                        'ионы': 'JON', 'иона': 'JON',
                        'михея': 'MIC', 'михей': 'MIC',
                        'наума': 'NAM', 'наум': 'NAM',
                        'аввакума': 'HAB', 'аввакум': 'HAB',
                        'софонии': 'ZEP', 'софония': 'ZEP',
                        'аггея': 'HAG', 'аггей': 'HAG',
                        'захарии': 'ZEC', 'захария': 'ZEC',
                        'малахии': 'MAL', 'малахия': 'MAL',
                        // Apostles
                        'матфея': 'MAT', 'марка': 'MRK', 'луки': 'LUK', 'иоанна': 'JHN',
                        'деяния': 'ACT',
                        'иакова': 'JAS', 'петра': '1PE', 'иуды': 'JUD',
                        'откровение': 'REV',

                        // NEW ALIASES (Fixing missing books)
                        'есфирь': 'EST', 'есфири': 'EST',
                        'руфь': 'RUT', 'руфи': 'RUT',
                        'судей': 'JDG', 'судьи': 'JDG',
                        'царств': '1KI', // Handle with care, usually needs number prefix
                        'паралипоменон': '1CH',
                    };

                    // Check aliases first
                    for (const [alias, id] of Object.entries(RUSSIAN_ALIASES)) {
                        if (cleanName.includes(alias)) {
                            bookId = id;
                            // Cache the result!
                            dynamicBookMap[bookNumber] = id;
                            break;
                        }
                    }

                    if (!bookId) {
                        // Helper to find ID by name in a specific language
                        const findIdByName = (lang: string) => {
                            if (!BOOK_NAMES[lang]) return null;
                            for (const [id, name] of Object.entries(BOOK_NAMES[lang])) {
                                const n = name.toLowerCase();
                                // Exact match or simple containment
                                if (cleanName === n || cleanName.includes(n)) return id;
                            }
                            return null;
                        };

                        bookId = findIdByName(language) || findIdByName('en') || findIdByName('ru') ||
                            findIdByName('uk') || findIdByName('de') || findIdByName('zh');

                        if (bookId) {
                            dynamicBookMap[bookNumber] = bookId; // Cache result
                        }
                    }
                }

                if (!bookId) {
                    // Only log once per book to avoid spam
                    if (chapter === 1 && verseNumber === 1) {
                        console.warn(`[MyBibleParser] FAILED to map book #${bookNumber} ("${bookName}") - skipping.`);
                    }
                    continue;
                }

                // Standardize name if possible (consistency)
                // If we have a standard name for this ID in the *current* language, use it.
                // This converts "Книга Притчей" -> "Притчи" for consistency, but leaves specific languages alone if we don't have them.
                if (BOOK_NAMES[language]?.[bookId]) {
                    bookName = BOOK_NAMES[language][bookId];
                } else if (!bookName) {
                    // Fallback if we somehow have ID but no name yet
                    bookName = getBookName(bookId, language);
                }

                // Track chapters per book
                if (!booksMap.has(bookId)) {
                    booksMap.set(bookId, { chapters: new Set(), name: bookName });
                }
                booksMap.get(bookId)!.chapters.add(chapter);

                verses.push({
                    translationId,
                    bookId,
                    chapter,
                    verseNumber,
                    text
                });
            }

            // Convert booksMap to Book array, sorted by canonical order
            const books: Book[] = [];
            for (const [bookId, data] of booksMap) {
                books.push({
                    bookId: bookId,
                    translationId,
                    name: data.name,
                    chapters: [...data.chapters].sort((a, b) => a - b)
                });
            }

            // Sort books by canonical Bible order
            books.sort((a, b) => getBookOrder(a.bookId) - getBookOrder(b.bookId));

            return { translation, books, verses };
        } finally {
            db.close();
        }
    }
}

export const myBibleParser = new MyBibleParser();
