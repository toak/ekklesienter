export type BlockStyleProp = 
    | 'color' 
    | 'font-size' 
    | 'font-family' 
    | 'font-weight' 
    | 'font-style' 
    | 'text-decoration' 
    | 'letter-spacing' 
    | 'line-height' 
    | 'text-transform';

export const BLOCK_STYLE_PROPS: BlockStyleProp[] = [
    'color', 'font-size', 'font-family', 'font-weight', 'font-style', 
    'text-decoration', 'letter-spacing', 'line-height', 'text-transform'
];

/**
 * Normalizes contenteditable HTML to remove unwanted tags (like injected <div>s)
 * and stray whitespace, while preserving valid spans, brs, b, i, u.
 */
export function normalizeHtml(html: string): string {
    if (!html) return '';
    
    // Chromium injects <div><br></div> when pressing enter at the end of a line, or <div>text</div>
    // Replace <div> with <br> and remove </div>
    let normalized = html.replace(/<div[^>]*>/gi, '<br>').replace(/<\/div>/gi, '');
    
    // Clean up `<br><br>` at the start that Chromium sometimes leaves
    if (normalized === '<br>') return '';

    // Remove ghost spans that have no styles or classes
    normalized = normalized.replace(/<span(?!\s)[^>]*>\s*<\/span>/gi, '');

    return normalized;
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
