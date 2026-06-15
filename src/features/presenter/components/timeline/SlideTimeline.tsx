import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useShallow } from 'zustand/react/shallow';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { 
    Trash2, Layers, Presentation, Copy, ArrowLeft, ArrowRight, LayoutTemplate, BookOpen,
    ChevronsLeft, ChevronsRight, Unplug, Scissors, Clipboard as ClipboardIcon, CopyPlus, Music
} from 'lucide-react';
import { ICanvasSlide, INestedSlide, ISlide } from '@/core/types';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useAtom, useSetAtom } from 'jotai';
import { appModeAtom, isTimelineHoveredAtom, latestInteractionAreaAtom, selectedTransitionSlideIdAtom, slideDesignPanelOpenAtom } from '@/core/store/uiAtoms';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { 
    DndContext, 
    DragOverlay, 
    closestCorners, 
    MeasuringStrategy 
} from '@dnd-kit/core';
import { IpcService } from '@/core/services/ipcService';
import { TrackContainerHandle } from './TrackContainer';
import { LibraryImportService } from '../../services/LibraryImportService';

// Modularized Components & Hooks
import { useTimelineLayout } from './hooks/useTimelineLayout';
import { useTimelineOperations } from './hooks/useTimelineOperations';
import { useMetadata } from '@/features/presenter/hooks/useMetadata';
import { useTimelineDragAndDrop } from './hooks/useTimelineDragAndDrop';
import { useTimelineShortcuts } from './hooks/useTimelineShortcuts';
import { TimelineToolbar } from './TimelineToolbar';
import { TimelineTrackHeaders } from './TimelineTrackHeaders';
import { TimelineSlideTrack } from './TimelineSlideTrack';
import { TimelineDragOverlayContent } from './TimelineDragOverlayContent';
import AudioTrack from './AudioTrack';
import { LiveMediaToolbar } from '../display/LiveMediaToolbar';

import { horizontalCollisionDetection } from './utils/horizontalCollisionDetection';

interface SlideTimelineProps {
    openProjector?: () => Promise<void>;
}

