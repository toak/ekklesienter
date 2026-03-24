import React, { useRef, useId, memo, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { selectedCanvasItemIdsAtom, fontPreviewFamilyAtom, fontPreviewWeightAtom } from '@/core/store/uiAtoms';
import { ICanvasItem } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { ensureLayers } from '@/core/utils/styleMigration';
import { SlideBackground } from '../display/SlideBackground';
import { useTextFit } from '../../hooks/useTextFit';
import { Z_INDEX } from '@/core/constants/zIndex';

import InlineTextEditor from './InlineTextEditor';
import { TextRenderer } from './renderers/TextRenderer';
import { ShapeRenderer } from './renderers/ShapeRenderer';
import { StrokeRenderer } from './renderers/StrokeRenderer';
import { EffectRenderer } from './renderers/EffectRenderer';

interface CanvasItemViewProps {
    item: ICanvasItem;
    isPreview?: boolean;
    isEditing?: boolean;
    onSave?: (id: string, content: string) => void;
    onInput?: (id: string, content: string) => void;
    onCancel?: () => void;
}

/**
 * Renders a single canvas item based on its type.
 * Optimized with React.memo and modular sub-renderers.
 */
const CanvasItemView: React.FC<CanvasItemViewProps> = ({
    item,
    isPreview = false,
    isEditing = false,
    onSave = () => { },
    onInput = () => { },
    onCancel = () => { }
}) => {
    const idPrefix = useId();
    if (!item.visible) return null;

    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);

    // Preview font handling
    const selectedIds = useAtomValue(selectedCanvasItemIdsAtom);
    const previewFontFamily = useAtomValue(fontPreviewFamilyAtom);
    const previewFontWeight = useAtomValue(fontPreviewWeightAtom);
    const isSelected = selectedIds.includes(item.id);
    const rawFontFamily = (isSelected && previewFontFamily) ? previewFontFamily : (item.text?.fontFamily || 'Inter');

    const activeFontFamily = useMemo(() => {
        if (!rawFontFamily) return 'Inter, sans-serif';
        const needsQuotes = rawFontFamily.includes(' ') && !rawFontFamily.includes(',') && !rawFontFamily.startsWith('"');
        const family = needsQuotes ? `"${rawFontFamily}"` : rawFontFamily;
        if (family.includes(',')) return family;

        const lower = rawFontFamily.toLowerCase();
        if (lower.includes('serif')) return `${family}, serif`;
        if (lower.includes('mono')) return `${family}, monospace`;
        return `${family}, sans-serif`;
    }, [rawFontFamily]);

    const activeFontWeight = (isSelected && previewFontWeight) ? previewFontWeight : (item.text?.fontWeight || '400');

    const isText = item.type === 'text' && !!item.text;
    const isAutoHeightText = isText && item.text!.resizingMode === 'auto-height';
    const isFlowText = isText && (item.text!.resizingMode === 'auto-width' || isAutoHeightText);

    const fittedFontSize = useTextFit({
        containerRef,
        textRef,
        resizingMode: isText ? item.text!.resizingMode || 'auto-height' : 'fixed',
        originalFontSize: isText ? item.text!.fontSize : 16,
        content: isText ? item.text!.content : '',
        fontFamily: activeFontFamily,
    });

    const renderContent = () => {
        switch (item.type) {
            case 'text':
                return (
                    <div className={cn("relative", isFlowText ? (isAutoHeightText ? 'w-full' : '') : 'w-full h-full')}>
                        <TextRenderer
                            item={item}
                            containerRef={containerRef}
                            textRef={textRef}
                            fittedFontSize={fittedFontSize}
                            activeFontFamily={activeFontFamily}
                            activeFontWeight={activeFontWeight}
                            isEditing={isEditing}
                            idPrefix={idPrefix}
                        />
                        {isEditing && (
                            <div className="absolute inset-0" style={{ zIndex: Z_INDEX.CANVAS_EDITOR_OVERLAY }}>
                                <InlineTextEditor
                                    item={item}
                                    onSave={onSave}
                                    onInput={onInput}
                                    onCancel={onCancel}
                                />
                            </div>
                        )}
                    </div>
                );

            case 'image':
            case 'video':
            case 'shape':
                return <ShapeRenderer item={item} idPrefix={idPrefix} />;

            case 'stroke':
                if (!item.stroke) return null;
                return (
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <line
                            x1="0" y1="50"
                            x2={item.stroke.x2} y2={item.stroke.y2 === 0 ? 50 : item.stroke.y2}
                            stroke={item.stroke.color}
                            strokeWidth={item.stroke.width}
                            strokeDasharray={item.stroke.dashArray}
                        />
                    </svg>
                );

            case 'effect':
                if (!item.effect) return null;
                return <EffectRenderer effect={item.effect} />;

            default:
                return null;
        }
    };

    const align = item.strokeAlign || 'center';
    const borderWidth = item.borderWidth || 0;
    const strokes = ensureLayers(item.strokes);
    const fills = ensureLayers(item.fills);

    const getBorderRadius = () => {
        if (item.lockBorderRadius !== false) {
            return item.borderRadius ? `${item.borderRadius}px` : undefined;
        }
        return `${item.borderRadiusTL ?? 0}px ${item.borderRadiusTR ?? 0}px ${item.borderRadiusBR ?? 0}px ${item.borderRadiusBL ?? 0}px`;
    };

    const hasAnyRadius = () => {
        if (item.lockBorderRadius !== false) return (item.borderRadius || 0) > 0;
        return (item.borderRadiusTL || 0) > 0 || (item.borderRadiusTR || 0) > 0 ||
            (item.borderRadiusBR || 0) > 0 || (item.borderRadiusBL || 0) > 0;
    };

    return (
        <div
            className={cn(isFlowText ? (isAutoHeightText ? 'w-full relative' : 'relative') : 'w-full h-full relative')}
            style={{
                opacity: item.opacity ?? 1,
                filter: item.dropShadow ? `drop-shadow(${item.dropShadow.x}px ${item.dropShadow.y}px ${item.dropShadow.blur}px ${item.dropShadow.color})` : undefined,
            }}
        >
            {/* 1. Stroke Layer (If Outside) */}
            {borderWidth > 0 && align === 'outside' && (
                <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: Z_INDEX.CANVAS_ITEM_STROKE }}>
                    <StrokeRenderer item={item} strokes={strokes} align="outside" idPrefix={idPrefix} />
                </div>
            )}

            {/* 2. Main Element Container (Fill + Content) */}
            <div
                className={cn(isFlowText ? 'relative' : 'absolute inset-0')}
                style={{
                    zIndex: Z_INDEX.CANVAS_ITEM,
                    borderRadius: getBorderRadius(),
                    backdropFilter: item.backdropBlur ? `blur(${item.backdropBlur}px)` : undefined,
                    WebkitBackdropFilter: item.backdropBlur ? `blur(${item.backdropBlur}px)` : undefined,
                }}
            >
                {/* Fill Layer Stack */}
                {fills.length > 0 && (
                    <div className="absolute inset-0" style={{ zIndex: Z_INDEX.CANVAS_BACKGROUND, borderRadius: getBorderRadius(), overflow: hasAnyRadius() ? 'hidden' : 'visible' }}>
                        <SlideBackground background={fills} showOverlay={false} />
                    </div>
                )}

                {/* Content Layer */}
                <div className={cn("relative", isFlowText ? (isAutoHeightText ? 'w-full' : '') : 'w-full h-full')} style={{ zIndex: Z_INDEX.CANVAS_ITEM }}>
                    {renderContent()}
                </div>

                {/* 3. Stroke Layer Stack (If Inside or Center) */}
                {borderWidth > 0 && (align === 'inside' || align === 'center') && (
                    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: Z_INDEX.CANVAS_ITEM_STROKE }}>
                        <StrokeRenderer item={item} strokes={strokes} align={align} idPrefix={idPrefix} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default memo(CanvasItemView);
