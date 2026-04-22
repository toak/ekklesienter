import { db } from '@/core/db';
import { IBlock, ITemplate, IPresentationFile } from '@/core/types';

/**
 * Service for managing presentation-related data (blocks, templates, files).
 * Centralizes common queries and persistence logic used across the presenter features.
 */
export const PresentationDataService = {
  // --- Blocks ---
  
  async getBlocks(): Promise<IBlock[]> {
    return await db.blocks.toArray();
  },

  async getBlock(id: string): Promise<IBlock | undefined> {
    return await db.blocks.get(id);
  },

  // --- Templates ---

  async getTemplates(): Promise<ITemplate[]> {
    return await db.templates.toArray();
  },

  async getTemplate(id: string): Promise<ITemplate | undefined> {
    return await db.templates.get(id);
  },

  async addTemplate(template: ITemplate): Promise<string> {
    return await db.templates.add(template);
  },

  // --- Presentation Files ---

  async getPresentation(id: string): Promise<IPresentationFile | undefined> {
    return await db.presentationFiles.get(id);
  },

  async updatePresentation(id: string, changes: Partial<IPresentationFile>): Promise<number> {
    return await db.presentationFiles.update(id, changes);
  },

  async getPresentationsInBin(binId: string): Promise<IPresentationFile[]> {
    return await db.presentationFiles.where('binId').equals(binId).toArray();
  }
};
