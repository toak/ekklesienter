import { ICanvasItem, IStyleLayer, ICanvasItemText } from '@/core/types';

/**
 * Normalizes a color string to uppercase hex or rgb.
 */
export const normalizeColor = (color: string): string => {
    if (!color) return '#FFFFFF';
    // If it's rgb/rgba, keep it as is or normalize to one format
    if (color.startsWith('rgb')) return color.toLowerCase();
    if (color.startsWith('#')) return color.toUpperCase();
    return color;
};

/**
 * Extracts unique colors from HTML content string (span styles).
 */
export const extractColorsFromHtml = (html: string): string[] => {
    const colors = new Set<string>();
    // Match color: ...; or color: ..."
    const regex = /color\s*:\s*([^;"]+)/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
        colors.add(normalizeColor(match[1].trim()));
    }
    return Array.from(colors);
};

/**
 * Generates a stable hash for an IStyleLayer to identify unique styles.
 */
export const getStyleHash = (layer: IStyleLayer): string => {
    const parts: string[] = [layer.type];

    if (layer.type === 'color') {
        parts.push(normalizeColor(layer.color || '#FFFFFF'));
    } else if (layer.type === 'gradient') {
        parts.push(layer.gradient?.type || 'linear');
        layer.gradient?.stops?.forEach(stop => {
            parts.push(`${stop.offset}-${normalizeColor(stop.color)}`);
        });
    } else if (layer.type === 'image') {
        parts.push(layer.image?.url || '');
    } else if (layer.type === 'video') {
        parts.push(layer.video?.url || '');
    }

    return parts.join('|');
};

/**
 * Traverses selected items and extracts all unique rich styles.
 */
export const getUniqueSelectionStyles = (
    selectedIds: string[],
    canvasItems: ICanvasItem[]
): IStyleLayer[] => {
    const uniqueStylesMap = new Map<string, IStyleLayer>();
    const selectedItems = canvasItems.filter(item => selectedIds.includes(item.id));

    selectedItems.forEach(item => {
        // 1. Regular Fills
        item.fills?.forEach(fill => {
            if (!fill.visible) return;
            const hash = getStyleHash(fill);
            if (!uniqueStylesMap.has(hash)) {
                uniqueStylesMap.set(hash, fill);
            }
        });

        // 2. Strokes
        item.strokes?.forEach(stroke => {
            if (!stroke.visible) return;
            const hash = getStyleHash(stroke);
            if (!uniqueStylesMap.has(hash)) {
                uniqueStylesMap.set(hash, stroke);
            }
        });

        // 3. Text Fills
        if (item.type === 'text' && item.text) {
            item.text.textFills?.forEach(fill => {
                if (!fill.visible) return;
                const hash = getStyleHash(fill);
                if (!uniqueStylesMap.has(hash)) {
                    uniqueStylesMap.set(hash, fill);
                }
            });

            // If no textFills, but has legacy color, add it
            if ((!item.text.textFills || item.text.textFills.length === 0) && item.text.color) {
                const colorLayer: IStyleLayer = {
                    id: `text-legacy-${item.text.color}`,
                    type: 'color',
                    color: normalizeColor(item.text.color),
                    visible: true,
                    opacity: 1,
                    blendMode: 'normal'
                };
                const hash = getStyleHash(colorLayer);
                if (!uniqueStylesMap.has(hash)) {
                    uniqueStylesMap.set(hash, colorLayer);
                }
            }

            // 4. Character-level colors from HTML
            if (item.text.content) {
                const charColors = extractColorsFromHtml(item.text.content);
                charColors.forEach(color => {
                    const charLayer: IStyleLayer = {
                        id: `char-${color}`,
                        type: 'color',
                        color,
                        visible: true,
                        opacity: 1,
                        blendMode: 'normal'
                    };
                    const hash = getStyleHash(charLayer);
                    if (!uniqueStylesMap.has(hash)) {
                        uniqueStylesMap.set(hash, charLayer);
                    }
                });
            }
        }
    });

    return Array.from(uniqueStylesMap.values()).sort((a, b) => {
        // Sort by hex/color descending if both are colors
        if (a.type === 'color' && b.type === 'color') {
            return (b.color || '').localeCompare(a.color || '');
        }
        // Gradients first, then colors
        const typePriority: Record<string, number> = { gradient: 0, image: 1, video: 2, color: 3 };
        return (typePriority[a.type] || 99) - (typePriority[b.type] || 99);
    });
};
/**
 * Calculates updates for multiple canvas items based on a style transition.
 */
export const calculateStyleUpdates = (
    selectedIds: string[],
    localItems: ICanvasItem[],
    oldLayer: IStyleLayer,
    updates: Partial<IStyleLayer>
): Array<{ id: string; updates: Partial<ICanvasItem> }> => {
    const oldHash = getStyleHash(oldLayer);
    const allUpdates: Array<{ id: string; updates: Partial<ICanvasItem> }> = [];

    selectedIds.forEach(id => {
        const item = localItems.find(i => i.id === id);
        if (!item) return;

        const newItem: Partial<ICanvasItem> = {};
        let changed = false;

        // 1. Update Fills
        if (item.fills) {
            const newFills = item.fills.map(f => {
                if (getStyleHash(f) === oldHash) {
                    changed = true;
                    return { ...f, ...updates };
                }
                return f;
            });
            if (changed) newItem.fills = newFills;
        }

        // 2. Update Strokes
        if (item.strokes) {
            let sc = false;
            const ns = item.strokes.map(s => {
                if (getStyleHash(s) === oldHash) {
                    sc = true;
                    changed = true;
                    return { ...s, ...updates };
                }
                return s;
            });
            if (sc) {
                newItem.strokes = ns;
                changed = true;
            }
        }

        // 3. Update Text Styles
        if (item.type === 'text' && item.text) {
            const tu: Partial<ICanvasItemText> = {};
            let tc = false;

            // 3.1 Text Fills
            if (item.text.textFills) {
                const nf = item.text.textFills.map(f => {
                    if (getStyleHash(f) === oldHash) {
                        tc = true;
                        changed = true;
                        return { ...f, ...updates };
                    }
                    return f;
                });
                if (tc) tu.textFills = nf;
            }

            // 3.2 Legacy Color
            if (oldLayer.type === 'color' && updates.color && item.text.color && 
                normalizeColor(item.text.color) === oldHash.replace('color|', '')) {
                tu.color = updates.color;
                tc = true;
                changed = true;
            }

            // 3.3 HTML Content Color Replacement
            if (oldLayer.type === 'color' && updates.color && oldLayer.color) {
                const oe = oldLayer.color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                let nc = item.text.content || '';
                let cc = false;

                const sr = new RegExp(`(color\\s*:\\s*)${oe}`, 'gi');
                const ar = new RegExp(`(color\\s*=\\s*["']?)${oe}(["']?)`, 'gi');

                if (sr.test(nc)) {
                    nc = nc.replace(sr, `$1${updates.color}`);
                    cc = true;
                }
                if (ar.test(nc)) {
                    nc = nc.replace(ar, `$1${updates.color}$2`);
                    cc = true;
                }

                if (cc) {
                    tu.content = nc;
                    tc = true;
                    changed = true;
                }
            }

            if (tc) {
                newItem.text = { ...item.text, ...tu };
            }
        }

        if (changed) {
            allUpdates.push({ id, updates: newItem });
        }
    });

    return allUpdates;
};
