import React from 'react';
import { ICanvasItem, IStyleLayer } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { sanitizeHtml } from '@/core/utils/sanitizeHtml';
import { SlideBackground } from '../../display/SlideBackground';

interface TextRendererProps {
  item: ICanvasItem;
  containerRef: React.RefObject<HTMLDivElement | null>;
  textRef: React.RefObject<HTMLDivElement | null>;
  fittedFontSize: number;
  activeFontFamily: string;
  activeFontWeight: string | number;
  isEditing: boolean;
  idPrefix: string;
}

export const TextRenderer: React.FC<TextRendererProps> = ({
  item,
  containerRef,
  textRef,
  fittedFontSize,
  activeFontFamily,
  activeFontWeight,
  isEditing,
  idPrefix
}) => {
  if (!item.text) return null;

  const isAutoWidthText = item.text.resizingMode === 'auto-width';
  const isAutoHeightText = item.text.resizingMode === 'auto-height';
  const isFlowText = isAutoWidthText || isAutoHeightText;

  const fills = item.text.textFills || [];
  const isRichTextFill = fills.length > 0 && (fills.length > 1 || fills[0].type !== 'color');
  const maskId = `text-mask-${idPrefix}-${item.id}`;

  const hAlign = item.text.alignHorizontal || item.text.textAlign || 'center';
  const textAlignCss = hAlign === 'justify' ? 'justify' : hAlign;
  const vAlign = item.text.alignVertical || 'middle';
  const alignItemsCss = vAlign === 'top' ? 'flex-start' : vAlign === 'bottom' ? 'flex-end' : 'center';

  const commonTextStyle: React.CSSProperties = {
    fontFamily: activeFontFamily,
    fontSize: `${fittedFontSize}px`,
    fontWeight: activeFontWeight,
    lineHeight: item.text.lineHeight || 1.3,
    letterSpacing: typeof item.text.letterSpacing === 'number' ? `${item.text.letterSpacing}px` : (parseFloat(item.text.letterSpacing as string) || 0) + 'px',
    fontStyle: item.text.isItalic ? 'italic' : 'normal',
    textDecorationLine: [
      item.text.isStrikethrough ? 'line-through' : '',
      item.text.isUnderline ? 'underline' : ''
    ].filter(Boolean).join(' ') || 'none',
    textTransform: (item.text.textCase === 'titlecase' ? 'capitalize' : item.text.textCase || 'none') as any,
    textAlign: textAlignCss as any,
    whiteSpace: isAutoWidthText ? 'pre' : 'pre-wrap',
    wordBreak: isAutoWidthText ? 'normal' : 'break-word',
  };

  const sanitizedContent = sanitizeHtml(item.text.content);

  if (!isRichTextFill) {
    return (
      <div
        ref={containerRef}
        className={cn("flex flex-col relative", isFlowText ? (isAutoHeightText ? 'w-full' : '') : 'w-full h-full')}
        style={{
          justifyContent: alignItemsCss,
          height: isFlowText ? undefined : '100%',
          opacity: isEditing ? 0 : 1,
        }}
      >
        <div
          className={cn(isAutoWidthText ? '' : 'w-full', '[&_ul]:list-disc [&_ul]:list-inside [&_ol]:list-decimal [&_ol]:list-inside [&_ul]:pl-2 [&_ol]:pl-2')}
          style={{
            ...commonTextStyle,
            color: item.text.color,
          }}
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      </div>
    );
  }

  // Rich Text Fill (SVG Masking)
  return (
    <div
      ref={containerRef}
      className={cn("relative flex", isFlowText ? (isAutoHeightText ? 'w-full' : '') : 'w-full h-full')}
      style={{
        alignItems: alignItemsCss,
        justifyContent: textAlignCss === 'center' ? 'center' : textAlignCss === 'right' ? 'flex-end' : 'flex-start',
        height: isFlowText ? undefined : '100%',
        opacity: isEditing ? 0 : 1,
      }}
    >
      <div
        style={{
          ...commonTextStyle,
          color: 'transparent',
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse">
            <foreignObject x="0" y="0" width="100%" height="100%">
              <div
                className={cn(isAutoWidthText ? 'w-max' : 'w-full', '[&_ul]:list-disc [&_ul]:list-inside [&_ol]:list-decimal [&_ol]:list-inside [&_ul]:pl-2 [&_ol]:pl-2')}
                style={{
                  ...commonTextStyle,
                  color: 'white',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: alignItemsCss,
                }}
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />
            </foreignObject>
          </mask>
        </defs>
      </svg>
      <div className="w-full h-full" style={{ mask: `url(#${maskId})`, WebkitMask: `url(#${maskId})` }}>
        <SlideBackground background={fills} showOverlay={false} />
      </div>
    </div>
  );
};
