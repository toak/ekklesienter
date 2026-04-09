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
            case 'scriptStyle':
                if (value === 'subscript') document.execCommand('subscript', false);
                else if (value === 'superscript') document.execCommand('superscript', false);
                else {
                    document.execCommand('subscript', false); // toggle off
                    document.execCommand('superscript', false); // toggle off
                }
                break;
            case 'textCase':
                applyCustomStyle({ textTransform: value === 'none' ? 'none' : value === 'titlecase' ? 'capitalize' : value });
                break;
            case 'underlineStyle':
                applyCustomStyle({ textDecorationStyle: value });
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

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        const content = e.currentTarget.innerHTML;
        onInput?.(item.id, content);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSave(item.id, normalizeHtml(editorRef.current?.innerHTML || ''));
            return;
        }

        // Chrome adds <div><br></div> which breaks layouts. Force <br> insertion.
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const br = document.createElement('br');
                range.insertNode(br);
                range.setStartAfter(br);
                range.setEndAfter(br);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            return;
        }
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

    const vAlignCss = (textData.alignVertical || 'middle') === 'top' ? 'flex-start'
        : (textData.alignVertical || 'middle') === 'bottom' ? 'flex-end' : 'center';

    return (
        <div
            className={cn(
                isFlowMode ? (isAutoHeight ? 'w-full relative' : 'relative') : 'w-full h-full relative',
                "flex flex-col"
            )}
            style={{
                justifyContent: vAlignCss,
                height: isFlowMode ? undefined : '100%',
                pointerEvents: 'none',
            }}
        >
            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className={cn(
                    isAutoWidth ? '' : 'w-full',
                    "bg-transparent border-none outline-none p-0 m-0 relative",
                    "caret-accent pointer-events-auto",
                    "[&_ul]:list-disc [&_ul]:list-inside [&_ol]:list-decimal [&_ol]:list-inside [&_ul]:pl-2 [&_ol]:pl-2",
                )}
                style={{
                    fontFamily: activeFontFamily,
                    fontSize: `${fittedFontSize}px`,
                    fontWeight: activeFontWeight,
                    // If rich fill is behind, we make text transparent so user sees the fill but still has a cursor
                    color: isRichFill ? 'transparent' : textData.color,
                    textAlign: (textData.alignHorizontal || textData.textAlign || 'center') as React.CSSProperties['textAlign'],
                    lineHeight: textData.lineHeight || 1.3,
                    letterSpacing: typeof textData.letterSpacing === 'number' && textData.letterSpacing !== 0
                        ? `${textData.letterSpacing}px` : undefined,
                    fontStyle: textData.isItalic ? 'italic' : 'normal',
                    textDecorationLine: [textData.isStrikethrough ? 'line-through' : '', textData.isUnderline ? 'underline' : ''].filter(Boolean).join(' ') || 'none',
                    textDecorationStyle: textData.underlineStyle === 'wavy' ? 'wavy' : 'solid',
                    textDecorationSkipInk: textData.underlineSkipInk === 'none' ? 'none' : 'auto',
                    textTransform: textData.textCase === 'uppercase' ? 'uppercase' : textData.textCase === 'lowercase' ? 'lowercase' : textData.textCase === 'titlecase' ? 'capitalize' : 'none',
                    whiteSpace: resizingMode === 'auto-width' ? 'pre' : 'pre-wrap',
                    wordBreak: resizingMode === 'auto-width' ? 'normal' : 'break-word',
                    overflowWrap: 'break-word',
                    overflowX: 'visible',
                    overflowY: 'visible',
                    // Faux bold
                    ...(needsFauxBold(textData.isBold, activeFontWeight) ? {
                        textShadow: `0 0 ${Math.max(0.3, fittedFontSize * 0.015)}px currentColor`,
                        paintOrder: 'stroke fill' as React.CSSProperties['paintOrder'],
                    } : {}),
                    // Paragraph spacing
                    ...(textData.paragraphSpacing ? { paddingBottom: `${textData.paragraphSpacing}px` } : {}),
                    minWidth: '1px',
                    minHeight: '1px',
                }}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onBlur={handleBlur}
                onMouseDown={(e) => e.stopPropagation()}
            />
        </div>
    );
};

export default InlineTextEditor;
