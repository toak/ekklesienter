import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import {
    selectedCanvasItemIdsAtom,
    editingCanvasItemIdAtom,
    canvasToolAtom,
    slideDesignPanelOpenAtom,
    slideEditorDragActiveAtom,
    slideEditorPendingUpdateAtom,
    slideDesignHoveredAtom,
    slideDesignTabAtom,
    SlideDesignTab,
    selectedTransitionSlideIdAtom
} from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore } from '@/core/store/modalStore';
import { ImageIcon, Layers, Clock, Copy, Palette, Music, X, Wand2, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { BackgroundPicker } from './slide-properties/BackgroundPicker';
import { ICanvasItem, ICanvasItemText, IStyleLayer, ICanvasSlide } from '@/core/types';
import type { TFunction } from 'i18next';
import { ensureLayers } from '@/core/utils/styleMigration';
import { getUniqueSelectionStyles, calculateStyleUpdates } from '../utils/styleExtraction';
import { toast } from '@/core/utils/toast';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import {
    type DesignTab, createCanvasItem,
    LayerItem, TemplatePicker, ItemProperties,
    TimerTabContent, AudioTabContent, ElementsTabContent, TransitionTabContent,
} from './slide-properties';

const SlideDesignPanel: React.FC = () => {
    const { t, i18n } = useTranslation();
    const isRu = (i18n.language?.substring(0, 2) || 'en') === 'ru';
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
        selectedPresentationId, previewSlideId, updateSlideVariable, updateSlideBackground,
        addCanvasItem, updateCanvasItem, updateCanvasItems: batchUpdateCanvasItems,
        updateCanvasItemsOrder, removeCanvasItem, updatePresentationSlides, takeSnapshot,
        selectedAudioScopeId, selectAudioScope, activePresentation, selectedPresentation,
        updateAudioScope, removeAudioScope, applyBackgroundToAll, updateTimerSettings,
        updateSlideTransition, triggerTransitionPreview, updatePresentationEndTransition,
    } = usePresentationStore();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // ─── Auto-tab effects ───
    useEffect(() => { if (selectedItemId) { setActiveTab('style'); setPanelOpen(true); } }, [selectedItemId, setPanelOpen, setActiveTab]);

    useEffect(() => {
        // If we have a slide but no transition or audio selected, default to slide tabs (background/style/etc)
        const isSlideTab = ['style', 'background', 'elements', 'transition', 'timer'].includes(activeTab);

        if (previewSlideId && !selectedAudioScopeId && !selectedTransId) {
            if (!isSlideTab || activeTab === 'audio' || activeTab === 'transition') {
                setActiveTab('style');
                setPanelOpen(true);
            }
        }
    }, [previewSlideId, selectedAudioScopeId, selectedTransId, setActiveTab, setPanelOpen, activeTab]);

    useEffect(() => { if (selectedAudioScopeId) { setActiveTab('audio'); setPanelOpen(true); } }, [selectedAudioScopeId, setPanelOpen, setActiveTab]);
    useEffect(() => {
        if (selectedTransId) {
            setActiveTab('transition');
            setPanelOpen(true);
        }
    }, [selectedTransId, setActiveTab, setPanelOpen]);

    // ─── Data queries ───
    const dbPresentation = useLiveQuery(() => selectedPresentationId ? db.presentationFiles.get(selectedPresentationId) : undefined, [selectedPresentationId]);
    const presentation = selectedPresentation || dbPresentation;

    const allTemplates = useLiveQuery(() => db.templates.toArray()) || [];
    const allBlocks = useLiveQuery(() => db.blocks.toArray()) || [];
    const templatesMap = useMemo(() => new Map(allTemplates.map(t => [t.id, t])), [allTemplates]);
    const selectedSlide = useMemo(() => presentation?.slides?.find(s => s.id === previewSlideId), [presentation, previewSlideId]);
    const template = selectedSlide ? templatesMap.get(selectedSlide.templateId) : undefined;
    const slideBg = selectedSlide?.type === 'normal' ? (selectedSlide as ICanvasSlide).backgroundOverride || template?.background : template?.background;
    const dbCanvasItems = selectedSlide?.type === 'normal' ? (selectedSlide as ICanvasSlide).content?.canvasItems : undefined;
    const [localItems, setLocalItems] = useState<ICanvasItem[]>([]);

    useEffect(() => {
        if (!dragActive && !pendingUpdate) { setLocalItems(dbCanvasItems || []); }
        else if (pendingUpdate) { const timer = setTimeout(() => setPendingUpdate(false), 1000); return () => clearTimeout(timer); }
    }, [dbCanvasItems, dragActive, pendingUpdate, setPendingUpdate]);

    // ─── Selection styles (for "Selected Colors" section) ───
    const selectionStyles = useMemo(() => selectedIds.length > 0 ? getUniqueSelectionStyles(selectedIds, localItems) : [], [selectedIds, localItems]);

    const handleSelectionStyleUpdate = useCallback((oldLayer: IStyleLayer, updates: Partial<IStyleLayer>) => {
        if (!previewSlideId) return;
        const allUpdates = calculateStyleUpdates(selectedIds, localItems, oldLayer, updates);
        if (allUpdates.length > 0) batchUpdateCanvasItems(previewSlideId, allUpdates);
    }, [previewSlideId, selectedIds, localItems, batchUpdateCanvasItems]);

    // ─── Audio scope data ───
    const scope = useMemo(() => {
        if (!selectedAudioScopeId) return undefined;
        const slides = presentation?.slides || activePresentation?.slides;
        if (!slides) return undefined;
        for (const s of slides) { 
            if (s.type === 'normal') {
                const found = (s as ICanvasSlide).audioScopes?.find(scp => scp.id === selectedAudioScopeId); 
                if (found) return found; 
            }
        }
        return undefined;
    }, [selectedAudioScopeId, presentation?.slides, activePresentation?.slides]);

    const mediaItem = useLiveQuery(async () => {
        if (!scope?.fileId) return undefined;
        const byId = await db.mediaPool.get(scope.fileId);
        if (byId) return byId;
        return db.mediaPool.filter(item => item.path === scope.fileId).first();
    }, [scope?.fileId]);

    if (!panelOpen && !selectedAudioScopeId) return null;

    // ─── Tab configuration ───
    const tabs: { id: SlideDesignTab; icon: React.ElementType; label: string }[] = [
        ...((selectedSlide?.type === 'timer' || (selectedSlide?.type === 'normal' && (selectedSlide as ICanvasSlide).timerSettings)) ? [{ id: 'timer' as DesignTab, icon: Clock, label: t('timer', 'Timer') }] : []),
        { id: 'background' as DesignTab, icon: ImageIcon, label: t('background', 'Background') },
        { id: 'elements' as DesignTab, icon: Layers, label: t('elements', 'Elements') },
        ...(selectedTransId ? [{ id: 'transition' as DesignTab, icon: ArrowRightLeft, label: t('transition', 'Transition') }] : []),
        ...((selectedAudioScopeId || selectedSlide?.type === 'timer' || selectedTransId) ? [] : [{ id: 'style' as DesignTab, icon: Palette, label: selectedItemId ? t('properties', 'Properties') : t('design', 'Design') }]),
        ...(selectedAudioScopeId ? [{ id: 'audio' as DesignTab, icon: Music, label: t('audio', 'Audio') }] : []),
    ];

    // ─── Handlers ───
    const handleBgChange = (bg: IStyleLayer[]) => { if (previewSlideId) updateSlideBackground(previewSlideId, bg as never); };
    const handleAddElement = (type: string) => { if (previewSlideId) addCanvasItem(previewSlideId, createCanvasItem(type as never)); };
    const updateCanvasItemLocal = (id: string, updates: Partial<ICanvasItem>) => { if (previewSlideId) updateCanvasItem(previewSlideId, id, updates); };
    const handleRemoveItem = (itemId: string) => { if (previewSlideId) removeCanvasItem(previewSlideId, itemId); if (selectedItemId === itemId) setSelectedIds([]); };

    const setSlideDesignHovered = useSetAtom(slideDesignHoveredAtom);

    return (
        <div
            className={cn(
                "fixed right-0 top-0 bottom-0 w-[460px] bg-[#0c0a09]/95 backdrop-blur-2xl z-40 flex flex-col transition-transform duration-500 ease-out border-l border-white/5",
                panelOpen || selectedAudioScopeId ? "translate-x-0" : "translate-x-full"
            )}
            onMouseEnter={() => setSlideDesignHovered(true)}
            onMouseLeave={() => setSlideDesignHovered(false)}
        >
            {/* ─── Header ─── */}
            <div className="px-4 pt-4 pb-0 shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                            <Palette className="w-4 h-4 text-accent" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white tracking-tight leading-none">
                                {t('slide_design', 'Slide Design')}
                            </h2>
                            <p className="text-[9px] text-stone-600 uppercase tracking-[0.2em] font-bold mt-1">{t('slide_editor', 'Slide Editor')}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setPanelOpen(false); selectAudioScope(null); setSelectedTransId(null); }}
                        className="p-2 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl text-stone-500 transition-all border border-white/5 active:scale-95 cursor-pointer"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ─── Segmented Tab Control ─── */}
            <div className="px-4 pb-3 border-b border-white/5 shrink-0">
                <div className="bg-white/3 rounded-2xl border border-white/5 p-1 flex gap-1 shadow-inner">
                    {tabs.map(({ id, icon: Icon, label }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={cn(
                                "flex-1 flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-xl transition-all duration-200 relative group cursor-pointer",
                                activeTab === id
                                    ? "text-accent bg-accent/10"
                                    : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
                            )}
                            title={label}
                        >
                            <Icon className={cn("w-5 h-5 transition-transform duration-300", activeTab === id && "scale-110")} />
                        </button>
                    ))}
                </div>
            </div>

            {/* ─── Content ─── */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6">
                {/* ═══ Timer Tab ═══ */}
                {activeTab === 'timer' && (selectedSlide?.type === 'timer' || selectedSlide?.type === 'normal') && (
                    <TimerTabContent selectedSlide={selectedSlide as any} updateTimerSettings={updateTimerSettings} openModal={openModal} t={t as TFunction} />
                )}

                {/* ═══ Audio Tab ═══ */}
                {activeTab === 'audio' && (
                    <AudioTabContent scope={scope} mediaItem={mediaItem} selectedAudioScopeId={selectedAudioScopeId} updateAudioScope={updateAudioScope} removeAudioScope={removeAudioScope} selectAudioScope={selectAudioScope} t={t as TFunction} />
                )}

                {/* ═══ Transition Tab ═══ */}
                {activeTab === 'transition' && (selectedSlide || selectedTransId === 'presentation-end') && (
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
                )}

                {/* ═══ Non-audio content ═══ */}
                {activeTab !== 'audio' && !selectedSlide ? (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
                        <Layers className="w-10 h-10 text-stone-800" strokeWidth={1} />
                        <p className="text-xs text-stone-700 italic">{t('select_slide_to_edit', 'Select a slide to edit')}</p>
                    </div>
                ) : activeTab !== 'audio' && activeTab !== 'timer' && (
                    <div className="pb-4 space-y-6">
                        {/* ═══ Background Tab ═══ */}
                        {activeTab === 'background' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em]">{t('slide_background', 'Slide Background')}</span>
                                    <button onClick={async () => { const bg = ensureLayers(slideBg); await applyBackgroundToAll(bg); toast.success(t('background_applied_to_all', 'Background applied to all slides')); }} className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-xl border border-accent/20 transition-all cursor-pointer group">
                                        <Copy className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                        <span className="text-[9px] font-bold uppercase tracking-wider">{t('apply_to_all', 'Apply to All')}</span>
                                    </button>
                                </div>
                                <BackgroundPicker background={slideBg || { type: 'color', color: '#000000' }} onChange={handleBgChange} />
                            </div>
                        )}

                        {/* ═══ Elements Tab ═══ */}
                        {activeTab === 'elements' && (
                            <ElementsTabContent
                                localItems={localItems} setLocalItems={setLocalItems} selectedItemId={selectedItemId}
                                sensors={sensors} setDragActive={setDragActive} setPendingUpdate={setPendingUpdate}
                                previewSlideId={previewSlideId} updateCanvasItemsOrder={updateCanvasItemsOrder}
                                setSelectedIds={setSelectedIds} updateCanvasItemLocal={updateCanvasItemLocal}
                                handleRemoveItem={handleRemoveItem} handleAddElement={handleAddElement}
                                addCanvasItem={addCanvasItem} isRu={isRu} t={t as TFunction}
                            />
                        )}

                        {/* ═══ Design/Style Tab ═══ */}
                        {activeTab === 'style' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                                {selectedIds.length > 0 ? (
                                    <>
                                        <ItemProperties
                                            selectedIds={selectedIds}
                                            canvasItems={localItems}
                                            updateCanvasItems={(idList, updates) => {
                                                const allUpdates = idList.map(id => {
                                                    const item = localItems.find(i => i.id === id);
                                                    if (!item) return null;
                                                    const finalUpdates = { ...updates };
                                                    if (updates.text && item.text) finalUpdates.text = { ...item.text, ...updates.text };
                                                    if (updates.shape && item.shape) finalUpdates.shape = { ...item.shape, ...updates.shape };
                                                    return { id, updates: finalUpdates };
                                                }).filter(Boolean) as Array<{ id: string; updates: Partial<ICanvasItem> }>;
                                                if (allUpdates.length > 0) batchUpdateCanvasItems(previewSlideId!, allUpdates);
                                            }}
                                            isPreview={true}
                                            t={t as never}
                                        />
                                        {selectionStyles.length > 1 && (
                                            <div className="space-y-3 mt-6">
                                                <div className="flex items-center gap-2 px-1">
                                                    <div className="w-1 h-3 bg-accent/40 rounded-full" />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">{t('selection_colors', 'Selection Colors')}</span>
                                                </div>
                                                <div className="flex flex-col gap-2 bg-black/20 p-2 rounded-2xl border border-white/5">
                                                    {selectionStyles.map((layer, idx) => (
                                                        <LayerItem key={layer.id || idx} layer={layer} index={idx} total={selectionStyles.length} onUpdate={(updates) => handleSelectionStyleUpdate(layer, updates)} onRemove={() => { }} hideHandle={true} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <TemplatePicker allTemplates={allTemplates} allBlocks={allBlocks} currentSlide={selectedSlide} presentation={presentation} updatePresentationSlides={updatePresentationSlides} isRu={isRu} t={t as never} />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SlideDesignPanel;
