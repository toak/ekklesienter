import { useState, useEffect, useMemo } from 'react';
import { parseSearchQuery } from '@/features/search/utils/searchParser';
import { searchVerses, SearchResult } from '@/features/search/services/globalSearchService';

/**
 * Hook to handle navigation search logic (parsing and verse results)
 */
export function useNavigationSearch(lang: string, currentTranslationId: string) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const parseResult = useMemo(() => parseSearchQuery(searchQuery, lang), [searchQuery, lang]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (parseResult.type === 'keyword' && parseResult.query.length >= 2) {
        setIsSearching(true);
        try {
          const results = await searchVerses(parseResult.query, currentTranslationId);
          setSearchResults(results);
        } catch (error) {
          console.error('Search error:', error);
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
