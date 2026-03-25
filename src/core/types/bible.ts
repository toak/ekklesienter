export interface Translation {
  id: string; // e.g., 'KJV', 'WEB', 'RST'
  name: string; // e.g., 'King James Version'
  language: string; // e.g., 'en', 'ru'
  version?: string;
}

export interface Verse {
  id?: number; // Added for IndexedDB
  translationId: string; // FK to Translation
  bookId: string;
  chapter: number;
  verseNumber: number;
  text: string; // Markdown supported
}

export interface Book {
  id?: number; // Auto-increment PK for IndexedDB
  bookId: string; // Generic Book ID (GEN, EXO)
  translationId: string; // Books might have translated names
  name: string;
  chapters: number[];
}

export interface BibleData {
  translation: Translation;
  books: Book[];
  verses: Verse[];
}

export interface NavigationState {
  currentBookId: string;
  currentChapter: number;
  activeVerseIndex: number; // Index within the filtered verses of current chapter
}
