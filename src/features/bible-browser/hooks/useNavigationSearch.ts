import { useState, useEffect, useMemo } from 'react';
import { parseSearchQuery, ParseResult } from '@/features/search/utils/searchParser';
import { searchVerses, SearchResult } from '@/features/search/services/globalSearchService';
import { ErrorLoggingService } from '@/core/services/errorLoggingService';

/**
 * Hook to handle navigation search logic (parsing and verse results)
 */
export function useNavigationSearch(lang: string, currentTranslationId: string): {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  searchResults: SearchResult[];
  isSearching: boolean;
  parseResult: ParseResult;
} {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const parseResult = useMemo(() => parseSearchQuery(searchQuery, lang), [searchQuery, lang]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (parseResult.type === 'keyword' && parseResult.originalQuery.length >= 2) {
        setIsSearching(true);
        try {
          const results = await searchVerses(parseResult.originalQuery, currentTranslationId);
          setSearchResults(results);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          await ErrorLoggingService.logError(err, 'error', {
            component: 'useNavigationSearch',
            query: parseResult.originalQuery,
            translationId: currentTranslationId
          });
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [parseResult, currentTranslationId]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    parseResult
  };
}
