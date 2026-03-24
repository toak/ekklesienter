/**
 * Safely sanitizes HTML for rendering in the Slide Canvas.
 * Allows basic formatting, lists, and specific inline styles used by the editor.
 * Use this to wrap any content passed to dangerouslySetInnerHTML.
 */
export const sanitizeHtml = (html: string): string => {
  if (!html) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<!DOCTYPE html><html><body><div id="root">${html}</div></body></html>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return '';

  const allowedTags = new Set(['SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'A', 'BR', 'UL', 'OL', 'LI', 'P', 'DIV']);
  const allowedStyles = new Set(['color', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration', 'text-align']);
  const dangerousTags = new Set(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'CANVAS', 'IMG', 'META', 'LINK', 'STYLE', 'BUTTON', 'INPUT', 'FORM', 'TEXTAREA']);

  const processNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) return;

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toUpperCase();

      // 1. Remove dangerous tags
      if (dangerousTags.has(tag)) {
        el.remove();
        return;
      }

      // 2. Remove non-allowed tags while preserving content (unwrap)
      if (!allowedTags.has(tag) && el.id !== 'root') {
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
          }
          el.remove();
        }
        return;
      }

      // 3. Sanitize attributes (only allow style and href for links)
      Array.from(el.attributes).forEach(attr => {
        const attrName = attr.name.toLowerCase();
        if (attrName === 'style') {
          // Filter inline styles
          const currentStyles = el.style;
          const newStyles: string[] = [];
          for (let i = 0; i < currentStyles.length; i++) {
            const prop = currentStyles[i];
            if (allowedStyles.has(prop)) {
              newStyles.push(`${prop}: ${currentStyles.getPropertyValue(prop)}`);
            }
          }
          if (newStyles.length > 0) {
            el.setAttribute('style', newStyles.join('; '));
          } else {
            el.removeAttribute('style');
          }
        } else if (tag === 'A' && attrName === 'href') {
          // Only allow http/https/mailto protocols
          const href = attr.value.toLowerCase();
          if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:')) {
            el.removeAttribute('href');
          }
        } else if (el.id !== 'root') {
          el.removeAttribute(attr.name);
        }
      });

      // Recurse into children (using a static array since removing/unwrapping modifies childNodes)
      Array.from(el.childNodes).forEach(processNode);
    }
  };

  processNode(root);

  return root.innerHTML;
};
