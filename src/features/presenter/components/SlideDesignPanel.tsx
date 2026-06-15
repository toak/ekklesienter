import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import {
    selectedCanvasItemIdsAtom,
    editingCanvasItemIdAtom,
    slideDesignPanelOpenAtom,
    slideEditorDragActiveAtom,
    slideEditorPendingUpdateAtom,
    slideDesignHoveredAtom,
    slideDesignTabAtom,
    selectedTransitionSlideIdAtom
} from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore } from '@/core/store/modalStore';
import {
    ImageIcon, Layers, Clock, Copy, Palette, Music, X,
    ArrowRightLeft, Film
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ICanvasItem, IStyleLayer, ICanvasSlide, IVideoSlide } from '@/core/types';
import type { TFunction } from 'i18next';
import { ensureLayers } from '@/core/utils/styleMigration';
import { getUniqueSelectionStyles, calculateStyleUpdates } from '../utils/styleExtraction';
import { toast } from '@/core/utils/toast';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor,
    useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { applyBlockStyle } from '@/features/presenter/utils/applyBlockStyle';

import {
    LayerItem, ItemProperties,
    TimerTabContent, AudioTabContent, TransitionTabContent, VideoTabContent,
    LayerRow, SlideColors,
} from './slide-properties';
import { BackgroundPicker } from './slide-properties/BackgroundPicker';

// ─── Tab definitions ───────────────────────────────────────────────────────
type PanelTab = 'properties' | 'background' | 'layers' | 'audio' | 'timer' | 'transition' | 'video';

const getAlwaysTabs = (t: any): { id: PanelTab; icon: React.ElementType; title: string }[] => [
    { id: 'properties', icon: Palette, title: t('properties', { defaultValue: 'Properties' }) },
    { id: 'background', icon: ImageIcon, title: t('background', { defaultValue: 'Background' }) },
    { id: 'layers', icon: Layers, title: t('layers', { defaultValue: 'Layers' }) },
];

