import React, { useEffect, useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { ICanvasItem } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { ensureLayers } from '@/core/utils/styleMigration';
import { needsFauxBold } from '@/core/services/fontService';
import { stripInlineStyles } from '@/core/utils/stripInlineStyles';
import { sanitizePasteHtml } from '@/core/utils/sanitizePaste';
import { useTextFit } from '@/features/presenter/hooks/useTextFit';
import { textCommandAtom, fontPreviewFamilyAtom, fontPreviewWeightAtom } from '@/core/store/uiAtoms';
import { normalizeHtml } from '@/features/presenter/utils/normalizeContentEditableHtml';
import { getComputedColor } from '@/core/utils/blendEngine';
import { mediaCache } from '@/core/utils/mediaCache';
import { IStyleLayer } from '@/core/types/style';

interface InlineTextEditorProps {
    item: ICanvasItem;
    fittedFontSize: number;
    activeFontFamily: string;
    activeFontWeight: string | number;
    onSave: (id: string, newContent: string) => void;
    onInput?: (id: string, newContent: string) => void;
    onCancel: () => void;
}

/**
 * A contenteditable div that allows direct editing 
 * of a text layer while matching its slide design properties exactly.
 * Matches the layout of the static div to prevent "jumping".
 */
const InlineTextEditor: React.FC<InlineTextEditorProps> = ({ 
    item, 
    fittedFontSize,
    activeFontFamily,
    activeFontWeight,
    onSave, 
    onInput, 
    onCancel 
}) => {
    const textData = item.text;
    if (!textData) return null;

    const editorRef = useRef<HTMLDivElement>(null);
    const fills = ensureLayers(textData.textFills);
    const isRichFill = fills.length > 0 && (fills.length > 1 || fills[0].type !== 'color');
    const resizingMode = textData.resizingMode || 'auto-height';
    const isAutoWidth = resizingMode === 'auto-width';
    const isAutoHeight = resizingMode === 'auto-height';
    const isFlowMode = isAutoWidth || isAutoHeight;

    const isShiftPressed = useRef(false);

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') isShiftPressed.current = true;
        };
        const handleGlobalKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') isShiftPressed.current = false;
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('keyup', handleGlobalKeyUp);
        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
            window.removeEventListener('keyup', handleGlobalKeyUp);
        };
    }, []);

    // --- Synchronized CSS Logic from TextRenderer ---
    const [dynamicCSS, setDynamicCSS] = React.useState<React.CSSProperties | null>(null);

    useEffect(() => {
        let active = true;

        const compileBackgroundStyles = async () => {
            const hasRichMedia = fills.some(f => f.type !== 'color');
            if (!hasRichMedia) {
                if (active) setDynamicCSS(null);
                return;
            }

            const bgImages: string[] = [];
            const bgBlendModes: string[] = [];
            const bgSizes: string[] = [];
            const bgPositions: string[] = [];

            for (const layer of fills) {
                if (layer.visible === false) continue;

                const opacity = layer.opacity ?? 1;
                const blendMode = layer.blendMode || 'normal';

                if (layer.type === 'color' && layer.color) {
                    let alphaHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
                    let baseHex = layer.color.length === 9 ? layer.color.substring(0, 7) : layer.color.padEnd(7, '0');
                    let finalOutputColor = baseHex + alphaHex;
                    
                    bgImages.push(`linear-gradient(${finalOutputColor}, ${finalOutputColor})`);
                    bgBlendModes.push(blendMode);
                    bgSizes.push('100% 100%');
                    bgPositions.push('left top');
                } 
                else if (layer.type === 'image' && layer.image) {
                    let resolvedUrl = layer.image.url;
                    const isRemote = !window.electron?.ipcRenderer;
                    let dbUrl: string | null = null;
                    
                    if (!isRemote && layer.image.isFromDb && layer.image.id) {
                        try {
                            const cachedUrl = await mediaCache.getBackgroundUrl(layer.image.id);
                            if (cachedUrl) dbUrl = cachedUrl;
                        } catch (e) {
                            console.error("Failed caching text editor background layer", e);
                        }
                    }

                    const displayUrl = (isRemote && resolvedUrl && !resolvedUrl.startsWith('blob:')) 
                        ? resolvedUrl 
                        : (dbUrl || (resolvedUrl && !resolvedUrl.startsWith('blob:') ? resolvedUrl : null));

                    if (displayUrl && String(displayUrl).toLowerCase() !== 'null') {
                        let imgToken = `url("${displayUrl}")`;
                        if (opacity < 1) {
                            imgToken = `cross-fade(transparent ${(1 - opacity) * 100}%, url("${displayUrl}") ${opacity * 100}%)`;
                        }
                        bgImages.push(imgToken);
                        bgBlendModes.push(blendMode);
                        bgSizes.push('cover');
                        bgPositions.push('center center');
                    }
                }
            }

            if (!active) return;

            if (bgImages.length > 0) {
                setDynamicCSS({
                    backgroundImage: bgImages.join(', '),
                    backgroundBlendMode: bgBlendModes.join(', '),
                    backgroundSize: bgSizes.join(', '),
                    backgroundPosition: bgPositions.join(', '),
                    backgroundRepeat: 'no-repeat',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                });
            } else {
                setDynamicCSS(null);
            }
        };

        compileBackgroundStyles();
        return () => { active = false; };
    }, [fills]);

    const finalColor = React.useMemo(() => {
        if (isRichFill || fills.length === 0) return 'transparent';
        return getComputedColor(fills, textData.color || 'white');
    }, [fills, isRichFill, textData.color]);

    // Initialize content and auto-focus
    useEffect(() => {
        if (editorRef.current) {
            // Set initial content only if it's different and we are starting fresh for this item
            // This prevents React from overwriting the content on every keystroke
            if (editorRef.current.innerHTML !== textData.content) {
                editorRef.current.innerHTML = textData.content;
            }

            editorRef.current.focus();

            // Move cursor to end
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(editorRef.current);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
        }
    }, [item.id]);

    const textCommand = useAtomValue(textCommandAtom);

    // Command listener
    useEffect(() => {
        if (!textCommand || !editorRef.current) return;

        // Ensure we are focused before applying command
        editorRef.current.focus();

        const { command, value } = textCommand;

        switch (command) {
            case 'bold':
                document.execCommand('bold', false);
                break;
            case 'italic':
                document.execCommand('italic', false);
                break;
            case 'underline':
                document.execCommand('underline', false);
                break;
            case 'strikethrough':
                document.execCommand('strikeThrough', false);
                break;
            case 'foreColor':
                document.execCommand('foreColor', false, value);
                break;
            case 'fontName':
                // Character-level: wrap selected text with font-family style
                if (window.getSelection()?.isCollapsed === false) {
                    applyCustomStyle({ fontFamily: value });
                }
                break;
            case 'fontSize':
                // Character-level: wrap selected text with font-size style using 'em' so it scales properly
                if (window.getSelection()?.isCollapsed === false) {
                    const baseSize = typeof item.text?.fontSize === 'number' ? item.text.fontSize : 32;
                    // value comes in as e.g. "40px" or "40". Extract the number.
                    const newSizePx = parseFloat(value);
                    if (!isNaN(newSizePx) && baseSize > 0) {
                        const emValue = (newSizePx / baseSize).toFixed(3);
                        applyCustomStyle({ fontSize: `${emValue}em` });
                    }
                }
                break;
            case 'undo':
                document.execCommand('undo', false);
                break;
            case 'redo':
                document.execCommand('redo', false);
                break;
            case 'textCase':
                applyCustomStyle({ textTransform: value === 'none' ? 'none' : value === 'titlecase' ? 'capitalize' : value });
                break;
            case 'fontWeight':
                applyCustomStyle({ fontWeight: value });
                break;
            case 'letterSpacing':
                applyCustomStyle({ letterSpacing: value });
                break;
            case 'lineHeight':
                applyCustomStyle({ lineHeight: value });
                break;
            case 'paragraphSpacing':
                applyCustomStyle({ marginBottom: value });
                break;
            case 'listType': {
                const isUnordered = document.queryCommandState('insertUnorderedList');
                const isOrdered = document.queryCommandState('insertOrderedList');

                if (value === 'disc' || value === 'circle' || value === 'square') {
                    if (isOrdered) document.execCommand('insertOrderedList', false); // Turn off ordered first
                    if (!isUnordered) document.execCommand('insertUnorderedList', false);
                } else if (value === 'decimal' || value === 'lower-alpha' || value === 'upper-alpha') {
                    if (isUnordered) document.execCommand('insertUnorderedList', false); // Turn off unordered first
                    if (!isOrdered) document.execCommand('insertOrderedList', false);
                } else {
                    // Toggle off any active list explicitly
                    if (isUnordered) document.execCommand('insertUnorderedList', false);
                    if (isOrdered) document.execCommand('insertOrderedList', false);
                }
                break;
            }
        }

        // Trigger input event manually since execCommand doesn't always fire it
        const event = new Event('input', { bubbles: true });
        editorRef.current.dispatchEvent(event);
    }, [textCommand]);

    const applyCustomStyle = (styles: Record<string, string>) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        Object.assign(span.style, styles);

        try {
            // Surround content with span
            span.appendChild(range.extractContents());
            range.insertNode(span);

            // Re-select the new span content
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.removeAllRanges();
            selection.addRange(newRange);
        } catch (e) {
            console.error('Failed to apply custom style:', e);
        }
    };

    const textStrokes = React.useMemo(() => {
        return textData.textStrokes?.filter(s => s.visible !== false) || [];
    }, [textData.textStrokes]);

    const hasTextStrokes = textStrokes.length > 0;
    const globalStrokeJoin = item.strokeJoin || 'round';
    const globalStrokeDash = item.strokeDashArray;
    const globalAlign = item.strokeAlign || 'center';

    const [currentContent, setCurrentContent] = React.useState(textData.content);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        const content = e.currentTarget.innerHTML;
        setCurrentContent(content); // Sync stroke layers
        onInput?.(item.id, content);
    };

    const vAlignCss = (textData.alignVertical || 'middle') === 'top' ? 'flex-start'
        : (textData.alignVertical || 'middle') === 'bottom' ? 'flex-end' : 'center';

    const listClasses = cn(
        '[&_ul]:list-inside [&_ol]:list-inside [&_ul]:pl-2 [&_ol]:pl-2',
        textData.listType === 'circle' ? '[&_ul]:list-[circle]' :
        textData.listType === 'square' ? '[&_ul]:list-[square]' :
        '[&_ul]:list-disc',
        textData.listType === 'decimal' ? '[&_ol]:list-decimal' :
        textData.listType === 'lower-alpha' ? '[&_ol]:list-[lower-alpha]' :
        textData.listType === 'upper-alpha' ? '[&_ol]:list-[upper-alpha]' :
        textData.listType === 'lower-roman' ? '[&_ol]:list-[lower-roman]' :
        textData.listType === 'upper-roman' ? '[&_ol]:list-[upper-roman]' :
        '[&_ol]:list-decimal'
    );

    const commonTextStyle: React.CSSProperties = {
        fontFamily: activeFontFamily,
        fontSize: `${fittedFontSize}px`,
        fontWeight: activeFontWeight,
        textAlign: (textData.alignHorizontal || textData.textAlign || 'center') as React.CSSProperties['textAlign'],
        lineHeight: textData.lineHeight || 1.3,
        letterSpacing: typeof textData.letterSpacing === 'number' 
            ? `${textData.letterSpacing}px` 
            : (parseFloat(textData.letterSpacing as string) || 0) + 'px',
        fontStyle: textData.isItalic ? 'italic' : 'normal',
        textDecorationLine: [textData.isStrikethrough ? 'line-through' : '', textData.isUnderline ? 'underline' : ''].filter(Boolean).join(' ') || 'none',
        textTransform: textData.textCase === 'uppercase' ? 'uppercase' : textData.textCase === 'lowercase' ? 'lowercase' : textData.textCase === 'titlecase' ? 'capitalize' : 'none',
        whiteSpace: resizingMode === 'auto-width' ? 'pre' : 'pre-wrap',
        wordBreak: resizingMode === 'auto-width' ? 'normal' : 'break-word',
        '--list-style': textData.listType === 'circle' ? 'circle' :
                      textData.listType === 'square' ? 'square' :
                      textData.listType === 'lower-alpha' ? 'lower-alpha' :
                      textData.listType === 'upper-alpha' ? 'upper-alpha' :
                      textData.listType === 'lower-roman' ? 'lower-roman' :
                      textData.listType === 'upper-roman' ? 'upper-roman' :
                      textData.listType === 'decimal' ? 'decimal' : 'disc'
    } as any;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSave(item.id, normalizeHtml(editorRef.current?.innerHTML || ''));
            return;
        }

        // Disable Chrome's default wrapping with <div> if possible, but let contentEditable handle basic newlines
        // Setting defaultParagraphSeparator to 'div' or 'p' usually fixes double enter.
        // Actually, we'll let the native browser behavior work without intercepting Enter
        // unless it's Mod+Enter to save.
        
        if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
        // Handle Clear Formatting: cmd/ctrl + alt/option + shift + c
        if (e.key.toLowerCase() === 'c' && (e.metaKey || e.ctrlKey) && e.altKey && e.shiftKey) {
            e.preventDefault();
            if (editorRef.current) {
                // Keep only line breaks
                const textWithBreaks = editorRef.current.innerHTML
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/\n/g, '<br>');

                editorRef.current.innerHTML = textWithBreaks;
                document.execCommand('removeFormat', false);

                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);
            }
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault(); // Prevent default paste

        const isPlainTextOnly = isShiftPressed.current;
        const htmlData = e.clipboardData.getData('text/html');

        if (isPlainTextOnly || !htmlData) {
            // Paste pure plain text
            const textData = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, textData);
            return;
        }

        // Paste sanitized HTML
        const sanitizedHtml = sanitizePasteHtml(htmlData);
        document.execCommand('insertHTML', false, sanitizedHtml);
    };

    const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
        // If we click inside the SlideDesignPanel (color picker, font size), DO NOT close the editor
        if (e.relatedTarget instanceof Element) {
            const isClickInsidePanel = e.relatedTarget.closest('[data-slide-design-panel="true"]');
            if (isClickInsidePanel) return;
        }

        onSave(item.id, normalizeHtml(editorRef.current?.innerHTML || ''));
    };

    const filteredStrokes = textStrokes.filter(s => s.visible !== false);

    return (
        <div
            className={cn(
                isFlowMode ? (isAutoHeight ? 'w-full relative' : 'relative') : 'w-full h-full relative',
                "flex flex-col overflow-visible"
            )}
            style={{
                justifyContent: vAlignCss,
                height: isFlowMode ? undefined : '100%',
                pointerEvents: 'none',
            }}
        >
            <div className="relative w-full" style={{ overflow: 'visible' }}>
                {/* Stroke Layers pinned exactly to the editable text bounding height */}
                {hasTextStrokes && filteredStrokes.slice().reverse().map((stroke, idx) => {
                    const baseWidth = stroke.width || item.borderWidth || 2;
                    
                    return (
                        <div 
                            key={stroke.id || idx}
                            className={cn(
                                isAutoWidth ? '' : 'w-full',
                                "absolute inset-0 pointer-events-none stroke-layer-content"
                            )}
                                style={{
                                    ...commonTextStyle,
                                    textDecorationSkipInk: 'auto',
                                    overflowWrap: 'break-word',
                                overflowX: 'visible',
                                overflowY: 'visible',
                                minWidth: '1px',
                                minHeight: '1px',
                                // Stroke specifics
                                color: 'transparent',
                                WebkitTextFillColor: 'transparent',
                                WebkitTextStroke: `${baseWidth}px ${stroke.color || '#000000'}`,
                                paintOrder: 'fill stroke',
                                opacity: stroke.opacity ?? 1,
                                mixBlendMode: (stroke.blendMode || 'normal') as any,
                                zIndex: 0
                            }}
                            dangerouslySetInnerHTML={{ __html: currentContent }}
                        />
                    );
                })}

                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className={cn(
                        isAutoWidth ? '' : 'w-full',
                        "bg-transparent border-none outline-none p-0 m-0 relative",
                        "caret-accent pointer-events-auto z-10",
                        isRichFill ? 'rich-media-text-fill' : ''
                    )}
                    style={{
                        ...commonTextStyle,
                        textDecorationSkipInk: 'auto',
                        overflowWrap: 'break-word',
                        overflowX: 'visible',
                        overflowY: 'visible',
                        // Faux bold
                        ...(needsFauxBold(textData.isBold, activeFontWeight) ? {
                            textShadow: `0 0 ${Math.max(0.3, fittedFontSize * 0.015)}px currentColor`,
                            WebkitTextFillColor: 'currentColor',
                            paintOrder: 'stroke fill' as React.CSSProperties['paintOrder'],
                        } : {}),
                        // Paragraph spacing
                        ...(textData.paragraphSpacing ? { paddingBottom: `${textData.paragraphSpacing}px` } : {}),
                        // Merge Rich Fill styles
                        ...(isRichFill && dynamicCSS ? dynamicCSS : { color: finalColor }),
                        minWidth: '1px',
                        minHeight: '1px',
                    }}
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onBlur={handleBlur}
                    onMouseDown={(e) => e.stopPropagation()}
                />

                {/* Force child elements to respect rich media fill transparency while editing */}
                <style dangerouslySetInnerHTML={{ __html: `
                    .stroke-layer-content * { 
                        color: transparent !important; 
                        -webkit-text-fill-color: transparent !important; 
                        text-decoration: none !important;
                    }
                    .stroke-layer-content *::marker {
                        color: transparent !important; 
                    }
                    ${isRichFill ? '.rich-media-text-fill * { color: transparent !important; -webkit-text-fill-color: transparent !important; }' : ''}
                    ul, ol { 
                        margin-top: 0.5em !important; 
                        margin-bottom: 0.5em !important; 
                        padding-left: 1.5em !important; 
                        list-style-position: outside !important;
                        display: block !important;
                    }
                    ul { list-style-type: var(--list-style, disc) !important; }
                    ol { list-style-type: var(--list-style, decimal) !important; }
                    li { margin-bottom: 0.2em !important; display: list-item !important; }
                    li::marker { 
                        /* Ensure list markers are visible even when using background-clip: text */
                        color: ${isRichFill ? 'white' : 'inherit'} !important; 
                        -webkit-text-fill-color: ${isRichFill ? 'white' : 'inherit'} !important;
                    }
                ` }} />
            </div>
        </div>
    );
};

export default InlineTextEditor;
