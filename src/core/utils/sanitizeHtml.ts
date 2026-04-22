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
  const allowedStyles = new Set([
     'color', 'background-color', 'font-size', 'font-family', 'font-weight', 'font-style', 
     'text-decoration', 'text-align', 'line-height', 'letter-spacing', 'text-transform',
     'list-style-type', 'list-style-position', 'padding-left', 'margin-left',
     'display'
  ]);
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
          // Process children BEFORE unwrapping to ensure they are cleaned
          Array.from(el.childNodes).forEach(processNode);
          
          while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
          }
          el.remove();
        }
        return;
      }

      // 3. Sanitize attributes (only allow style and href for links)
      const attrs = Array.from(el.attributes);
      attrs.forEach(attr => {
        const attrName = attr.name.toLowerCase();
        if (attrName === 'style') {
          const currentStyles = el.style;
          const newStyles: string[] = [];
          
          // Use a more robust way to capture styles
          allowedStyles.forEach(prop => {
             const value = currentStyles.getPropertyValue(prop);
             if (value) {
                newStyles.push(`${prop}: ${value}`);
             }
          });

          if (newStyles.length > 0) {
            el.setAttribute('style', newStyles.join('; '));
          } else {
            el.removeAttribute('style');
          }
        } else if (tag === 'A' && attrName === 'href') {
          const href = attr.value.toLowerCase();
          if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:')) {
            el.removeAttribute('href');
          }
        } else if (el.id !== 'root') {
          el.removeAttribute(attr.name);
        }
      });

      // Recurse into children
      Array.from(el.childNodes).forEach(processNode);
    }
  };

  processNode(root);

  return root.innerHTML;
};
