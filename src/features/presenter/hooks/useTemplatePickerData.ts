import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { ITemplate, IBlock } from '@/core/types';

export type NavLevel =
  | { type: 'all' }
  | { type: 'template'; template: ITemplate }
  | { type: 'block'; template: ITemplate; blockId: string };

/**
 * Hook for template picker data fetching, filtering, and navigation.
 */
export function useTemplatePickerData(blockId?: string) {
  // ─── Data Queries ───
  const allTemplates = useLiveQuery(() => db.templates.toArray()) || [];
  const allBlocks = useLiveQuery(() => db.blocks.toArray()) || [];
  const blocksMap = useMemo(() => new Map(allBlocks.map((b: IBlock) => [b.id, b])), [allBlocks]);

  // ─── Search ───
  const [searchQuery, setSearchQuery] = useState('');

  const templates = useMemo(() => {
    let filtered = allTemplates;
    if (blockId) filtered = filtered.filter(t => t.category === blockId);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.nameRu?.toLowerCase().includes(query)
      );
    }
    return filtered.filter(t => t.id !== 'blank-dark');
  }, [allTemplates, blockId, searchQuery]);

  // ─── Navigation ───
  const [navStack, setNavStack] = useState<NavLevel[]>([{ type: 'all' }]);
  const currentView = navStack[navStack.length - 1];

  const pushNav = (level: NavLevel) => setNavStack([...navStack, level]);
  const popNav = () => setNavStack(navStack.slice(0, -1));

  /** Refresh nav stack after template mutations to keep data in sync */
  const refreshNavTemplate = (updatedTemplate: ITemplate) => {
    setNavStack(prev => prev.map(level =>
      (level.type === 'template' || level.type === 'block') && level.template.id === updatedTemplate.id
        ? { ...level, template: updatedTemplate } : level
    ));
  };

  return {
    allTemplates,
    allBlocks,
    blocksMap,
    templates,
    searchQuery, setSearchQuery,
    navStack, setNavStack,
    currentView,
    pushNav, popNav,
    refreshNavTemplate,
  };
}
