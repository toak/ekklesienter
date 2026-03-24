/**
 * Perform a deep equality check between two values for the purposes of property panels.
 * This replaces JSON.stringify() === JSON.stringify() which is slow and memory intensive.
 */
export function isEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) {
        return false;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key) || !isEqual(a[key], b[key])) {
            return false;
        }
    }

    return true;
}
