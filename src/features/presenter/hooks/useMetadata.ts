import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '@/core/db';
import { IBlock, ITemplate } from '@/core/types';

export interface UseMetadataReturn {
  blocks: IBlock[];
  templates: ITemplate[];
  blocksMap: Map<string, IBlock>;
  templatesMap: Map<string, ITemplate>;
}

/**
 * Shared hook to get blocks and templates with caching.
 * This prevents multiple components from querying the entire tables individually.
 */
export function useMetadata(): UseMetadataReturn {
  const blocks = useLiveQuery(() => db.blocks.toArray(), []) || [];
  const templates = useLiveQuery(() => db.templates.toArray(), []) || [];

  const blocksMap = useMemo(() => new Map(blocks.map(b => [b.id, b])), [blocks]);
  const templatesMap = useMemo(() => new Map(templates.map(t => [t.id, t])), [templates]);

  return {
    blocks,
    templates,
    blocksMap,
    templatesMap
  };
}
