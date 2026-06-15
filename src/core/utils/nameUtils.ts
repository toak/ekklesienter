import { db } from '@/core/db';

/**
 * Resolves a unique name for a presentation by appending (1), (2), etc.
 * if the name already exists in IndexedDB.
 */
export async function getUniquePresentationName(name: string): Promise<string> {
    const safeName = name || 'Untitled Presentation';
    const presentations = await db.presentationFiles.toArray();
    const existingNames = new Set(presentations.map(p => (p.name || '').toLowerCase()));

    if (!existingNames.has(safeName.toLowerCase())) {
        return safeName;
    }

    // Strip existing suffix like " (1)" if present
    const match = safeName.match(/^(.*?)\s*\(\d+\)$/);
    const baseName = match ? match[1].trim() : safeName;

    let index = 1;
    while (true) {
        const candidate = `${baseName} (${index})`;
        if (!existingNames.has(candidate.toLowerCase())) {
            return candidate;
        }
        index++;
    }
}

/**
 * Resolves a unique name for a service by appending (1), (2), etc.
 * if the name already exists in IndexedDB.
 */
export async function getUniqueServiceName(name: string): Promise<string> {
    const safeName = name || 'Untitled Service';
    const services = await db.serviceFiles.toArray();
    const existingNames = new Set(services.map(s => (s.name || '').toLowerCase()));

    if (!existingNames.has(safeName.toLowerCase())) {
        return safeName;
    }

    const match = safeName.match(/^(.*?)\s*\(\d+\)$/);
    const baseName = match ? match[1].trim() : safeName;

    let index = 1;
    while (true) {
        const candidate = `${baseName} (${index})`;
        if (!existingNames.has(candidate.toLowerCase())) {
            return candidate;
        }
        index++;
    }
}
