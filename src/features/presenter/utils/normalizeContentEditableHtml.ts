export type BlockStyleProp = 
    | 'color' 
    | 'font-size' 
    | 'font-family' 
    | 'font-weight' 
    | 'font-style' 
    | 'text-decoration' 
    | 'text-decoration-style'
    | 'letter-spacing' 
    | 'line-height' 
    | 'text-transform';

export const BLOCK_STYLE_PROPS: BlockStyleProp[] = [
    'color', 'font-size', 'font-family', 'font-weight', 'font-style', 
    'text-decoration', 'text-decoration-style', 'letter-spacing', 'line-height', 'text-transform'
];

/**
 * Normalizes contenteditable HTML to remove unwanted tags (like injected <div>s)
 * and stray whitespace, while preserving valid spans, brs, b, i, u.
 */
/**
 * Normalizes contenteditable HTML to remove unwanted tags (like injected <div>s)
 * and stray whitespace, while preserving valid spans, brs, b, i, u, lists, and scripts.
 */
export function normalizeHtml(html: string): string {
    if (!html) return '';
    
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<!DOCTYPE html><html><body><div id="root">${html}</div></body></html>`, 'text/html');
        const root = doc.getElementById('root');
        if (!root) return html;

        // 1. Process block elements (div, p) and convert them to line breaks IF they don't contain other blocks like ul/ol
        const blocks = root.querySelectorAll('div, p');
        blocks.forEach(block => {
            if (block.id === 'root') return;
            
            // Check if this block contains any lists
            const hasSpecialTags = block.querySelector('ul, ol, li, table');
            
            if (!hasSpecialTags) {
                // If it's a simple block, prepend a <br> if it's not the first child,
                // and unwrap it.
                if (block.previousSibling && block.previousSibling.nodeName !== 'BR') {
                    const br = doc.createElement('br');
                    block.parentNode?.insertBefore(br, block);
                }
                
                while (block.firstChild) {
                    block.parentNode?.insertBefore(block.firstChild, block);
                }
                block.remove();
            }
        });

        // 2. Clean up redundant line breaks
        let result = root.innerHTML;
        result = result.replace(/(<br\s*\/?>\s*)+/gi, '<br>');
        
        // 3. Remove ghost spans
        result = result.replace(/<span(?!\s)[^>]*>\s*<\/span>/gi, '');

        return result;
    } catch (e) {
        console.error('Normalization failed', e);
        return html;
    }
}

/**
 * Removes a specific inline CSS property from all <span style="..."> tags in the HTML string.
 */
export function stripInlineStyleProp(html: string, prop: BlockStyleProp): string {
    if (!html) return '';

    // We use a temporary DOM document to safely parse and manipulate styles
    if (typeof window !== 'undefined' && window.DOMParser) {
        try {
            const parser = new window.DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            const elementsWithStyle = doc.querySelectorAll('[style]');
            elementsWithStyle.forEach(el => {
                if (el instanceof window.HTMLElement) {
                    el.style.removeProperty(prop);
                    
                    if (!el.getAttribute('style')) {
                        el.removeAttribute('style');
                    }
                }
            });
            
            return doc.body.innerHTML;
        } catch (e) {
            console.error('Failed to strip inline style prop', e);
            return html;
        }
    }
    
    return html;
}
