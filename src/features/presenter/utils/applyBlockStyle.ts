import { ICanvasItem } from '@/core/types';
import { stripInlineStyleProp, BlockStyleProp } from './normalizeContentEditableHtml';

/**
 * Applies block-level text updates to a specific CanvasItem.
 * It removes inline `span` styles of the modified property to enforce the block-level hierarchy.
 */
export function applyBlockStyle(item: ICanvasItem, updates: Partial<ICanvasItem['text']>): Partial<ICanvasItem> {
    if (!item.text) return { text: updates as ICanvasItem['text'] };

    const newText = { ...item.text, ...updates };
    let newContent = newText.content;

    const mapping: Record<string, BlockStyleProp> = {
        color: 'color',
        fontSize: 'font-size',
        fontFamily: 'font-family',
        fontWeight: 'font-weight',
        fontStyle: 'font-style',
        textDecorationLine: 'text-decoration',
        letterSpacing: 'letter-spacing',
        lineHeight: 'line-height',
        textCase: 'text-transform',
    };

    if (newContent) {
        for (const [key] of Object.entries(updates)) {
            const cssProp = mapping[key];
            if (cssProp) {
                newContent = stripInlineStyleProp(newContent, cssProp);
            }
        }
    }

    newText.content = newContent;

    return {
        text: newText,
    };
}
