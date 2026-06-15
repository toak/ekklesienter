import { BibleData, Book, Verse, Translation } from '@/core/types';
import { SEQUENTIAL_TO_STANDARD, getBookName, getBookOrder } from '@/core/data/bookData';
import { extractWords } from '@/features/search/utils/bibleSearchUtils';

/**
 * Parsers for Zefania XML Bible Format
 * Reference: http://www.zefania.de/
 */
export class ZefaniaParser {
    /**
     * Parses a Zefania XML string into BibleData objects
     */
    async parse(xmlContent: string, fileName: string): Promise<BibleData> {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, "text/xml");

        // Check for parsing errors
        const errorNode = doc.querySelector('parsererror');
        if (errorNode) {
            throw new Error(`XML Parsing Error: ${errorNode.textContent}`);
        }

        // 1. Extract Translation Info
        const xmlBible = doc.querySelector('XMLBIBLE');
        if (!xmlBible) {
            throw new Error("Invalid Zefania XML: Missing root XMLBIBLE tag");
        }

        const bibleName = xmlBible.getAttribute('biblename') || fileName;
        const revision = xmlBible.getAttribute('revision') || undefined;

        // Try to detect language from XML
        let language = 'en';
        const langAttr = xmlBible.getAttribute('language');
        if (langAttr) {
            language = langAttr.substring(0, 2).toLowerCase();
        }

        // Generate an ID based on filename or name (sanitized)
        const id = fileName.replace(/\.xml$/i, '').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();

        const translation: Translation = {
            id,
            name: bibleName,
            language,
            version: revision
        };

        // 2. Parse Books
        const books: Book[] = [];
        const verses: Verse[] = [];

        const xmlBooks = doc.querySelectorAll('BIBLEBOOK');

        xmlBooks.forEach((xmlBook) => {
            const bnumber = parseInt(xmlBook.getAttribute('bnumber') || '0');
            // Prefer bname from XML, but also have localized fallback
            const bname = xmlBook.getAttribute('bname');

            const bookId = SEQUENTIAL_TO_STANDARD[bnumber];
            if (!bookId) return; // Skip unknown books

            // Get localized name if bname not provided in XML
            const bookName = bname || getBookName(bookId, language);

            const chapters: number[] = [];

            const xmlChapters = xmlBook.querySelectorAll('CHAPTER');

            xmlChapters.forEach((xmlChapter) => {
                const cnumber = parseInt(xmlChapter.getAttribute('cnumber') || '0');
                if (cnumber === 0) return;

                chapters.push(cnumber);

                const xmlVerses = xmlChapter.querySelectorAll('VERS');
                xmlVerses.forEach((xmlVerse) => {
                    const vnumber = parseInt(xmlVerse.getAttribute('vnumber') || '0');
                    if (vnumber === 0) return;

                    // Text content cleanup: remove newlines, extra spaces
                    const text = (xmlVerse.textContent || '').replace(/\s+/g, ' ').trim();

                    verses.push({
                        translationId: id,
                        bookId,
                        chapter: cnumber,
                        verseNumber: vnumber,
                        text,
                        words: extractWords(text)
                    });
                });
            });

            books.push({
                bookId,
                translationId: id,
                name: bookName,
                chapters
            });
        });

        // Sort books by canonical order
        books.sort((a, b) => getBookOrder(a.bookId) - getBookOrder(b.bookId));

        return {
            translation,
            books,
            verses
        };
    }
}

export const zefaniaParser = new ZefaniaParser();
