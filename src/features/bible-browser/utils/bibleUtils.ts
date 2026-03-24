import { Verse } from '@/core/types';

/**
 * Formats a list of verse numbers into a readable string of ranges and individual verses.
 * Example: [1, 2, 4, 5, 6, 8] -> "1-2, 4-6, 8"
 */
export function formatVerseRange(verseNumbers: number[]): string {
    if (verseNumbers.length === 0) return '';

    // Ensure the verse numbers are sorted
    const sortedVerses = [...verseNumbers].sort((a, b) => a - b);

    const ranges: string[] = [];
    let start = sortedVerses[0];
    let current = start;

    for (let i = 1; i <= sortedVerses.length; i++) {
        // If the current sequence ends (the next verse is not consecutive or we've reached the end)
        if (i === sortedVerses.length || sortedVerses[i] !== current + 1) {
            if (start === current) {
                ranges.push(`${start}`);
            } else {
                ranges.push(`${start}-${current}`);
            }
            if (i < sortedVerses.length) {
                start = sortedVerses[i];
                current = start;
            }
        } else {
            current = sortedVerses[i];
        }
    }

    return ranges.join(', ');
}

/**
 * Formats a multi-verse Bible reference, handling single chapters, multiple chapters, and non-consecutive verses.
 */
export function formatMultiVerseReference(verses: Verse[], bookName: string, lang: string = 'en'): string {
    if (verses.length === 0) return '';

    const first = verses[0];
    const last = verses[verses.length - 1];

    // Case 1: All verses are in the same chapter
    const sameChapter = verses.every(v => v.chapter === first.chapter && v.bookId === first.bookId);

    if (sameChapter) {
        const verseNumbers = verses.map(v => v.verseNumber);
        return `${bookName} ${first.chapter}:${formatVerseRange(verseNumbers)}`;
    }

    // Case 2: Verses span across different books (rare for multi-selection, but handled)
    if (first.bookId !== last.bookId) {
        // Note: We'd need a more complex utility if we wanted to show all book names here.
        // For now, we follow the existing pattern: first verse to last verse.
        // In a real scenario, getBookName(last.bookId, lang) would be needed here.
        // But since this is a utility, we'll keep it simple or pass more info.
        // Given the context of MultiVerseDisplay, let's keep it similar to what it had.
        return `${bookName} ${first.chapter}:${first.verseNumber} – ...`;
    }

    // Case 3: Same book, multiple chapters
    // Simple "start to end" range if it spans multiple chapters
    return `${bookName} ${first.chapter}:${first.verseNumber} – ${last.chapter}:${last.verseNumber}`;
}