const SlideTimeline: React.FC<SlideTimelineProps> = ({ openProjector }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    
    // Store State & Actions
    // Actions (Stable selectors - no re-render)
    const setPreviewSlide = usePresentationStore(s => s.setPreviewSlide);
    const setLiveSlide = usePresentationStore(s => s.setLiveSlide);
    const updatePresentationSlides = usePresentationStore(s => s.updatePresentationSlides);
    const updateSlideBackground = usePresentationStore(s => s.updateSlideBackground);
    const toggleSlideExpansion = usePresentationStore(s => s.toggleSlideExpansion);
    const duplicateSlide = usePresentationStore(s => s.duplicateSlide);
    const duplicateSlides = usePresentationStore(s => s.duplicateSlides);
    const moveSlide = usePresentationStore(s => s.moveSlide);
    const removeSlide = usePresentationStore(s => s.removeSlide);
    const removeSlides = usePresentationStore(s => s.removeSlides);
    const addPresentationToTimeline = usePresentationStore(s => s.addPresentationToTimeline);
    const setSelectedSlideIds = usePresentationStore(s => s.setSelectedSlideIds);
    const toggleSlideSelection = usePresentationStore(s => s.toggleSlideSelection);
    const clearSelection = usePresentationStore(s => s.clearSelection);
    const copySlides = usePresentationStore(s => s.copySlides);
    const pasteSlides = usePresentationStore(s => s.pasteSlides);
    const selectAudioScope = usePresentationStore(s => s.selectAudioScope);
    const detachNestedInstance = usePresentationStore(s => s.detachNestedInstance);
    const takeSnapshot = usePresentationStore(s => s.takeSnapshot);

    // Dynamic State (Granular selectors)
    const activePresentationId = usePresentationStore(s => s.activePresentationId);
    const previewSlideId = usePresentationStore(s => s.previewSlideId);
    const liveSlideId = usePresentationStore(s => s.liveSlideId);
    const selectedSlideIds = usePresentationStore(s => s.selectedSlideIds);
    const selectedPresentationId = usePresentationStore(s => s.selectedPresentationId);
    const selectedPresentation = usePresentationStore(s => s.selectedPresentation);
    const navigationParentSlideId = usePresentationStore(s => s.navigationParentSlideId);
    const clipboard = usePresentationStore(s => s.clipboard);
    const audioClipboard = usePresentationStore(s => s.audioClipboard);
    const activePresentation = usePresentationStore(s => s.activePresentation);
    const pasteAudioScope = usePresentationStore(s => s.pasteAudioScope);

    const { openModal } = useModalStore();
    const trackRef = useRef<TrackContainerHandle>(null);
    
    // UI State Atoms
    const [appMode] = useAtom(appModeAtom);
    const [isTimelineHovered, setIsHovered] = useAtom(isTimelineHoveredAtom);
    const isTimelineHoveredRef = useRef(false);
    const [selectedTransId, setTransEditId] = useAtom(selectedTransitionSlideIdAtom);
    const selectedAudioId = usePresentationStore(s => s.selectedAudioScopeId);
    const [designPanelOpen] = useAtom(slideDesignPanelOpenAtom);
    const setLatestArea = useSetAtom(latestInteractionAreaAtom);

    // Local State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slideId: string; presentationId: string } | null>(null);
    const [nativeDropIndex, setNativeDropIndex] = useState<number | null>(null);
    const [localSlides, setLocalSlides] = useState<ISlide[]>([]);
    const [autoFollow, setAutoFollow] = useState(true);
    
    // Refs for optimization
    const dragActiveRef = useRef(false);

    useEffect(() => {
        isTimelineHoveredRef.current = isTimelineHovered;
    }, [isTimelineHovered]);

    const isSubItemSelected = !!selectedTransId || !!selectedAudioId;
    const isDetached = previewSlideId !== null && liveSlideId !== null && previewSlideId !== liveSlideId;

    // Database Queries
    const dbPresentation = useLiveQuery(
        () => activePresentationId ? db.presentationFiles.get(activePresentationId) : undefined,
        [activePresentationId]
    );

    const presentation = useMemo(() => {
        if (activePresentation?.id === activePresentationId) return activePresentation;
        return dbPresentation;
    }, [activePresentation, dbPresentation, activePresentationId]);

    useEffect(() => {
        if (!presentation?.slides) return;
        if (!dragActiveRef.current) {
            setLocalSlides(presentation.slides);
        }
    }, [presentation?.slides]);

    const expandedPresentationIds = useMemo(() => {
        return (presentation?.slides || [])
            .filter(s => s.isExpanded || s.id === navigationParentSlideId)
            .map(s => {
                const canvasSlide = s.type === 'normal' ? s as ICanvasSlide : null;
                const nestedSlide = s.type === 'nested' ? s as INestedSlide : null;
                return canvasSlide?.masterPresentationId || nestedSlide?.presentationId;
            })
            .filter(Boolean) as string[];
    }, [presentation?.slides, navigationParentSlideId]);

    const expandedPresentations = useLiveQuery(
        () => expandedPresentationIds.length > 0 ? db.presentationFiles.where('id').anyOf(expandedPresentationIds).toArray() : Promise.resolve([]),
        [expandedPresentationIds]
    ) || [];

    const presentationsMap = useMemo(() => {
        return new Map(expandedPresentations.map(p => [p.id, p]));
    }, [expandedPresentations]);

    // Metadata
    const { blocksMap, templatesMap, templates } = useMetadata();

    // Custom Hooks Logic Extraction
    const { visualTimeline } = useTimelineLayout({
        slides: presentation?.slides || [],
        activePresentationId,
        presentationsMap
    });

    const {
        handleAddSlide,
        handleAddTimer,
        handleAddVideo,
        handleRestoreTemplateBg,
        handleApplyBgToAll
    } = useTimelineOperations({
        activePresentationId,
        presentation,
        slides: presentation?.slides || [],
        previewSlideId,
        templatesMap,
        blocksMap,
        templates,
        t,
        updatePresentationSlides,
        setPreviewSlide,
        updateSlideBackground,
        openModal
    });

    const {
        activeId,
        sensors,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel
    } = useTimelineDragAndDrop({
        activePresentationId,
        slides: presentation?.slides || [],
        localSlides,
        setLocalSlides,
        selectedSlideIds,
        trackRef,
        dragActiveRef,
        updatePresentationSlides,
        addPresentationToTimeline,
        takeSnapshot
    });

    const copyAudioScope = usePresentationStore(s => s.copyAudioScope);
    const duplicateAudioScope = usePresentationStore(s => s.duplicateAudioScope);

    useTimelineShortcuts({
        activePresentationId,
        slides: presentation?.slides || [],
        selectedSlideIds,
        selectedAudioScopeId: selectedAudioId,
        previewSlideId,
        isTimelineHoveredRef,
        copySlides,
        pasteSlides,
        duplicateSlides,
        duplicateSlide,
        removeSlides,
        removeSlide,
        copyAudioScope,
        pasteAudioScope,
        duplicateAudioScope,
        setSelectedSlideIds,
        setLiveSlide,
        clearSelection
    });

    // Synchronization Effects
    useEffect(() => {
        if (appMode === 'presentation') {
            setAutoFollow(true);
        }
    }, [appMode]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const active = document.activeElement;
            if (active && (
                active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.getAttribute('contenteditable') === 'true'
            )) return;

            if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                setAutoFollow(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, []);

    useEffect(() => {
        if (appMode !== 'presentation') return;
        if (!liveSlideId) {
            LiveSyncService.clear();
            return;
        }
        
        const pres = (selectedPresentationId && selectedPresentation?.id === selectedPresentationId) 
            ? selectedPresentation 
            : (selectedPresentationId === activePresentationId ? activePresentation : activePresentation);
            
        let currentPresId = selectedPresentationId || activePresentationId;

        // Try to match based on the combination of liveSlideId and navigationParentSlideId
        const liveItem = visualTimeline.find(item => 
            item.id === liveSlideId && 
            (navigationParentSlideId ? item.parentSlideId === navigationParentSlideId : true)
        );

        if (liveItem?.slide) {
            LiveSyncService.showSlide(liveItem.slide, liveItem.presentationId, activePresentationId, liveItem.parentSlideId || null);
        } else {
            let slide = pres?.slides.find(s => s.id === liveSlideId);
            let currentPresId = selectedPresentationId || activePresentationId;

            // Fallback
            if (!slide) {
                slide = activePresentation?.slides.find(s => s.id === liveSlideId);
                if (slide) currentPresId = activePresentationId;
            }

            if (slide) {
                LiveSyncService.showSlide(slide, currentPresId!, activePresentationId, navigationParentSlideId);
            }
        }
    }, [liveSlideId, selectedPresentationId, selectedPresentation, activePresentationId, activePresentation, presentationsMap, visualTimeline, appMode, navigationParentSlideId]);
    
    // Sync preview slide to projector for preloading
    useEffect(() => {
        if (appMode !== 'presentation' || !previewSlideId) {
            LiveSyncService.showPreviewSlide(null);
            return;
        }

        const pres = (selectedPresentationId && selectedPresentation?.id === selectedPresentationId)
            ? selectedPresentation
            : (selectedPresentationId === activePresentationId ? activePresentation : activePresentation);
            
        let currentPresId = selectedPresentationId || activePresentationId;

        const previewItem = visualTimeline.find(item => 
            item.id === previewSlideId && 
            (navigationParentSlideId ? item.parentSlideId === navigationParentSlideId : true)
        );

        if (previewItem?.slide) {
            LiveSyncService.showPreviewSlide(previewItem.slide, previewItem.presentationId, activePresentationId, previewItem.parentSlideId || null);
        } else {
            let slide = pres?.slides.find(s => s.id === previewSlideId);
            let currentPresId = selectedPresentationId || activePresentationId;

            // Fallback
            if (!slide) {
                slide = activePresentation?.slides.find(s => s.id === previewSlideId);
                if (slide) currentPresId = activePresentationId;
            }

            if (slide) {
                LiveSyncService.showPreviewSlide(slide, currentPresId!, activePresentationId, navigationParentSlideId);
            }
        }
    }, [previewSlideId, selectedPresentationId, selectedPresentation, activePresentationId, activePresentation, presentationsMap, visualTimeline, appMode, navigationParentSlideId]);

    useEffect(() => {
        if (!IpcService.isElectron()) return;
        const unsub = IpcService.on('projector-ready', () => {
            if (appMode === 'presentation' && liveSlideId) {
                const liveItem = visualTimeline.find(item => 
                    item.id === liveSlideId && 
                    (navigationParentSlideId ? item.parentSlideId === navigationParentSlideId : true)
                );

                if (liveItem?.slide) {
                    LiveSyncService.showSlide(liveItem.slide, liveItem.presentationId, activePresentationId, liveItem.parentSlideId || null);
                } else {
                    const pres = (selectedPresentationId && selectedPresentation?.id === selectedPresentationId) 
                        ? selectedPresentation 
                        : (selectedPresentationId === activePresentationId ? activePresentation : activePresentation);
                        
                    const slide = pres?.slides.find(s => s.id === liveSlideId);
                    const currentPresId = slide ? (selectedPresentationId || activePresentationId) : null;

                    if (slide) {
                        LiveSyncService.showSlide(slide, currentPresId!, activePresentationId, navigationParentSlideId);
                    }
                }
            }
        });
        return () => unsub?.();
    }, [appMode, liveSlideId, visualTimeline, selectedPresentation, selectedPresentationId, activePresentation, activePresentationId, navigationParentSlideId]);

    useEffect(() => {
        if (autoFollow && previewSlideId) {
            let targetId = previewSlideId;
            
            if (navigationParentSlideId) {
                const parentSlide = localSlides.find(s => s.id === navigationParentSlideId);
                const masterId = parentSlide?.type === 'normal' 
                    ? (parentSlide as ICanvasSlide).masterPresentationId 
                    : (parentSlide?.type === 'nested' ? (parentSlide as INestedSlide).presentationId : undefined);
                
                if (masterId) {
                    const nestedPres = presentationsMap.get(masterId);
                    if (nestedPres && nestedPres.slides.length > 0 && nestedPres.slides[0].id === previewSlideId) {
                        targetId = navigationParentSlideId;
                    }
                }
            }
            
            trackRef.current?.scrollToSlide(targetId, navigationParentSlideId || undefined);
        }
    }, [autoFollow, previewSlideId, localSlides, designPanelOpen, navigationParentSlideId, presentationsMap]);

    const handleSelect = useCallback((id: string, multi: boolean, range?: boolean) => {
        if (multi || range) {
            toggleSlideSelection(id, multi, range);
            // Update preview without resetting the active multiselection
            usePresentationStore.setState({ previewSlideId: id });
        } else {
            setPreviewSlide(id, activePresentationId);
        }
        setTransEditId(null);
        selectAudioScope(null);
        setAutoFollow(true);
    }, [toggleSlideSelection, setPreviewSlide, activePresentationId, setTransEditId, selectAudioScope]);

    const handleLive = useCallback(async (id: string) => {
        const item = visualTimeline.find(i => i.id === id);
        if (item) {
             setLiveSlide(id, item.presentationId, activePresentationId, item.parentSlideId || null);
        } else {
             setLiveSlide(id);
        }
        if (openProjector) await openProjector();
    }, [setLiveSlide, openProjector, visualTimeline, activePresentationId]);

    // Always include space for the LiveMediaToolbar (48px) to avoid layout jumps
    const timelineHeight = 252 + 48;

    if (!activePresentationId) return null;

    return (
        <div
            data-timeline-root
            className="absolute bottom-0 left-0 right-0 bg-stone-900/60 backdrop-blur-xl border-t border-white/5 flex flex-col z-30 animate-in slide-in-from-bottom transition-all duration-300"
            style={{ height: timelineHeight, paddingRight: designPanelOpen ? 320 : 0 }}
            onPointerDown={() => setLatestArea('timeline')}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <TimelineToolbar
                t={t}
                slideCount={localSlides.length}
                isDetached={isDetached}
                handleAddSlide={handleAddSlide}
                handleAddTimer={handleAddTimer}
                handleAddVideo={handleAddVideo}
                openModal={openModal}
            />

            <div className="flex bg-stone-950/20 overflow-hidden flex-1 relative">
                <TimelineTrackHeaders t={t} hasSlides={localSlides.length > 0} type="both" />
                
                <DndContext
                    sensors={sensors}
                    collisionDetection={horizontalCollisionDetection}
                    autoScroll={false}
                    measuring={{
                        droppable: {
                            strategy: MeasuringStrategy.WhileDragging,
                        },
                    }}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                >
                    <TimelineSlideTrack
                        localSlides={localSlides}
                        visualTimeline={visualTimeline}
                        handleDragStart={handleDragStart}
                        handleDragOver={handleDragOver}
                        handleDragEnd={handleDragEnd}
                        handleDragCancel={handleDragCancel}
                        handleAddSlide={handleAddSlide}
                        addPresentationToTimeline={addPresentationToTimeline}
                        setNativeDropIndex={setNativeDropIndex}
                        trackRef={trackRef}
                        onUserScroll={() => setAutoFollow(false)}
                        activePresentationId={activePresentationId}
                        previewSlideId={previewSlideId}
                        liveSlideId={liveSlideId}
                        selectedSlideIds={selectedSlideIds}
                        selectedPresentationId={selectedPresentationId}
                        isDetached={isDetached}
                        templatesMap={templatesMap}
                        blocksMap={blocksMap}
                        presentationsMap={presentationsMap}
                        navigationParentSlideId={navigationParentSlideId}
                        lang={lang}
                        setPreviewSlide={setPreviewSlide}
                        setLiveSlide={handleLive}
                        toggleSlideSelection={handleSelect}
                        toggleSlideExpansion={toggleSlideExpansion}
                        setContextMenu={setContextMenu}
                        isSubItemSelected={isSubItemSelected}
                        dragActiveId={activeId}
                        audioTrack={<AudioTrack visualTimeline={visualTimeline} />}
                    >
                        {nativeDropIndex === localSlides.length && (
                            <div className="w-32 h-[72px] shrink-0 rounded-xl relative overflow-hidden transition-all duration-300 transform animate-in zoom-in-95 opacity-80 outline-dashed outline-2 outline-accent outline-offset-1 flex items-center justify-center bg-accent/20 shadow-[0_0_15px_rgba(var(--accent-rgb, 147, 51, 234),0.2)]">
                                <Presentation className="w-8 h-8 text-accent animate-pulse" />
                            </div>
                        )}
                    </TimelineSlideTrack>

                    {createPortal(
                        <DragOverlay zIndex={9999}>
                            <TimelineDragOverlayContent
                                activeId={activeId}
                                selectedSlideIds={selectedSlideIds}
                                localSlides={localSlides}
                                templatesMap={templatesMap}
                                blocksMap={blocksMap}
                                lang={lang}
                            />
                        </DragOverlay>,
                        document.body
                    )}
                </DndContext>
            </div>

            {/* Lane 3: Live Media Toolbar (Appears seamlessly only when video is live) */}
            {(() => {
                const liveItem = liveSlideId ? visualTimeline.find(item => item.id === liveSlideId) : null;
                return (
                    <LiveMediaToolbar 
                        liveSlide={liveItem?.slide} 
                        presentationId={liveItem?.presentationId} 
                    />
                );
            })()}

            {localSlides.length === 0 && (
                <div className="absolute inset-0 top-10 flex items-center justify-center gap-4 text-stone-700 italic pointer-events-none">
                    <Layers className="w-6 h-6 opacity-20" />
                    <span className="text-xs">{t('timeline_empty_hint', 'Add slides from the toolbar or drag blocks here.')}</span>
                </div>
            )}

            {/* Context Menu Overlay */}
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

                    <ContextMenuItem
                        icon={<Music className="w-4 h-4" />}
                        label={t('paste_audio', 'Paste Audio')}
                        disabled={!audioClipboard}
                        onClick={() => {
                            pasteAudioScope(contextMenu.slideId);
                            setContextMenu(null);
                        }}
                    />

                    <ContextMenuItem
                        icon={<CopyPlus className="w-4 h-4" />}
                        label={t('import_slides_from_file', 'Import Slides from File...')}
                        onClick={() => {
                            const slidesArr = presentationsMap.get(contextMenu.presentationId)?.slides || [];
                            const targetIdx = slidesArr.findIndex(s => s.id === contextMenu.slideId) + 1;
                            LibraryImportService.selectAndImportSlides(contextMenu.presentationId, targetIdx, t);
                            setContextMenu(null);
                        }}
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

export default React.memo(SlideTimeline);
