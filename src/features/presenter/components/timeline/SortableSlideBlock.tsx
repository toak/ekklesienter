import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/core/utils/cn';
import { ISlide, ICanvasSlide, INestedSlide, IPresentationFile, IBlock, ITemplate } from '@/core/types';
import { SlideTile } from './SlideTile';
import { TransitionSeparator } from './TransitionSeparator';
import NestedPresentationTile from './NestedPresentationTile';

export interface SortableSlideBlockProps {
    slide: ISlide;
    index: number;
    activePresentationId: string;
    previewSlideId: string | null;
    selectedPresentationId: string | null;
    liveSlideId: string | null;
    blocksMap: Map<string, IBlock>;
    templatesMap: Map<string, ITemplate>;
    presentationsMap: Map<string, IPresentationFile>;
    navigationParentSlideId: string | null;
    lang: string;
    onSelect: (id: string, e?: React.MouseEvent) => void;
    onLive: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    onToggleExpansion: (id: string) => void;
    isSelected?: boolean;
    isMultiSelect?: boolean;
    isSubItemSelected?: boolean;
    isMultiDragHidden?: boolean;
    dragActiveId?: string | null;
    setContextMenu: (menu: { x: number; y: number; slideId: string; presentationId: string } | null) => void;
}

/**
 * SortableSlideBlock component for the presentation timeline.
 * Integrates with dnd-kit for drag-and-drop sorting and renders the SlideTile and its separators.
 */
export const SortableSlideBlock = React.memo<SortableSlideBlockProps>(({
    slide,
    index,
    activePresentationId,
    previewSlideId,
    selectedPresentationId,
    liveSlideId,
    blocksMap,
    templatesMap,
    presentationsMap,
    lang,
    onSelect,
    onLive,
    onContextMenu,
    onToggleExpansion,
    isSelected,
    isMultiSelect,
    isSubItemSelected,
    isMultiDragHidden,
    dragActiveId,
    navigationParentSlideId,
    setContextMenu
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: slide.id });

    const isCurrentDragging = slide.id === dragActiveId;

    const style: React.CSSProperties = {
        transform: transform && !isCurrentDragging
            ? CSS.Transform.toString(transform)
            : undefined,
        transition,
        willChange: 'transform',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
    };

    const isMaster = slide.blockId === 'master-presentation';
    const masterPresId = slide.type === 'normal' ? (slide as ICanvasSlide).masterPresentationId : (slide.type === 'nested' ? (slide as INestedSlide).presentationId : undefined);
    const nestedPres = masterPresId ? presentationsMap.get(masterPresId) : null;

    return (
        <div
            ref={setNodeRef}
            style={{
                ...style,
                visibility: isCurrentDragging ? 'hidden' : undefined,
                // Collapse hidden multi-drag items to zero width — they must not
                // reserve layout space, otherwise the drop-target gap = N * slide width
                // instead of always being exactly one slide width.
                ...(isMultiDragHidden ? { width: 0, overflow: 'hidden', padding: 0, margin: 0, minWidth: 0, gap: 0 } : {}),
            }}
            className={cn(
                "relative flex items-center h-fit",
                isCurrentDragging && "z-50"
            )}
        >
            {/* Drop placeholder — always in DOM, toggled via CSS only (no DOM mutation on drag) */}
            <div
                className="absolute inset-0 rounded-xl border-2 border-dashed border-accent/30 bg-accent/5 pointer-events-none"
                style={{ visibility: isCurrentDragging ? 'visible' : 'hidden' }}
            />
            <TransitionSeparator slide={slide} activePresentationId={activePresentationId} />
            <SlideTile
                slide={slide}
                index={index}
                activePresentationId={activePresentationId}
                previewSlideId={previewSlideId}
                selectedPresentationId={selectedPresentationId}
                liveSlideId={liveSlideId}
                blocksMap={blocksMap}
                templatesMap={templatesMap}
                lang={lang}
                onSelect={onSelect}
                onLive={onLive}
                onContextMenu={onContextMenu}
                onToggleExpansion={onToggleExpansion}
                isSelected={isSelected}
                isMultiSelect={isMultiSelect}
                isSubItemSelected={isSubItemSelected}
                isMultiDragHidden={isMultiDragHidden}
                presentationsMap={presentationsMap}
                navigationParentSlideId={navigationParentSlideId}
                listeners={listeners}
                attributes={attributes}
            />

            {isMaster && slide.isExpanded && nestedPres && (
                <NestedPresentationTile
                    slide={slide}
                    nestedPresentation={nestedPres}
                    blocksMap={blocksMap}
                    templatesMap={templatesMap}
                    lang={lang}
                    previewSlideId={previewSlideId}
                    selectedPresentationId={selectedPresentationId}
                    onContextMenu={(e, slideId, presentationId) => {
                        setContextMenu({ x: e.clientX, y: e.clientY, slideId, presentationId });
                    }}
                />
            )}
        </div>
    );
});

SortableSlideBlock.displayName = 'SortableSlideBlock';
