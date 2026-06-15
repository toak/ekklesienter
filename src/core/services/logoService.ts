import { db } from '@/core/db';
import { ILogoEntry } from '@/core/types';

/**
 * Service for managing logo persistence in IndexedDB.
 * Centralizes all logo CRUD operations to keep UI hooks lean.
 */
export const logoService = {
    /**
     * Saves a logo entry (image blob + metadata) to the logos table.
     * Uses `put` for upsert semantics.
     */
    async saveLogo(entry: ILogoEntry): Promise<string> {
        await db.logos.put(entry);
        return entry.id;
    },

    /**
     * Retrieves a logo entry by ID.
     */
    async getLogo(id: string): Promise<ILogoEntry | undefined> {
        return await db.logos.get(id);
    },

    /**
     * Deletes a logo entry by ID.
     */
    async deleteLogo(id: string): Promise<void> {
        await db.logos.delete(id);
    },

    /**
     * Returns all logo entries.
     */
    async getAllLogos(): Promise<ILogoEntry[]> {
        return await db.logos.toArray();
    }
};

/** @deprecated Use logoService instead. */
export const LogoService = logoService;
