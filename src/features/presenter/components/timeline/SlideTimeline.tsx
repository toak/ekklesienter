import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { 
    Plus, GripVertical, Trash2, Layers, Music, Monitor, Coins, Baby, Mic2,
    Megaphone, Presentation, Copy, ArrowLeft, ArrowRight, LayoutTemplate, BookOpen,
    ChevronsLeft, ChevronsRight, Paintbrush, CopyCheck,
    ChevronDown as ChevronDownIcon, ExternalLink, Unlink2, Link2, Unplug, Clock, Timer, Wand2, ArrowRightLeft,
    Scissors, Clipboard as ClipboardIcon, CopyPlus
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ISlide, ICanvasSlide, INestedSlide, IBlock, ITemplate, IPresentationFile } from '@/core/types';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import TrackContainer, { TrackContainerHandle } from './TrackContainer';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { appModeAtom, isTimelineHoveredAtom, slideDesignPanelOpenAtom, slideDesignTabAtom, selectedTransitionSlideIdAtom, selectedCanvasItemIdsAtom } from '@/core/store/uiAtoms';
import AudioTrack from './AudioTrack';
import SmartBadge from './SmartBadge';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { toast } from '@/core/utils/toast';
import {
    DndContext,
    closestCenter,
    closestCorners,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragMoveEvent,
    DragOverEvent,
    DragOverlay,
    defaultDropAnimationSideEffects,
    MeasuringStrategy,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';

// Modularized Components
import { SortableSlideBlock } from './SortableSlideBlock';
import { TimelineDroppableZone } from './TimelineDroppableZone';

// Sub-components have been modularized to separate files in this directory.

const SlideTimeline: React.FC = () => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const {
        activePresentationId,
        selectedPresentationId,
        previewSlideId,
        liveSlideId,
        setActivePresentation,
        setPreviewSlide,
        setLiveSlide,
        updatePresentationSlides,
        updateSlideBackground,
        toggleSlideExpansion,
        detachNestedInstance,
        selectAudioScope,
        duplicateSlide,
        duplicateSlides,
        moveSlide,
        removeSlide,
        removeSlides,
        addPresentationToTimeline,
        selectedSlideIds,
        setSelectedSlideIds,
        toggleSlideSelection,
        clearSelection,
        copySlides,
        pasteSlides,
        clipboard,
        navigationParentSlideId
    } = usePresentationStore();
    const { openModal } = useModalStore();
    const trackRef = useRef<TrackContainerHandle>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [appMode] = useAtom(appModeAtom);
    const [isTimelineHovered, setIsHovered] = useAtom(isTimelineHoveredAtom);
    const isTimelineHoveredRef = useRef(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slideId: string; presentationId: string } | null>(null);
    const [selectedTransId, setTransEditId] = useAtom(selectedTransitionSlideIdAtom);
    const selectedAudioId = usePresentationStore(s => s.selectedAudioScopeId);

    const [nativeDropIndex, setNativeDropIndex] = useState<number | null>(null);

    // Sync hover state to ref for keyboard shortcuts
    useEffect(() => {
        isTimelineHoveredRef.current = isTimelineHovered;
    }, [isTimelineHovered]);

    const isSubItemSelected = !!selectedTransId || !!selectedAudioId;


    const isDetached = previewSlideId !== null && liveSlideId !== null && previewSlideId !== liveSlideId;

    const [localSlides, setLocalSlides] = useState<ISlide[]>([]);
    const dragActiveRef = useRef(false);
    const scrollSpeedRef = useRef(0);
    const pendingUpdateRef = useRef(false);
    const autoScrollRafRef = useRef<number | null>(null);

    const activePresentation = usePresentationStore(s => s.activePresentation);
    const selectedPresentation = usePresentationStore(s => s.selectedPresentation);

    const dbPresentation = useLiveQuery(
        () => activePresentationId ? db.presentationFiles.get(activePresentationId) : undefined,
        [activePresentationId]
    );

    // Prioritize store's active presentation for the timeline
    const presentation = useMemo(() => {
        if (activePresentation?.id === activePresentationId) return activePresentation;
        return dbPresentation;
    }, [activePresentation, dbPresentation, activePresentationId]);

    // Sync localSlides with database updates only if we aren't dragging/updating
    useEffect(() => {
        if (!presentation?.slides) return;

        if (!dragActiveRef.current && !pendingUpdateRef.current) {
            setLocalSlides(presentation.slides);
        } else {
            // Give DB 100ms to catch up so we don't flash old state
            if (pendingUpdateRef.current) {
                const timer = setTimeout(() => {
                    pendingUpdateRef.current = false;
                    setLocalSlides(presentation.slides);
                }, 100);
                return () => clearTimeout(timer);
            }
        }
    }, [presentation?.slides]);

    const allPresentations = useLiveQuery(() => db.presentationFiles.toArray()) || [];
    const presentationsMap = useMemo(() => {
        const map = new Map(allPresentations.map(p => [p.id, p]));
        if (selectedPresentation) map.set(selectedPresentation.id, selectedPresentation);
        if (activePresentation) map.set(activePresentation.id, activePresentation);
        return map;
    }, [allPresentations, activePresentation, selectedPresentation]);

    const blocksQueryResult = useLiveQuery(() => db.blocks.toArray());
    const blocks = blocksQueryResult || [];
    const blocksMap = useMemo(() => new Map(blocks.map(b => [b.id, b])), [blocks]);

    const templatesQueryResult = useLiveQuery(() => db.templates.toArray());
    const templates = templatesQueryResult || [];
    const templatesMap = useMemo(() => new Map(templates.map(t => [t.id, t])), [templates]);

    const isDataLoading = blocksQueryResult === undefined || templatesQueryResult === undefined;
    const slides = presentation?.slides || [];

    // ── Compute Flattened Visual Timeline ──
    const visualTimeline = useMemo(() => {
        const items: Array<{
            id: string,
            width: number,
            x: number,
            type: 'slide' | 'nested' | 'edit-button' | 'spacer',
            slide?: ISlide,
            presentationId?: string,
            parentSlideId?: string
        }> = [];

        const TILE_WIDTH = 128;
        const TILE_GAP = 12; // gap-3

        let currentX = 0;

        for (const slide of slides) {
            // Top level slide
            items.push({
                id: slide.id,
                width: TILE_WIDTH,
                x: currentX,
                type: 'slide',
                slide,
                presentationId: activePresentationId!
            });

            const nextTopLevelX = currentX + TILE_WIDTH + TILE_GAP;

            // If expanded, insert its children
            const masterPresId = slide.type === 'normal' ? (slide as ICanvasSlide).masterPresentationId : (slide.type === 'nested' ? (slide as INestedSlide).presentationId : undefined);
            if (slide.isExpanded && masterPresId) {
                const nested = presentationsMap.get(masterPresId);

                // The NestedPresentationTile is a sibling of the slide in the flex container
                // but its internal layout is handled inside.
                let nestedTrackX = nextTopLevelX;

                if (nested) {
                    // Start border/accent (20px)
                    items.push({
                        id: `spacer-start-${slide.id}`,
                        width: 20,
                        x: nestedTrackX,
                        type: 'spacer',
                        parentSlideId: slide.id
                    });
                    nestedTrackX += 20;

                    nested.slides.forEach((ns, idx) => {
                        items.push({
                            id: ns.id,
                            width: 96,
                            x: nestedTrackX,
                            type: 'nested',
                            slide: ns,
                            presentationId: nested.id,
                            parentSlideId: slide.id
                        });
                        nestedTrackX += 96;

                        // Gap between nested slides (10px)
                        if (idx < nested.slides.length - 1) {
                            items.push({
                                id: `spacer-ns-${ns.id}`,
                                width: 10,
                                x: nestedTrackX,
                                type: 'spacer',
                                parentSlideId: slide.id
                            });
                            nestedTrackX += 10;
                        }
                    });

                    // Gap before Edit button (10px) + Edit button (40px)
                    items.push({
                        id: `spacer-mid-${slide.id}`,
                        width: 10,
                        x: nestedTrackX,
                        type: 'spacer',
                        parentSlideId: slide.id
                    });
                    nestedTrackX += 10;

                    items.push({
                        id: `edit-${slide.id}`,
                        width: 40,
                        x: nestedTrackX,
                        type: 'edit-button',
                        parentSlideId: slide.id
                    });
                    nestedTrackX += 40;

                    // End accent/padding (20px)
                    items.push({
                        id: `spacer-end-${slide.id}`,
                        width: 20,
                        x: nestedTrackX,
                        type: 'spacer',
                        parentSlideId: slide.id
                    });
                    nestedTrackX += 20;
                }

                // The next top-level item (e.g. next slide) starts after the NestedPresentationTile
                currentX = nestedTrackX + TILE_GAP;
            } else {
                currentX = nextTopLevelX;
            }
        }
        return items;
    }, [slides, presentationsMap, activePresentationId]);

    useEffect(() => {
        if (appMode !== 'presentation') return;

        if (!liveSlideId) {
            LiveSyncService.clear();
            return;
        }

        const liveItem = visualTimeline.find(item => item.id === liveSlideId);
        if (liveItem?.slide) {
            LiveSyncService.showSlide(liveItem.slide);
        }
    }, [liveSlideId, visualTimeline, appMode]);

    // Handle projector handshake
    useEffect(() => {
        if (!window.electron?.ipcRenderer) return;

        const unsub = window.electron.ipcRenderer.on('projector-ready', () => {
            if (appMode === 'presentation' && liveSlideId) {
                const liveItem = visualTimeline.find(item => item.id === liveSlideId);
                if (liveItem?.slide) {
                    LiveSyncService.showSlide(liveItem.slide);
                }
            }
        });

        return () => unsub?.();
    }, [appMode, liveSlideId, visualTimeline]);

    const handleAddSlide = async (blockId: string, e?: React.MouseEvent) => {
        if (!activePresentationId) {
            toast.error(t('error_no_active_presentation', 'No active presentation'));
            return;
        }

        // Wait for presentation to load to avoid overwriting existing slides with an empty array
        if (!presentation) {
            toast.info(t('loading_presentation', 'Loading presentation...'));
            return;
        }

        const block = blocksMap.get(blockId);
        if (!block && blockId !== 'default' && blockId !== 'bible') {
            console.error('[SlideTimeline] Block not found:', blockId);
            toast.error(t('error_block_not_found', 'Block type not found: {{blockId}}', { blockId }));
            return;
        }

        if (blockId === 'bible') {
            // Pass insertion context so Bible modal can insert near the selected slide
            const insertBefore = e && (e.metaKey || e.ctrlKey);
            openModal(ModalType.BIBLE_SELECTION, { insertBefore });
            return;
        }

        // Find first template for this block
        const blockTemplates = templates.filter(t => t.category === blockId);
        const templateId = blockTemplates.length > 0 ? blockTemplates[0].id : (blockId === 'default' ? 'empty-slide' : 'default');

        const newSlide: ISlide = {
            id: crypto.randomUUID(),
            type: 'normal',
            order: 0, // Will be recomputed below
            blockId,
            templateId,
            content: { variables: {} },
        };

        try {
            // Compute insertion index relative to selected slide
            const insertBefore = e && (e.metaKey || e.ctrlKey);
            const selectedIdx = previewSlideId ? slides.findIndex(s => s.id === previewSlideId) : -1;
            let insertionIndex: number;
            if (selectedIdx !== -1) {
                insertionIndex = insertBefore ? selectedIdx : selectedIdx + 1;
            } else {
                insertionIndex = slides.length; // Append at end
            }

            const newSlides = [
                ...slides.slice(0, insertionIndex),
                newSlide,
                ...slides.slice(insertionIndex),
            ].map((s, i) => ({ ...s, order: i }));

            await updatePresentationSlides(activePresentationId, newSlides);
            setPreviewSlide(newSlide.id, activePresentationId);
            toast.success(t('slide_added', 'Slide added'));
        } catch (error) {
            console.error('[SlideTimeline] Failed to add slide:', error);
            toast.error(t('error_add_slide_failed', 'Failed to add slide'));
        }
    };

    const handleAddTimer = async (e?: React.MouseEvent) => {
        if (!activePresentationId) return;
        if (!presentation) return;

        // Use 'default' block for timer slides or maybe a dedicated timer block if we had one
        const newSlide: ISlide = {
            id: crypto.randomUUID(),
            type: 'timer',
            order: 0, // Will be recomputed below
            blockId: 'default',
            templateId: 'blank-dark', // Use existing blank template
            durationSec: 300,
            countDirection: 'down'
        };

        try {
            // Compute insertion index relative to selected slide
            const insertBefore = e && (e.metaKey || e.ctrlKey);
            const selectedIdx = previewSlideId ? slides.findIndex(s => s.id === previewSlideId) : -1;
            let insertionIndex: number;
            if (selectedIdx !== -1) {
                insertionIndex = insertBefore ? selectedIdx : selectedIdx + 1;
            } else {
                insertionIndex = slides.length;
            }

            const newSlides = [
                ...slides.slice(0, insertionIndex),
                newSlide,
                ...slides.slice(insertionIndex),
            ].map((s, i) => ({ ...s, order: i }));

            await updatePresentationSlides(activePresentationId, newSlides);
            setPreviewSlide(newSlide.id, activePresentationId);
            toast.success(t('timer_added', 'Timer added'));
        } catch (error) {
            console.error('[SlideTimeline] Failed to add timer:', error);
            toast.error(t('error_add_timer_failed', 'Failed to add timer'));
        }
    };

    const handleRestoreTemplateBg = async (slideId: string) => {
        // Clear backgroundOverride → falls back to template default
        await updateSlideBackground(slideId, null);
    };

    const handleApplyBgToAll = async (slideId: string) => {
        if (!activePresentationId) return;
        const slide = slides.find(s => s.id === slideId);
        if (!slide) return;

        // Use slide's backgroundOverride, or template's background as base
        const template = slide?.templateId ? templatesMap.get(slide.templateId) : undefined;
        const bgToApply = (slide.type === 'normal' ? (slide as ICanvasSlide).backgroundOverride : undefined) || template?.background;
        if (!bgToApply) return;

        const { applyBackgroundToAll } = usePresentationStore.getState();
        await applyBackgroundToAll(bgToApply);
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const stopAutoScroll = () => {
        if (autoScrollRafRef.current !== null) {
            cancelAnimationFrame(autoScrollRafRef.current);
            autoScrollRafRef.current = null;
        }
    };

    const handleDragMove = (event: DragMoveEvent) => {
        const scrollEl = trackRef.current?.getScrollElement();
        if (!scrollEl) return;

        const rect = scrollEl.getBoundingClientRect();
        // Use the activatorEvent to get current pointer position
        const pointerEvent = event.activatorEvent as PointerEvent;
        // delta.x gives us how far we've moved from start, but we need absolute position
        const startX = pointerEvent.clientX;
        const currentX = startX + event.delta.x;

        const EDGE_ZONE = 80;
        const MAX_SPEED = 14;

        const leftEdge = rect.left + EDGE_ZONE;
        const rightEdge = rect.right - EDGE_ZONE;

        let scrollSpeed = 0;

        if (currentX < leftEdge) {
            // Proportional speed: deeper into zone = faster
            const depth = (leftEdge - currentX) / EDGE_ZONE;
            scrollSpeed = -Math.round(MAX_SPEED * Math.min(depth, 1));
        } else if (currentX > rightEdge) {
            const depth = (currentX - rightEdge) / EDGE_ZONE;
            scrollSpeed = Math.round(MAX_SPEED * Math.min(depth, 1));
        }

        scrollSpeedRef.current = scrollSpeed;

        if (scrollSpeed !== 0) {
            // Start RAF loop if not already running
            if (autoScrollRafRef.current === null) {
                const tick = () => {
                    if (!scrollEl || !dragActiveRef.current || scrollSpeedRef.current === 0) {
                        autoScrollRafRef.current = null;
                        return;
                    }
                    scrollEl.scrollLeft += scrollSpeedRef.current;
                    autoScrollRafRef.current = requestAnimationFrame(tick);
                };
                autoScrollRafRef.current = requestAnimationFrame(tick);
            }
        } else {
            // Stop loop if speed is zero
            if (autoScrollRafRef.current !== null) {
                cancelAnimationFrame(autoScrollRafRef.current);
                autoScrollRafRef.current = null;
            }
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // Prevent dragging over a ghost or library item if it's not supported
        if (overId === 'presentation-item-drag') return;

        setLocalSlides(currentSlides => {
            const oldIndex = currentSlides.findIndex(s => s.id === activeId);
            const newIndex = currentSlides.findIndex(s => s.id === overId);

            if (oldIndex === -1 || newIndex === -1) return currentSlides;

            const isPartOfSelection = selectedSlideIds.includes(activeId);
            const draggedIds = isPartOfSelection ? selectedSlideIds : [activeId];
            const validDraggedIds = draggedIds.filter(id => currentSlides.some(s => s.id === id));

            // If hovering over one of the items we are currently dragging, do nothing 
            // to avoid jitter and incorrect index calculations.
            if (validDraggedIds.includes(overId)) return currentSlides;

            if (validDraggedIds.length <= 1) {
                return arrayMove(currentSlides, oldIndex, newIndex);
            }

            const remaining = currentSlides.filter(s => !validDraggedIds.includes(s.id));
            const overIdxInRemaining = remaining.findIndex(s => s.id === overId);
            
            // Safety: if overId is somehow not in remaining (should be caught by check above)
            if (overIdxInRemaining === -1) return currentSlides;

            const sortedDragged = [...validDraggedIds].sort((a, b) => {
                return currentSlides.findIndex(s => s.id === a) - currentSlides.findIndex(s => s.id === b);
            });

            const insertionIdx = oldIndex < newIndex ? overIdxInRemaining + 1 : overIdxInRemaining;
            
            return [
                ...remaining.slice(0, insertionIdx),
                ...sortedDragged.map(id => currentSlides.find(s => s.id === id)!),
                ...remaining.slice(insertionIdx)
            ];
        });
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        stopAutoScroll();
        dragActiveRef.current = false;
        setActiveId(null);
        const { active, over } = event;

        if (over && active.id === 'presentation-item-drag') {
            const presentationId = active.data.current?.presentationId;
            if (presentationId) {
                await addPresentationToTimeline(presentationId);
                return;
            }
        }

        if (over) {
            // Use functional update to ensure we have the absolute latest state from onDragOver
            setLocalSlides(current => {
                const finalSlides = current.map((s, i) => ({
                    ...s,
                    order: i,
                }));

                pendingUpdateRef.current = true;
                
                // SIDE EFFECT MOVED OUT - Wait for state to settle or use effect?
                // Actually, we can just do it after setLocalSlides is called if we match the finalSlides.
                // But better to just calculate finalSlides once.
                
                return finalSlides;
            });

            // Capture the state we just set to update the store outside the render cycle
            const finalSlidesOrdered = localSlides.map((s, i) => ({
                ...s,
                order: i,
            }));

            if (activePresentationId) {
                updatePresentationSlides(activePresentationId, finalSlidesOrdered);
            }
        }
    };

    const handleDragCancel = () => {
        stopAutoScroll();
        scrollSpeedRef.current = 0;
        dragActiveRef.current = false;
        setActiveId(null);
        // Reset local slides to stored state
        setLocalSlides([...slides]);
    };

    // ── Keyboard Shortcuts ──
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const active = document.activeElement;
            const isTyping = active && (
                active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.getAttribute('contenteditable') === 'true'
            );
            if (isTyping) return;

            const isMod = e.metaKey || e.ctrlKey;

            if (isMod && e.key === 'c') {
                if (selectedSlideIds.length > 0) copySlides(activePresentationId!, selectedSlideIds);
            } else if (isMod && e.key === 'v') {
                pasteSlides(activePresentationId!);
            } else if (isMod && e.key === 'x') {
                if (selectedSlideIds.length > 0) copySlides(activePresentationId!, selectedSlideIds, true);
            } else if (isMod && e.key === 'd') {
                e.preventDefault();
                if (selectedSlideIds.length > 0) duplicateSlides(activePresentationId!, selectedSlideIds);
                else if (previewSlideId) duplicateSlide(activePresentationId!, previewSlideId);
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedSlideIds.length > 0) {
                    removeSlides(activePresentationId!, selectedSlideIds);
                } else if (previewSlideId) {
                    removeSlide(activePresentationId!, previewSlideId);
                }
            } else if (isMod && e.key === 'a') {
                e.preventDefault();
                setSelectedSlideIds(slides.map(s => s.id));
            } else if (e.altKey && e.key === 'd') {
                // Only deselect when timeline is hovered
                if (isTimelineHoveredRef.current) {
                    e.preventDefault();
                    clearSelection();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedSlideIds, activePresentationId, slides, copySlides, pasteSlides, duplicateSlides, removeSlides, clearSelection, previewSlideId, duplicateSlide, removeSlide, setSelectedSlideIds]);

    // Sync scroll to selected slide
    useEffect(() => {
        if (previewSlideId) {
            trackRef.current?.scrollToSlide(previewSlideId);
        }
    }, [previewSlideId]);

    if (!activePresentationId) return null;

    return (
        <div
            data-timeline-root
            className="absolute bottom-0 left-0 right-0 bg-stone-900/60 backdrop-blur-xl border-t border-white/5 flex flex-col z-30 animate-in slide-in-from-bottom duration-500"
            style={{ height: 236 }}
            onClick={() => selectAudioScope(null)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Header / Toolbar */}
            <div className="px-4 h-10 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Layers className="w-3 h-3" />
                        {t('timeline', 'Timeline')}
                    </span>
                    <div className="h-4 w-px bg-white/5" />
                    <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">
                        {slides.length} {t('slides', 'Slides')}
                    </span>

                    {/* Detached Mode Warning */}
                    {isDetached && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/15 border border-red-500/30 rounded-lg animate-in fade-in zoom-in-90 duration-300">
                            <Unlink2 className="w-3 h-3 text-red-400" />
                            <span className="text-[9px] font-black text-red-400 uppercase tracking-wider">
                                {t('detached_mode', 'Detached')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Quick Add Toolbar */}
                <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
                    <button
                        onClick={(e) => handleAddSlide('default', e)} // Use 'default' block for blank slides
                        className="p-1.5 text-accent hover:bg-accent/10 rounded-lg transition-all group relative border border-accent/20"
                        title={t('add_blank_slide', 'Add Blank Slide')}
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <button
                        onClick={() => openModal(ModalType.PRESENTATION_PICKER)}
                        className="p-1.5 text-stone-500 hover:text-accent hover:bg-accent/10 rounded-lg transition-all group relative"
                        title={t('add_nested_presentation', 'Add Nested Presentation')}
                    >
                        <Layers className="w-4 h-4" />
                        <div className="absolute -top-1 -right-1">
                            <Plus className="w-2.5 h-2.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </button>
                    <button
                        onClick={(e) => handleAddSlide('bible', e)}
                        className="p-1.5 text-stone-500 hover:text-accent hover:bg-accent/10 rounded-lg transition-all group relative"
                        title={t('add_bible_verse', 'Add Bible Verse')}
                    >
                        <BookOpen className="w-4 h-4" />
                        <div className="absolute -top-1 -right-1">
                            <Plus className="w-2.5 h-2.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </button>
                    <button
                        onClick={(e) => handleAddTimer(e)}
                        className="p-1.5 text-stone-500 hover:text-orange-400 hover:bg-orange-400/10 rounded-lg transition-all group relative"
                        title={t('add_timer_slide', 'Add Timer Slide')}
                    >
                        <Timer className="w-4 h-4" />
                        <div className="absolute -top-1 -right-1">
                            <Plus className="w-2.5 h-2.5 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </button>
                </div>
            </div>

            {/* Timeline Scroll — Slide & Audio Tracks */}
            <div className="flex bg-stone-950/20 overflow-hidden flex-1 relative">

                {/* Fixed Track Headers (Left Column) */}
                <div className="w-20 shrink-0 border-r border-white/5 bg-stone-950/40 flex flex-col z-20 backdrop-blur-md">
                    {/* Slides Track Header */}
                    <div className="h-[98px] flex flex-col items-center justify-center p-2 opacity-50 hover:opacity-100 transition-opacity">
                        <Monitor className="w-5 h-5 mb-1 text-stone-400" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-stone-500 text-center">
                            {t('slides', 'Slides')}
                        </span>
                    </div>
                    {/* Audio Track Header */}
                    {slides.length > 0 && (
                        <div className="h-[98px] shrink-0 flex flex-col items-center justify-center p-2 bg-purple-500/5 hover:bg-purple-500/10 transition-colors border-t border-white/5">
                            <Music className="w-4 h-4 mb-1 text-purple-400/70" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-purple-500/70 text-center">
                                {t('audio', 'Audio')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Scrollable Tracks Area */}
                <div className="flex-1 overflow-hidden relative">
                    <TrackContainer ref={trackRef}>
                        <div className="flex flex-col min-h-full">
                            {/* Lane 1: Slides */}
                            <div className="flex items-center px-8 py-4 min-w-full relative">
                                <TimelineDroppableZone 
                                    onAddSlide={handleAddSlide} 
                                    onAddPresentation={(pid, idx) => {
                                        addPresentationToTimeline(pid, idx);
                                        setNativeDropIndex(null);
                                    }} 
                                    visualTimeline={visualTimeline}
                                    onNativeDragOver={setNativeDropIndex}
                                />
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCorners}
                                    measuring={{
                                        droppable: {
                                            strategy: MeasuringStrategy.Always,
                                        },
                                    }}
                                    onDragStart={(event) => {
                                        dragActiveRef.current = true;
                                        setActiveId(event.active.id as string);
                                    }}
                                    onDragOver={handleDragOver}
                                    onDragEnd={handleDragEnd}
                                    onDragCancel={handleDragCancel}
                                    onDragMove={handleDragMove}
                                >
                                    <div className="flex items-center gap-3 relative">
                                        <SortableContext
                                            items={localSlides.map(s => s.id)}
                                            strategy={horizontalListSortingStrategy}
                                        >
                                            {localSlides.map((slide, index) => (
                                                <React.Fragment key={slide.id}>
                                                    {nativeDropIndex === index && (
                                                        <div className="w-32 h-[72px] shrink-0 rounded-xl relative overflow-hidden transition-all duration-300 transform animate-in zoom-in-95 opacity-80 outline-dashed outline-2 outline-accent outline-offset-1 flex items-center justify-center bg-accent/20 shadow-[0_0_15px_rgba(var(--accent-rgb, 147, 51, 234),0.2)]">
                                                            <Presentation className="w-8 h-8 text-accent animate-pulse" />
                                                        </div>
                                                    )}
                                                    <SortableSlideBlock
                                                        slide={slide}
                                                        index={index}
                                                        activePresentationId={activePresentationId!}
                                                        previewSlideId={previewSlideId}
                                                        selectedPresentationId={selectedPresentationId}
                                                        liveSlideId={liveSlideId}
                                                        blocksMap={blocksMap}
                                                        templatesMap={templatesMap}
                                                        presentationsMap={presentationsMap}
                                                        navigationParentSlideId={navigationParentSlideId}
                                                        lang={lang}
                                                        onSelect={(id, e) => {
                                                            const isMulti = e?.metaKey || e?.ctrlKey;
                                                            const isRange = e?.shiftKey;
                                                            toggleSlideSelection(id, isMulti, isRange);

                                                            // Preview the last selected slide
                                                            setPreviewSlide(id, activePresentationId);
                                                            setTransEditId(null);
                                                            selectAudioScope(null);
                                                        }}
                                                        onLive={(id) => {
                                                            setLiveSlide(id);
                                                        }}
                                                        onContextMenu={(e, id) => {
                                                            e.preventDefault();
                                                            // Ensure the slide is part of selection when right clicking
                                                            if (!selectedSlideIds.includes(id)) {
                                                                toggleSlideSelection(id, false, false);
                                                            }
                                                            setContextMenu({ x: e.clientX, y: e.clientY, slideId: id, presentationId: activePresentationId! });
                                                        }}
                                                        onToggleExpansion={(id) => toggleSlideExpansion(id)}
                                                        isSelected={selectedSlideIds.includes(slide.id)}
                                                        isMultiSelect={selectedSlideIds.length > 1}
                                                        isSubItemSelected={isSubItemSelected}
                                                        isMultiDragHidden={dragActiveRef.current && selectedSlideIds.length > 1 && selectedSlideIds.includes(slide.id) && slide.id !== activeId}
                                                        setContextMenu={setContextMenu}
                                                    />
                                                </React.Fragment>
                                            ))}
                                            {nativeDropIndex === localSlides.length && (
                                                <div className="w-32 h-[72px] shrink-0 rounded-xl relative overflow-hidden transition-all duration-300 transform animate-in zoom-in-95 opacity-80 outline-dashed outline-2 outline-accent outline-offset-1 flex items-center justify-center bg-accent/20 shadow-[0_0_15px_rgba(var(--accent-rgb, 147, 51, 234),0.2)]">
                                                    <Presentation className="w-8 h-8 text-accent animate-pulse" />
                                                </div>
                                            )}
                                        </SortableContext>
                                    </div>

                                    {/* Drag Overlay - Rendered via Portal but MUST be inside DndContext */}
                                    {createPortal(
                                        <DragOverlay
                                            adjustScale={false}
                                            dropAnimation={{
                                                sideEffects: defaultDropAnimationSideEffects({
                                                    styles: {
                                                        active: {
                                                            opacity: '0.1',
                                                        },
                                                    },
                                                }),
                                            }}
                                            style={{
                                                pointerEvents: 'none',
                                                zIndex: 9999
                                            }}
                                        >
                                            {activeId ? (
                                                <div className="relative group/drag isolate w-32 h-[72px]">
                                                    {/* macOS-style Deck Stack for multi-select */}
                                                    {selectedSlideIds.length > 1 && selectedSlideIds.includes(activeId) && (
                                                        <div className="absolute inset-0">
                                                            {[...selectedSlideIds]
                                                                .sort((a, b) => localSlides.findIndex(s => s.id === a) - localSlides.findIndex(s => s.id === b))
                                                                .filter(id => id !== activeId)
                                                                .slice(0, 3) 
                                                                .reverse()
                                                                .map((id, idx) => {
                                                                    const slide = localSlides.find(s => s.id === id);
                                                                    if (!slide) return null;
                                                                    return (
                                                                        <div
                                                                            key={`drag-stack-${id}`}
                                                                            className="absolute inset-0 translate-x-[4px] translate-y-[4px] bg-stone-800 rounded-xl border border-white/10 opacity-40 shadow-xl"
                                                                            style={{
                                                                                transform: `translate(${idx * 4}px, ${idx * 4}px) rotate(${(idx + 1) * 2}deg)`,
                                                                                zIndex: -1 - idx
                                                                            }}
                                                                        >
                                                                            <div className="w-32 aspect-video overflow-hidden rounded-xl opacity-50 grayscale">
                                                                                <SlideContentRenderer
                                                                                    template={templatesMap.get(slide.templateId)}
                                                                                    block={blocksMap.get(slide.blockId)}
                                                                                    variables={(slide as ICanvasSlide).content?.variables}
                                                                                    lang={lang}
                                                                                    isPreview={true}
                                                                                    scale={128 / 1920}
                                                                                    backgroundOverride={(slide as ICanvasSlide).backgroundOverride}
                                                                                    canvasItems={(slide as ICanvasSlide).content?.canvasItems}
                                                                                    slide={slide}
                                                                                    slideId={slide.id}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            
                                                            <div className="absolute -top-3 -right-3 px-2.5 py-1 bg-accent text-white text-[11px] font-black rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.5)] border-2 border-stone-900 z-50 flex items-center justify-center min-w-[24px] animate-in zoom-in-50 duration-200">
                                                                {selectedSlideIds.length}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="scale-[1.05] rotate-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)] border-2 border-accent/50 rounded-xl overflow-hidden backdrop-blur-sm flex-none w-32 h-[72px]">
                                                        {(() => {
                                                            const isLibraryDrag = activeId === 'presentation-item-drag';
                                                            const slide = isLibraryDrag 
                                                                ? undefined 
                                                                : localSlides.find(s => s.id === activeId);

                                                            if (!slide && !isLibraryDrag) return null;
                                                            if (isLibraryDrag) return (
                                                                <div className="w-32 aspect-video bg-accent/20 border-2 border-accent border-dashed rounded-xl flex items-center justify-center backdrop-blur-md">
                                                                    <Presentation className="w-8 h-8 text-accent animate-pulse" />
                                                                </div>
                                                            );

                                                            const block = blocksMap.get(slide!.blockId);
                                                            const template = templatesMap.get(slide!.templateId);
                                                            return (
                                                                <div className="w-32 aspect-video relative bg-stone-900">
                                                                    <SlideContentRenderer
                                                                        template={template}
                                                                        block={block}
                                                                        variables={(slide as ICanvasSlide).content?.variables}
                                                                        lang={lang}
                                                                        isPreview={true}
                                                                        scale={128 / 1920}
                                                                        backgroundOverride={(slide as ICanvasSlide).backgroundOverride}
                                                                        canvasItems={(slide as ICanvasSlide).content?.canvasItems}
                                                                        slide={slide!}
                                                                        slideId={slide!.id}
                                                                    />
                                                                    <div className="absolute inset-0 bg-accent/5" />
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </DragOverlay>,
                                        document.body
                                    )}
                                </DndContext>
                            </div>

                            {/* Lane 2: Audio */}
                            {localSlides.length > 0 && (
                                <div className="flex items-center px-8 pt-[10px] pb-4 shrink-0 overflow-visible h-[98px] border-t border-white/5">
                                    <AudioTrack visualTimeline={visualTimeline} />
                                </div>
                            )}
                        </div>
                    </TrackContainer>
                </div>



                {localSlides.length === 0 && (
                    <div className="flex-1 flex items-center justify-center gap-4 text-stone-700 italic border-2 border-dashed border-white/5 rounded-2xl h-full mx-4 min-h-[128px]">
                        <Layers className="w-6 h-6 opacity-20" />
                        <span className="text-xs">{t('timeline_empty_hint', 'Add slides from the toolbar or drag blocks here.')}</span>
                    </div>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                >
                    {/* Bible-specific: Change Verse */}
                    {presentationsMap.get(contextMenu.presentationId)?.slides?.find(s => s.id === contextMenu.slideId)?.blockId === 'bible' && (
                        <ContextMenuItem
                            icon={<BookOpen className="w-4 h-4" />}
                            label={t('change_verse', 'Change Verse')}
                            onClick={() => {
                                openModal(ModalType.BIBLE_SELECTION, { slideId: contextMenu.slideId, presentationId: contextMenu.presentationId });
                                setContextMenu(null);
                            }}
                        />
                    )}

                    {/* Change Template (non-bible, non-master) */}
                    {(() => {
                        const slide = presentationsMap.get(contextMenu.presentationId)?.slides?.find(s => s.id === contextMenu.slideId);
                        if (slide && slide.blockId !== 'bible' && slide.blockId !== 'master-presentation') {
                            return (
                                <ContextMenuItem
                                    icon={<LayoutTemplate className="w-4 h-4" />}
                                    label={t('change_template', 'Change Template')}
                                    onClick={() => {
                                        openModal(ModalType.TEMPLATE_PICKER, {
                                            slideId: contextMenu.slideId,
                                            blockId: slide.blockId,
                                            presentationId: contextMenu.presentationId
                                        });
                                        setContextMenu(null);
                                    }}
                                />
                            );
                        }
                        return null;
                    })()}

                    <div className="h-px bg-white/5 my-1" />

                    <ContextMenuItem
                        icon={<Copy className="w-4 h-4" />}
                        label={selectedSlideIds.length > 1 ? t('copy_multiple', 'Copy Selected') : t('copy', 'Copy')}
                        onClick={() => {
                            copySlides(contextMenu.presentationId, selectedSlideIds.length > 0 ? selectedSlideIds : [contextMenu.slideId]);
                            setContextMenu(null);
                        }}
                        shortcut="CMD+C"
                    />

                    <ContextMenuItem
                        icon={<Scissors className="w-4 h-4" />}
                        label={selectedSlideIds.length > 1 ? t('cut_multiple', 'Cut Selected') : t('cut', 'Cut')}
                        onClick={() => {
                            copySlides(contextMenu.presentationId, selectedSlideIds.length > 0 ? selectedSlideIds : [contextMenu.slideId], true);
                            setContextMenu(null);
                        }}
                        shortcut="CMD+X"
                    />

                    <ContextMenuItem
                        icon={<ClipboardIcon className="w-4 h-4" />}
                        label={t('paste', 'Paste')}
                        disabled={!clipboard}
                        onClick={() => {
                            const slidesArr = presentationsMap.get(contextMenu.presentationId)?.slides || [];
                            const targetIdx = slidesArr.findIndex(s => s.id === contextMenu.slideId) + 1;
                            pasteSlides(contextMenu.presentationId, targetIdx);
                            setContextMenu(null);
                        }}
                        shortcut="CMD+V"
                    />

                    <div className="h-px bg-white/5 my-1" />

                    <ContextMenuItem
                        icon={<CopyPlus className="w-4 h-4" />}
                        label={selectedSlideIds.length > 1 ? t('duplicate_multiple', 'Duplicate Selected') : t('duplicate', 'Duplicate')}
                        onClick={() => {
                            if (selectedSlideIds.length > 1) {
                                duplicateSlides(contextMenu.presentationId, selectedSlideIds);
                            } else {
                                duplicateSlide(contextMenu.presentationId, contextMenu.slideId);
                            }
                            setContextMenu(null);
                        }}
                        shortcut="CMD+D"
                    />

                    <div className="h-px bg-white/5 my-1" />

                    {/* Detach Nested (for linked/master slides) */}
                    {(() => {
                        const presentation = presentationsMap.get(contextMenu.presentationId);
                        const slide = presentation?.slides?.find(s => s.id === contextMenu.slideId);
                        if (!slide) return null;
                        
                        const isNormal = slide.type === 'normal';
                        const isNested = slide.type === 'nested';
                        const linkedId = isNormal ? (slide as ICanvasSlide).linkedPresentationId : (isNested ? (slide as INestedSlide).presentationId : undefined);
                        const masterId = isNormal ? (slide as ICanvasSlide).masterPresentationId : undefined;

                        if (linkedId || masterId) {
                            return (
                                <ContextMenuItem
                                    icon={<Unplug className="w-4 h-4" />}
                                    label={t('detach_nested', 'Detach Nested')}
                                    onClick={() => {
                                        detachNestedInstance(contextMenu.slideId);
                                        setContextMenu(null);
                                    }}
                                />
                            );
                        }
                        return null;
                    })()}

                    <ContextMenuItem
                        icon={<ArrowLeft className="w-4 h-4" />}
                        label={t('move_back', 'Move Back')}
                        disabled={selectedSlideIds.length > 1}
                        onClick={() => {
                            moveSlide(contextMenu.presentationId, contextMenu.slideId, 'back');
                            setContextMenu(null);
                        }}
                    />
                    <ContextMenuItem
                        icon={<ArrowRight className="w-4 h-4" />}
                        label={t('move_forth', 'Move Forth')}
                        disabled={selectedSlideIds.length > 1}
                        onClick={() => {
                            moveSlide(contextMenu.presentationId, contextMenu.slideId, 'forth');
                            setContextMenu(null);
                        }}
                    />
                    <ContextMenuItem
                        icon={<ChevronsLeft className="w-4 h-4" />}
                        label={t('move_to_start', 'Move to Start')}
                        disabled={selectedSlideIds.length > 1}
                        onClick={() => {
                            moveSlide(contextMenu.presentationId, contextMenu.slideId, 'start');
                            setContextMenu(null);
                        }}
                    />
                    <ContextMenuItem
                        icon={<ChevronsRight className="w-4 h-4" />}
                        label={t('move_to_end', 'Move to End')}
                        disabled={selectedSlideIds.length > 1}
                        onClick={() => {
                            moveSlide(contextMenu.presentationId, contextMenu.slideId, 'end');
                            setContextMenu(null);
                        }}
                    />

                    <div className="h-px bg-white/5 my-1" />

                    <ContextMenuItem
                        icon={<Trash2 className="w-4 h-4" />}
                        label={selectedSlideIds.length > 1 ? t('delete_multiple', 'Delete Selected') : t('delete', 'Delete')}
                        danger
                        onClick={() => {
                            if (selectedSlideIds.length > 1) {
                                removeSlides(contextMenu.presentationId, selectedSlideIds);
                            } else {
                                removeSlide(contextMenu.presentationId, contextMenu.slideId);
                            }
                            setContextMenu(null);
                        }}
                        shortcut="Delete"
                    />
                </ContextMenu>
            )}
        </div>
    );
};

export default SlideTimeline;
