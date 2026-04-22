/**
 * Static mapping of common topics to Bible references
 * Structured as Topic Name (normalized) -> List of References [BOOK_ID CHAPTER:VERSE]
 */
export const TOPICS: Record<string, Record<string, string[]>> = {
    en: {
        'love': ['JHN 3:16', '1CO 13:4-8', '1JN 4:7-12', 'ROM 5:8', '1CO 13:13'],
        'peace': ['JHN 14:27', 'PHP 4:6-7', 'ROM 15:13', 'ISA 26:3', 'JHN 16:33'],
        'faith': ['HEB 11:1', 'ROM 10:17', 'EPH 2:8-9', '2CO 5:7', 'MAT 17:20'],
        'hope': ['ROM 15:13', 'JER 29:11', 'PSA 33:22', 'ROM 8:24-25', 'ISA 40:31'],
        'grace': ['EPH 2:8-9', '2CO 12:9', 'ROM 3:24', 'TIT 2:11', 'HEB 4:16'],
        'forgiveness': ['EPH 4:32', '1JN 1:9', 'COL 3:13', 'MAT 6:14-15', 'PSA 103:12'],
        'strength': ['PHP 4:13', 'ISA 40:31', 'PSA 28:7', '2CO 12:9-10', 'EPH 6:10'],
        'healing': ['PSA 103:2-3', 'ISA 53:5', 'JAM 5:14-15', '1PE 2:24', 'PSA 147:3'],
        'fear': ['ISA 41:10', '2TI 1:7', 'PSA 27:1', 'PSA 56:3', '1JN 4:18'],
        'joy': ['NEH 8:10', 'PSA 16:11', 'ROM 15:13', 'JAM 1:2', 'JHN 15:11'],
        'marriage': ['GEN 2:24', 'EPH 5:25', 'EPH 5:33', 'HEB 13:4', 'MAT 19:6'],
        'prayer': ['PHP 4:6', '1TH 5:17', 'MAT 6:6', 'JAM 5:16', 'ROM 8:26']
    },
    ru: {
        'любовь': ['JHN 3:16', '1CO 13:4-8', '1JN 4:7-12', 'ROM 5:8', '1CO 13:13'],
        'мир': ['JHN 14:27', 'PHP 4:6-7', 'ROM 15:13', 'ISA 26:3', 'JHN 16:33'],
        'вера': ['HEB 11:1', 'ROM 10:17', 'EPH 2:8-9', '2CO 5:7', 'MAT 17:20'],
        'надежда': ['ROM 15:13', 'JER 29:11', 'PSA 33:22', 'ROM 8:24-25', 'ISA 40:31'],
        'благодать': ['EPH 2:8-9', '2CO 12:9', 'ROM 3:24', 'TIT 2:11', 'HEB 4:16'],
        'прощение': ['EPH 4:32', '1JN 1:9', 'COL 3:13', 'MAT 6:14-15', 'PSA 103:12'],
        'сила': ['PHP 4:13', 'ISA 40:31', 'PSA 28:7', '2CO 12:9-10', 'EPH 6:10'],
        'исцеление': ['PSA 103:2-3', 'ISA 53:5', 'JAM 5:14-15', '1PE 2:24', 'PSA 147:3'],
        'страх': ['ISA 41:10', '2TI 1:7', 'PSA 27:1', 'PSA 56:3', '1JN 4:18'],
        'радость': ['NEH 8:10', 'PSA 16:11', 'ROM 15:13', 'JAM 1:2', 'JHN 15:11'],
        'брак': ['GEN 2:24', 'EPH 5:25', 'EPH 5:33', 'HEB 13:4', 'MAT 19:6'],
        'молитва': ['PHP 4:6', '1TH 5:17', 'MAT 6:6', 'JAM 5:16', 'ROM 8:26']
    }
};

/**
 * Searches for topics by keyword
 */
export function findTopics(query: string, lang: string = 'en'): { topic: string; refs: string[] }[] {
    const languageTopics = TOPICS[lang] || TOPICS.en;
    const lowerQuery = query.toLowerCase().trim();
    
    return Object.entries(languageTopics)
        .filter(([topic]) => topic === lowerQuery || lowerQuery.startsWith(`${topic} `))
        .map(([topic, refs]) => ({ topic, refs }));
}