// ─── Main Panel ────────────────────────────────────────────────────────────
const SlideDesignPanel: React.FC = () => {
    const { t } = useTranslation();
    const [panelOpen, setPanelOpen] = useAtom(slideDesignPanelOpenAtom);
    const [selectedIds, setSelectedIds] = useAtom(selectedCanvasItemIdsAtom);
    const selectedItemId = selectedIds[selectedIds.length - 1] || null;
    const [, setEditingId] = useAtom(editingCanvasItemIdAtom) as [string | null, (v: string | null) => void];
    const [activeTab, setActiveTab] = useAtom(slideDesignTabAtom);
    const selectedTransId = useAtomValue(selectedTransitionSlideIdAtom);
    const setSelectedTransId = useSetAtom(selectedTransitionSlideIdAtom);
    const [dragActive, setDragActive] = useAtom(slideEditorDragActiveAtom);
    const [pendingUpdate, setPendingUpdate] = useAtom(slideEditorPendingUpdateAtom);
    const openModal = useModalStore(s => s.openModal);

    const {
        selectedPresentationId, previewSlideId, updateSlideBackground,
        addCanvasItem, updateCanvasItem, updateCanvasItems: batchUpdateCanvasItems,
        updateCanvasItemsOrder, removeCanvasItem, 
        selectedAudioScopeId, selectAudioScope, activePresentation, selectedPresentation,
        updateAudioScope, removeAudioScope, applyBackgroundToAll, updateTimerSettings,
        updateSlideTransition, triggerTransitionPreview, updatePresentationEndTransition,
        activePresentationId, updateVideoSettings, takeSnapshot,
    } = usePresentationStore();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // ─── Data ───
    const dbPresentation = useLiveQuery(
        () => selectedPresentationId ? db.presentationFiles.get(selectedPresentationId) : undefined,
        [selectedPresentationId]
    );
    const presentation = selectedPresentation || dbPresentation;

    const allTemplates = useLiveQuery(() => db.templates.toArray()) || [];
    const tmplMap = useMemo(() => new Map(allTemplates.map(t => [t.id, t])), [allTemplates]);

    const selectedSlide = useMemo(
        () => presentation?.slides?.find(s => s.id === previewSlideId),
        [presentation, previewSlideId]
    );
    const template = selectedSlide ? tmplMap.get(selectedSlide.templateId) : undefined;
    const slideBg = selectedSlide?.type === 'normal'
        ? (selectedSlide as ICanvasSlide).backgroundOverride || template?.background
        : template?.background;
    const dbCanvasItems = selectedSlide?.type === 'normal'
        ? (selectedSlide as ICanvasSlide).content?.canvasItems
        : undefined;

    const [localItems, setLocalItems] = useState<ICanvasItem[]>([]);

    useEffect(() => {
        if (!dragActive && !pendingUpdate) {
            setLocalItems(dbCanvasItems || []);
        } else if (pendingUpdate) {
            const timer = setTimeout(() => setPendingUpdate(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [dbCanvasItems, dragActive, pendingUpdate, setPendingUpdate]);

    // ─── Audio scopes ───
    const dbAudioScopes = useLiveQuery(
        () => activePresentationId ? db.audioScopes.where('presentationId').equals(activePresentationId).toArray() : [],
        [activePresentationId]
    ) || [];

    const scope = useMemo(() => {
        if (!selectedAudioScopeId) return undefined;
        return dbAudioScopes.find(s => s.id === selectedAudioScopeId);
    }, [selectedAudioScopeId, dbAudioScopes]);

    const mediaItem = useLiveQuery(async () => {
        if (!scope?.fileId) return undefined;
        const byId = await db.mediaPool.get(scope.fileId);
        if (byId) return byId;
        // Optimization: use where('path').equals() instead of filter()
        return db.mediaPool.where('path').equals(scope.fileId).first();
    }, [scope?.fileId]);

    // ─── Selection styles ───
    const selectionStyles = useMemo(
        () => selectedIds.length > 0 ? getUniqueSelectionStyles(selectedIds, localItems) : [],
        [selectedIds, localItems]
    );

    // ─── Handlers ───
    const handleUpdateItem = (id: string, updates: Partial<ICanvasItem>) => {
        setLocalItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const newItem = { ...item, ...updates };
            // Ensure nested objects are merged correctly in local state to prevent content loss
            if (updates.text && item.text) {
                newItem.text = { ...item.text, ...updates.text };
            }
            if (updates.shape && item.shape) {
                newItem.shape = { ...item.shape, ...updates.shape };
            }
            return newItem;
        }));
        if (previewSlideId) updateCanvasItem(previewSlideId, id, updates);
    };

    const handleBatchUpdateByArray = useCallback(async (updates: Array<{ id: string; updates: Partial<ICanvasItem> }>) => {
        // 1. Optimistic UI update — immediate feedback
        setLocalItems(prev => prev.map(item => {
            const update = updates.find(u => u.id === item.id);
            if (!update) return item;

            const newItem = { ...item, ...update.updates };
            // Ensure nested objects are merged correctly in local state to prevent content loss
            if (update.updates.text && item.text) {
                newItem.text = { ...item.text, ...update.updates.text };
            }
            if (update.updates.shape && item.shape) {
                newItem.shape = { ...item.shape, ...update.updates.shape };
            }
            return newItem;
        }));

        // 2. Background persistence with undo/redo support
        if (previewSlideId) {
            await takeSnapshot(previewSlideId);
            batchUpdateCanvasItems(previewSlideId, updates);
        }
    }, [previewSlideId, takeSnapshot, batchUpdateCanvasItems]);

    const handleSelectionStyleUpdate = useCallback((oldLayer: IStyleLayer, updates: Partial<IStyleLayer>) => {
        if (!previewSlideId) return;
        const allUpdates = calculateStyleUpdates(selectedIds, localItems, oldLayer, updates);
        if (allUpdates.length > 0) handleBatchUpdateByArray(allUpdates);
    }, [previewSlideId, selectedIds, localItems, handleBatchUpdateByArray]);

    // ─── Auto-tab switching ───
    useEffect(() => {
        if (selectedItemId) setActiveTab('properties' as any);
    }, [selectedItemId, setActiveTab]);

    useEffect(() => {
        if (selectedAudioScopeId) {
            setActiveTab('audio' as any);
        }
    }, [selectedAudioScopeId, setActiveTab]);

    useEffect(() => {
        if (selectedTransId) setActiveTab('transition' as any);
    }, [selectedTransId, setActiveTab]);

    useEffect(() => {
        if (selectedSlide?.type === 'video') {
            setActiveTab('video' as any);
        } else if (selectedSlide?.type === 'timer' && activeTab === 'video') {
             // If we were on video and switch to normal, maybe stay on properties or background?
             // Not strictly necessary to revert here, but good to handle if needed.
             // Usually we let it stay or switch down later.
        }
    }, [selectedSlide?.type, setActiveTab]);

    // ─── Handlers ───
    const handleBgChange = (bg: IStyleLayer[]) => {
        if (previewSlideId) updateSlideBackground(previewSlideId, bg as never);
    };

    const handleRemoveItem = (itemId: string) => {
        setLocalItems(prev => prev.filter(i => i.id !== itemId));
        if (previewSlideId) removeCanvasItem(previewSlideId, itemId);
        if (selectedIds.includes(itemId)) {
            setSelectedIds(selectedIds.filter(i => i !== itemId));
        }
    };

    // Multi-select logic for layers panel
    const handleLayerSelect = useCallback((id: string, e: React.MouseEvent) => {
        if (e.metaKey || e.ctrlKey) {
            // Toggle this item
            setSelectedIds(prev =>
                prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
            );
        } else if (e.shiftKey && selectedIds.length > 0) {
            // Range select (based on display order = reversed localItems)
            const displayItems = [...localItems].reverse();
            const lastIdx = displayItems.findIndex(i => i.id === selectedIds[selectedIds.length - 1]);
            const thisIdx = displayItems.findIndex(i => i.id === id);
            if (lastIdx !== -1 && thisIdx !== -1) {
                const [from, to] = lastIdx < thisIdx ? [lastIdx, thisIdx] : [thisIdx, lastIdx];
                const rangeIds = displayItems.slice(from, to + 1).map(i => i.id);
                setSelectedIds(Array.from(new Set([...selectedIds, ...rangeIds])));
            }
        } else {
            setSelectedIds([id]);
        }
    }, [selectedIds, localItems, setSelectedIds]);

    // Layers DnD
    const handleLayerDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setDragActive(false);
        if (!over || active.id === over.id || !previewSlideId) return;

        // Items are displayed reversed (top = front), so we operate on a reversed copy
        const reversed = [...localItems].reverse();
        const oldIdx = reversed.findIndex(i => i.id === active.id);
        const newIdx = reversed.findIndex(i => i.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return;

        const reordered = arrayMove(reversed, oldIdx, newIdx).reverse();
        const withZIndex = reordered.map((item, idx) => ({
            ...item,
            zIndex: idx * 10
        }));
        setPendingUpdate(true);
        setLocalItems(withZIndex);
        updateCanvasItemsOrder(previewSlideId, withZIndex);
    };

    // Slide colors — clicking a color opens it for all elements with that color
    const handleSlideColorClick = useCallback((layer: IStyleLayer) => {
        // Find all canvas items that use this exact color
        const matchingIds = localItems.filter(item => {
            const fills = item.type === 'text' ? (item.text?.textFills || []) : (item.fills || []);
            const strokes = item.strokes || [];
            return [...fills, ...strokes].some(f => f.type === 'color' && f.color === layer.color);
        }).map(i => i.id);

        if (matchingIds.length > 0) {
            setSelectedIds(matchingIds);
            setActiveTab('properties' as any);
        }
    }, [localItems, setSelectedIds, setActiveTab]);

    const setSlideDesignHovered = useSetAtom(slideDesignHoveredAtom);

    if (!panelOpen) return null;

    // ─── Build tab list ───
    const hasTimer = selectedSlide?.type === 'timer' ||
        (selectedSlide?.type === 'normal' && !!(selectedSlide as ICanvasSlide).timerSettings);
    const isVideoSlide = selectedSlide?.type === 'video';
    const contextTabs: { id: PanelTab; icon: React.ElementType; title: string }[] = [
        ...(hasTimer ? [{ id: 'timer' as PanelTab, icon: Clock, title: t('timer', { defaultValue: 'Timer' }) }] : []),
        ...(isVideoSlide ? [{ id: 'video' as PanelTab, icon: Film, title: t('video', { defaultValue: 'Video' }) }] : []),
        ...(selectedAudioScopeId ? [{ id: 'audio' as PanelTab, icon: Music, title: t('audio', { defaultValue: 'Audio' }) }] : []),
        ...(selectedTransId ? [{ id: 'transition' as PanelTab, icon: ArrowRightLeft, title: t('transition', { defaultValue: 'Transition' }) }] : []),
    ];
    const allTabs = [...getAlwaysTabs(t), ...contextTabs];
    const safeTab = allTabs.some(t => t.id === activeTab as string) ? activeTab as string : 'properties';

    // Display items reversed (top layer first in UI, matching Figma convention)
    const displayItems = [...localItems].reverse();

    return createPortal(
        <div
            data-slide-design-panel="true"
            className="fixed top-0 right-0 h-full w-[320px] z-40 flex flex-col border-l border-white/6 animate-panel-in"
            style={{ background: 'rgba(10, 9, 8, 0.97)', backdropFilter: 'blur(24px)' }}
            onMouseEnter={() => setSlideDesignHovered(true)}
            onMouseLeave={() => setSlideDesignHovered(false)}
        >
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/6 shrink-0">
                <span className="text-[10px] font-black text-stone-500 uppercase tracking-[0.25em]">
                    {t('design', { defaultValue: 'Design' })}
                </span>
                <button
                    onClick={() => {
                        setPanelOpen(false);
                        selectAudioScope(null);
                        setSelectedTransId(null);
                    }}
                    className="p-1.5 cursor-pointer rounded-lg text-stone-600 hover:text-stone-300 hover:bg-white/5 transition-all active:scale-90"
                    aria-label="Close"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* ─── Tab bar ─── */}
            <div className="flex items-center gap-0.5 px-3 py-2 border-b border-white/6 shrink-0">
                {allTabs.map(({ id, icon: Icon, title }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id as any)}
                        title={title}
                        className={cn(
                            "flex-1 flex items-center justify-center py-2 cursor-pointer rounded-lg transition-all duration-150 relative group",
                            safeTab === id
                                ? "bg-white/8 text-white"
                                : "text-stone-600 hover:text-stone-300 hover:bg-white/4"
                        )}
                    >
                        <Icon className={cn(
                            "w-[15px] h-[15px] transition-all duration-150",
                            safeTab === id ? "text-accent" : ""
                        )} />
                        {/* Active indicator */}
                        {safeTab === id && (
                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-accent rounded-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* ─── Content ─── */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                {!selectedSlide && safeTab !== 'audio' ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                        <Layers className="w-8 h-8 text-stone-800" strokeWidth={1} />
                        <p className="text-[10px] text-stone-700 font-bold uppercase tracking-widest">
                            {t('select_slide_to_edit', 'Select a slide')}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* ══ Properties Tab ══ */}
                        {safeTab === 'properties' && (
                            <div className="p-3 space-y-4 animate-in fade-in duration-200">
                                {selectedIds.length > 0 ? (
                                    <>
                                        <ItemProperties
                                            selectedIds={selectedIds}
                                            canvasItems={localItems}
                                            updateCanvasItems={(idList, updates) => {
                                                setLocalItems(prev => prev.map(item => {
                                                    if (!idList.includes(item.id)) return item;
                                                    const newItem = { ...item, ...updates };
                                                    // Ensure nested objects are merged correctly in local state to prevent content loss
                                                    if (updates.text && item.text) {
                                                        newItem.text = { ...item.text, ...updates.text };
                                                    }
                                                    if (updates.shape && item.shape) {
                                                        newItem.shape = { ...item.shape, ...updates.shape };
                                                    }
                                                    return newItem;
                                                }));
                                                
                                                const allUpdates = idList.map(id => {
                                                    const item = localItems.find(i => i.id === id);
                                                    if (!item) return null;
                                                    const finalUpdates = { ...updates };
                                                    if (updates.text && item.text) {
                                                        const blockStyleUpdate = applyBlockStyle(item, updates.text);
                                                        finalUpdates.text = blockStyleUpdate.text;
                                                    }
                                                    if (updates.shape && item.shape) {
                                                        finalUpdates.shape = { ...item.shape, ...updates.shape };
                                                    }
                                                    return { id, updates: finalUpdates };
                                                }).filter(Boolean) as Array<{ id: string; updates: Partial<ICanvasItem> }>;
                                                if (allUpdates.length > 0) batchUpdateCanvasItems(previewSlideId!, allUpdates);
                                            }}
                                            onBatchUpdate={handleBatchUpdateByArray}
                                            isPreview={true}
                                            t={t as never}
                                        />
                                        {/* Selection Colors — shown when multiple items selected */}
                                        {selectionStyles.length > 0 && (
                                            <div className="space-y-2 pt-2 mt-4 border-t border-white/6">
                                                <div className="flex items-center mt-3 gap-2 px-1">
                                                    <div className="w-1 h-3 bg-accent/40 rounded-full" />
                                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500">
                                                        {t('selection_colors', 'Selection Colors')}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col gap-1.5 bg-black/20 p-2 rounded-xl border border-white/5">
                                                    {selectionStyles.map((layer, idx) => (
                                                        <LayerItem
                                                            key={layer.id || idx}
                                                            layer={layer}
                                                            index={idx}
                                                            total={selectionStyles.length}
                                                            onUpdate={(updates) => handleSelectionStyleUpdate(layer, updates)}
                                                            onRemove={() => { }}
                                                            hideHandle={true}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    /* No selection — show slide colors */
                                    <SlideColors
                                        items={localItems}
                                        onColorClick={handleSlideColorClick}
                                        selectionStyles={selectionStyles}
                                        onSelectionStyleUpdate={handleSelectionStyleUpdate}
                                    />
                                )}
                            </div>
                        )}

                        {/* ══ Background Tab ══ */}
                        {safeTab === 'background' && (
                            <div className="p-3 space-y-3 animate-in fade-in duration-200">
                                {/* Apply to all */}
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-[9px] font-black text-stone-600 uppercase tracking-[0.2em]">
                                        {t('slide_background', 'Slide Background')}
                                    </span>
                                    <button
                                        onClick={async () => {
                                            const bg = ensureLayers(slideBg);
                                            await applyBackgroundToAll(bg);
                                            toast.success(t('background_applied_to_all', 'Applied to all slides'));
                                        }}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent/8 hover:bg-accent/15 text-accent rounded-lg border border-accent/15 transition-all cursor-pointer text-[9px] font-bold uppercase tracking-wider"
                                    >
                                        <Copy className="w-3 h-3" />
                                        {t('apply_to_all', 'Apply to All')}
                                    </button>
                                </div>
                                <BackgroundPicker
                                    background={slideBg || { type: 'color', color: '#000000' }}
                                    onChange={handleBgChange}
                                />
                            </div>
                        )}

                        {/* ══ Layers Tab ══ */}
                        {safeTab === 'layers' && (
                            <div className="p-3 animate-in fade-in duration-200">
                                {localItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-white/3 border border-white/5 flex items-center justify-center">
                                            <Layers className="w-5 h-5 text-stone-700" />
                                        </div>
                                        <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest text-center">
                                            {t('no_layers_yet', { defaultValue: 'No layers yet' })}
                                        </p>
                                        <p className="text-[9px] text-stone-700 text-center leading-relaxed max-w-[180px]">
                                            {t('use_toolbar_hint', { defaultValue: 'Use the toolbar to add text, shapes, and images to this slide' })}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-0.5">
                                        {/* Selection summary */}
                                        {selectedIds.length > 1 && (
                                            <div className="flex items-center justify-between px-2 py-1.5 mb-2 bg-accent/8 border border-accent/15 rounded-xl">
                                                <span className="text-[9px] font-bold text-accent uppercase tracking-wider">
                                                    {t('selected_count', { count: selectedIds.length, defaultValue: '{{count}} selected' })}
                                                </span>
                                                <button
                                                    onClick={() => setSelectedIds([])}
                                                    className="text-[9px] text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
                                                >
                                                    {t('clear', { defaultValue: 'Clear' })}
                                                </button>
                                            </div>
                                        )}

                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragStart={() => setDragActive(true)}
                                            onDragEnd={handleLayerDragEnd}
                                            onDragCancel={() => setDragActive(false)}
                                            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                                        >
                                            <SortableContext
                                                items={displayItems.map(i => i.id)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                {displayItems.map(item => (
                                                    <LayerRow
                                                        key={item.id}
                                                        item={item}
                                                        isSelected={selectedIds.includes(item.id)}
                                                        onSelect={handleLayerSelect}
                                                        onUpdate={handleUpdateItem}
                                                        onRemove={handleRemoveItem}
                                                    />
                                                ))}
                                            </SortableContext>
                                        </DndContext>

                                        {/* Hint */}
                                        <p className="text-[9px] text-stone-700 px-2 pt-3 leading-relaxed">
                                            ⌘ or Shift+click for multi-select
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ══ Timer Tab ══ */}
                        {safeTab === 'timer' && hasTimer && (
                            <div className="p-3 animate-in fade-in duration-200">
                                <TimerTabContent
                                    selectedSlide={selectedSlide as any}
                                    updateTimerSettings={updateTimerSettings}
                                    openModal={openModal}
                                    t={t as TFunction}
                                />
                            </div>
                        )}

                        {/* ══ Audio Tab ══ */}
                        {safeTab === 'audio' && (
                            <div className="p-3 animate-in fade-in duration-200">
                                <AudioTabContent
                                    scope={scope}
                                    mediaItem={mediaItem}
                                    selectedAudioScopeId={selectedAudioScopeId}
                                    updateAudioScope={updateAudioScope}
                                    removeAudioScope={removeAudioScope}
                                    selectAudioScope={selectAudioScope}
                                    t={t as TFunction}
                                />
                            </div>
                        )}

                        {/* ══ Transition Tab ══ */}
                        {safeTab === 'transition' && (selectedSlide || selectedTransId === 'presentation-end') && (
                            <div className="p-3 animate-in fade-in duration-200">
                                <TransitionTabContent
                                    selectedSlide={selectedTransId === 'presentation-end' ? undefined : selectedSlide}
                                    transition={selectedTransId === 'presentation-end' ? presentation?.endTransition : undefined}
                                    onUpdate={async (trans) => {
                                        if (selectedTransId === 'presentation-end') {
                                            await updatePresentationEndTransition(trans);
                                        } else if (selectedSlide) {
                                            await updateSlideTransition(selectedSlide.id, trans);
                                        }
                                    }}
                                    triggerTransitionPreview={triggerTransitionPreview}
                                />
                            </div>
                        )}

                        {/* ══ Video Tab ══ */}
                        {safeTab === 'video' && isVideoSlide && selectedSlide && (
                            <div className="p-3 animate-in fade-in duration-200">
                                <VideoTabContent
                                    settings={(selectedSlide as IVideoSlide).videoSettings}
                                    onUpdate={(updates) => {
                                        if (previewSlideId) updateVideoSettings(previewSlideId, updates);
                                    }}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};

export default SlideDesignPanel;
