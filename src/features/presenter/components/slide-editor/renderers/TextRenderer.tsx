import React from 'react';
import { ICanvasItem, IStyleLayer } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { sanitizeHtml } from '@/core/utils/sanitizeHtml';
import { getComputedColor } from '@/core/utils/blendEngine';
import { mediaCache } from '@/core/utils/mediaCache';
import { needsFauxBold } from '@/core/services/fontService';

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
  idPrefix,
}) => {
  if (!item.text) return null;

  const isAutoWidthText = item.text.resizingMode === 'auto-width';
  const isAutoHeightText = item.text.resizingMode === 'auto-height';
  const isFlowText = isAutoWidthText || isAutoHeightText;

  const fills = React.useMemo(() => {
    const rawFills = item.text?.textFills || [];
    if (rawFills.length > 0) return rawFills;
    if (item.text?.color) {
      return [{
        id: `legacy-color-${item.id}`,
        type: 'color',
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        color: item.text.color,
        adjustments: { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, hue: 0, blur: 0 }
      } as IStyleLayer];
    }
    return [];
  }, [item.text?.textFills, item.text?.color, item.id]);

  const textStrokes = React.useMemo(() => {
    return item.text?.textStrokes?.filter(s => s.visible !== false) || [];
  }, [item.text?.textStrokes]);

  const hasRichMedia = React.useMemo(() => fills.some(f => f.type !== 'color'), [fills]);
  const isRichTextFill = fills.length > 0 && hasRichMedia;
  const hasTextStrokes = textStrokes.length > 0;

  const finalColor = React.useMemo(() => {
    if (isRichTextFill || fills.length === 0) return 'transparent';
    return getComputedColor(fills, 'transparent');
  }, [fills, isRichTextFill]);

  // Robust Async CSS Mapping for Webkit clipping
  const [dynamicCSS, setDynamicCSS] = React.useState<React.CSSProperties | null>(null);

  React.useEffect(() => {
    let active = true;

    const compileBackgroundStyles = async () => {
      if (!hasRichMedia) {
        if (active) setDynamicCSS(null);
        return;
      }

      const bgImages: string[] = [];
      const bgBlendModes: string[] = [];
      const bgSizes: string[] = [];
      const bgPositions: string[] = [];

      // Build layer by layer from Bottom to Top (since array is Top-First, we must reverse?)
      // Actually CSS multiple backgrounds stack from first (top) to last (bottom). So Top-First is perfect!
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

          // Resolve stable blobs using mediaCache
          const isRemote = !window.electron?.ipcRenderer;
          let dbUrl: string | null = null;
          
          if (!isRemote && layer.image.isFromDb && layer.image.id) {
            try {
               const cachedUrl = await mediaCache.getBackgroundUrl(layer.image.id);
               if (cachedUrl) dbUrl = cachedUrl;
            } catch (e) {
               console.error("Failed caching text background layer", e);
            }
          }

          // Fallback logic for Remote Controllers identical to SlideBackground
          const displayUrl = (isRemote && resolvedUrl && !resolvedUrl.startsWith('blob:')) 
              ? resolvedUrl 
              : (dbUrl || (resolvedUrl && !resolvedUrl.startsWith('blob:') ? resolvedUrl : null));

          // Guard against literal "null" strings overriding fetch results
          if (displayUrl && String(displayUrl).toLowerCase() !== 'null') {
            let imgToken = `url("${displayUrl}")`;
            if (opacity < 1) {
               // Fake opacity via cross-fade on webkit
               imgToken = `cross-fade(transparent ${(1 - opacity) * 100}%, url("${displayUrl}") ${opacity * 100}%)`;
            }
            bgImages.push(imgToken);
            bgBlendModes.push(blendMode);
            bgSizes.push('cover');
            bgPositions.push('center center');
          }
        } 
        else if (layer.type === 'video') {
          // Native CSS Background does not support video rendering. 
          // Advanced presentation apps handle this differently, skipping gracefully.
          console.warn('[TextRenderer] HTML Video masks are visually stubbed in text layers pending Canvas engine upgrades.');
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
  }, [fills, hasRichMedia]);

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

  // Faux bold support matching InlineTextEditor
  const isFauxBold = needsFauxBold(item.text.isBold, activeFontWeight);
  if (isFauxBold) {
    const shadowSize = Math.max(0.3, fittedFontSize * 0.015);
    commonTextStyle.textShadow = `0 0 ${shadowSize}px currentColor`;
    commonTextStyle.WebkitTextFillColor = 'currentColor'; // Ensure shadow color matches
    commonTextStyle.paintOrder = 'stroke fill';
  }



  const listClasses = cn(
    '[&_ul]:list-inside [&_ol]:list-inside [&_ul]:pl-2 [&_ol]:pl-2',
    item.text.listType === 'circle' ? '[&_ul]:list-[circle]' :
    item.text.listType === 'square' ? '[&_ul]:list-[square]' :
    '[&_ul]:list-disc',
    item.text.listType === 'lower-alpha' ? '[&_ol]:list-[lower-alpha]' :
    item.text.listType === 'upper-alpha' ? '[&_ol]:list-[upper-alpha]' :
    item.text.listType === 'lower-roman' ? '[&_ol]:list-[lower-roman]' :
    item.text.listType === 'upper-roman' ? '[&_ol]:list-[upper-roman]' :
    '[&_ol]:list-decimal'
  );
  const sanitizedContent = sanitizeHtml(item.text.content);
  const filteredStrokes = textStrokes.filter(s => s.visible !== false);

  let computedTextStyles = { 
    ...commonTextStyle,
    '--list-style': item.text.listType === 'circle' ? 'circle' :
                  item.text.listType === 'square' ? 'square' :
                  item.text.listType === 'lower-alpha' ? 'lower-alpha' :
                  item.text.listType === 'upper-alpha' ? 'upper-alpha' :
                  item.text.listType === 'lower-roman' ? 'lower-roman' :
                  item.text.listType === 'upper-roman' ? 'upper-roman' :
                  item.text.listType === 'decimal' ? 'decimal' : 'disc'
  } as any;
  
  if (isRichTextFill && dynamicCSS) {
     computedTextStyles = { ...computedTextStyles, ...dynamicCSS } as any;
  } else {
     computedTextStyles.color = finalColor;
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative flex flex-col", isFlowText ? (isAutoHeightText ? 'w-full' : '') : 'w-full h-full')}
      style={{
        justifyContent: alignItemsCss,
        height: isFlowText ? undefined : '100%',
        opacity: isEditing ? 0 : 1,
        isolation: 'isolate',
        overflow: 'visible',
      }}
    >
      <div className="relative w-full" style={{ overflow: 'visible' }}>
        {/* Stroke Layers pinned exactly to the text bounding height */}
        {hasTextStrokes && filteredStrokes.slice().reverse().map((stroke, idx) => {
          const baseWidth = stroke.width || item.borderWidth || 2;
          
          return (
             <div 
                key={stroke.id || idx}
                className={cn(isAutoWidthText ? '' : 'w-full', 'absolute inset-0 pointer-events-none stroke-layer-content')}
                style={{
                  ...computedTextStyles,
                  color: 'transparent',
                  WebkitTextFillColor: 'transparent',
                  WebkitTextStroke: `${baseWidth}px ${stroke.color || '#000000'}`,
                  paintOrder: 'fill stroke',
                  opacity: stroke.opacity ?? 1,
                  mixBlendMode: (stroke.blendMode || 'normal') as any,
                  zIndex: 0
                }}
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
             />
          );
        })}

        {/* Main Text Layer */}
        <div
          className={cn(isAutoWidthText ? '' : 'w-full', 'relative z-10', isRichTextFill ? 'rich-media-text-fill' : '')}
          style={computedTextStyles}
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />

        {/* Strict override to force all dangerouslySet innerHTML spans to respect standard webkit transparency rendering */}
        <style dangerouslySetInnerHTML={{ __html: `
          .stroke-layer-content * { 
            color: transparent !important; 
            -webkit-text-fill-color: transparent !important; 
            text-decoration: none !important; /* Hide underlines on stroke layers to prevent duplicate wavy lines */
          }
          .stroke-layer-content *::marker {
            color: transparent !important; /* Hide markers on stroke layers to prevent duplicate bullets */
          }
          ${isRichTextFill ? '.rich-media-text-fill * { color: transparent !important; -webkit-text-fill-color: transparent !important; }' : ''}
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
            color: ${isRichTextFill ? 'white' : 'inherit'} !important; 
            -webkit-text-fill-color: ${isRichTextFill ? 'white' : 'inherit'} !important;
          }
        ` }} />
      </div>
    </div>
  );
};
