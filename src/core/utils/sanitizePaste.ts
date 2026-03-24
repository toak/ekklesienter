/**
 * Safely sanitizes pasted HTML for Figma-like WYSIWYG editor behavior.
 * Retains inline character styles (bold, italic, font-size, color) but completely
 * strips layout/block-level tags (div, p, table, etc.), replacing them with simple line breaks.
 */
export const sanitizePasteHtml = (html: string): string => {
    if (!html) return html;

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="root">${html}</div>`, 'text/html');
    const root = doc.getElementById('root');
    if (!root) return html;

    // 1. Defensively remove dangerous or purely layout elements
    const removeSelectors = ['script', 'style', 'object', 'embed', 'svg', 'canvas', 'img', 'iframe', 'meta', 'link'];
    removeSelectors.forEach(sel => {
        const els = root.querySelectorAll(sel);
        els.forEach(el => el.remove());
    });

    const allowedTags = new Set(['SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'A', 'BR']);
    const blockTags = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'BLOCKQUOTE', 'UL', 'OL', 'TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TD', 'TH']);
    const allowedStyles = new Set(['color', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration']);

    const processElement = (el: HTMLElement) => {
        // Post-order traversal: process children first so we don't mess up reference when unwrapping
        const children = Array.from(el.childNodes);
        children.forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
                processElement(child as HTMLElement);
            }
        });

        // Don't unwrap the root element
        if (el.id === 'root') return;

        const tag = el.tagName.toUpperCase();

        if (blockTags.has(tag)) {
            // It's a block tag. We preserve its separation intent by appending a <br>
            // ONLY if it has some text/content OR if it's explicitly spacing content.
            if (el.textContent?.trim() !== '') {
                const br = document.createElement('br');
                if (el.parentNode) {
                    el.after(br);
                }
            }
            unwrapElement(el);
        } else if (!allowedTags.has(tag)) {
            // Not a block, not allowed. Unwrap it (keep text, strip the tag).
            unwrapElement(el);
        } else {
            // It is an allowed tag (e.g. SPAN, B, BR)
            
            // 1. Maintain only style & href attributes
            const attrs = Array.from(el.attributes);
            attrs.forEach(attr => {
                const isStyle = attr.name === 'style';
                const isHref = tag === 'A' && attr.name === 'href';
                if (!isStyle && !isHref) {
                    el.removeAttribute(attr.name);
                }
            });

            // 2. Filter inline styles to ONLY our allowed list
            if (el.hasAttribute('style')) {
                const newStyles: string[] = [];
                // el.style is a CSSStyleDeclaration
                for (let i = 0; i < el.style.length; i++) {
                    const prop = el.style[i];
                    if (allowedStyles.has(prop)) {
                        newStyles.push(`${prop}: ${el.style.getPropertyValue(prop)}`);
                    }
                }
                
                if (newStyles.length > 0) {
                    el.setAttribute('style', newStyles.join('; '));
                } else {
                    el.removeAttribute('style');
                }
            }

            // 3. If a SPAN ended up empty of styles, unwrap it to keep DOM clean
            if (tag === 'SPAN' && !el.hasAttribute('style')) {
                unwrapElement(el);
            }
        }
    };

    const unwrapElement = (el: HTMLElement) => {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
    };

    processElement(root);

    // Clean up any double or trailing <br> tags at the very end
    let result = root.innerHTML;
    // Replace multiple BRs at the very end with nothing
    result = result.replace(/(<br\s*\/?>)+$/i, '');

    return result;
};
