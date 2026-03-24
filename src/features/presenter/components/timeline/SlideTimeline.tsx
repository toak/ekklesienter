import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { 
    Trash2, Layers, Presentation, Copy, ArrowLeft, ArrowRight, LayoutTemplate, BookOpen,
    ChevronsLeft, ChevronsRight, Unplug, Scissors, Clipboard as ClipboardIcon, CopyPlus
} from 'lucide-react';
import { ICanvasSlide, INestedSlide, ISlide } from '@/core/types';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useAtom, useSetAtom } from 'jotai';
import { appModeAtom, isTimelineHoveredAtom, selectedTransitionSlideIdAtom } from '@/core/store/uiAtoms';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { IpcService } from '@/core/services/IpcService';
import { TrackContainerHandle } from './TrackContainer';

// Modularized Components & Hooks
import { useTimelineLayout } from './hooks/useTimelineLayout';
import { useTimelineOperations } from './hooks/useTimelineOperations';
import { useTimelineDragAndDrop } from './hooks/useTimelineDragAndDrop';
import { useTimelineShortcuts } from './hooks/useTimelineShortcuts';
import { TimelineToolbar } from './TimelineToolbar';
import { TimelineTrackHeaders } from './TimelineTrackHeaders';
import { TimelineSlideTrack } from './TimelineSlideTrack';
import { TimelineDragOverlayContent } from './TimelineDragOverlayContent';
import AudioTrack from './AudioTrack';

/**
 * SlideTimeline - Orchestrator component for the presentation timeline.
 * Manages state, layout, drag-and-drop, and keyboard shortcuts by coordinating 
 * specialized hooks and sub-components.
 */
const SlideTimeline: React.FC = () => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    
    // Store State & Actions
    const {
        activePresentationId,
        previewSlideId,
        liveSlideId,
        setPreviewSlide,
        setLiveSlide,
        updatePresentationSlides,
        updateSlideBackground,
        toggleSlideExpansion,
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
        selectedPresentationId,
        navigationParentSlideId,
        selectAudioScope,
        detachNestedInstance,
        clipboard,
        activePresentation
    } = usePresentationStore();

    const { openModal } = useModalStore();
    const trackRef = useRef<TrackContainerHandle>(null);
    
    // UI State Atoms
    const [appMode] = useAtom(appModeAtom);
    const [isTimelineHovered, setIsHovered] = useAtom(isTimelineHoveredAtom);
    const isTimelineHoveredRef = useRef(false);
    const [selectedTransId, setTransEditId] = useAtom(selectedTransitionSlideIdAtom);
    const selectedAudioId = usePresentationStore(s => s.selectedAudioScopeId);

    // Local State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slideId: string; presentationId: string } | null>(null);
    const [nativeDropIndex, setNativeDropIndex] = useState<number | null>(null);
    const [localSlides, setLocalSlides] = useState<ISlide[]>([]);
    
    // Refs for optimization
    const dragActiveRef = useRef(false);
    const pendingUpdateRef = useRef(false);

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
        if (!dragActiveRef.current && !pendingUpdateRef.current) {
            setLocalSlides(presentation.slides);
        } else if (pendingUpdateRef.current) {
            const timer = setTimeout(() => {
                pendingUpdateRef.current = false;
                setLocalSlides(presentation.slides);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [presentation?.slides]);

    const expandedPresentationIds = useMemo(() => {
        return (presentation?.slides || [])
            .filter(s => s.isExpanded)
			.map(s => {
				if (s.type === 'normal') return (s as ICanvasSlide).masterPresentationId;
				if (s.type === 'nested') return (s as INestedSlide).presentationId;
				return undefined;
			})
            .filter(Boolean) as string[];
    }, [presentation?.slides]);

    const expandedPresentations = useLiveQuery(
        () => expandedPresentationIds.length > 0 ? db.presentationFiles.where('id').anyOf(expandedPresentationIds).toArray() : Promise.resolve([]),
        [expandedPresentationIds]
    ) || [];

    const presentationsMap = useMemo(() => {
        return new Map(expandedPresentations.map(p => [p.id, p]));
    }, [expandedPresentations]);

    const blocks = useLiveQuery(() => db.blocks.toArray()) || [];
    const blocksMap = useMemo(() => new Map(blocks.map(b => [b.id, b])), [blocks]);

    const templates = useLiveQuery(() => db.templates.toArray()) || [];
    const templatesMap = useMemo(() => new Map(templates.map(t => [t.id, t])), [templates]);

    // Custom Hooks Logic Extraction
    const { visualTimeline } = useTimelineLayout({
        slides: presentation?.slides || [],
        activePresentationId,
        presentationsMap
    });

    const {
        handleAddSlide,
        handleAddTimer,
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
        handleDragMove,
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
        pendingUpdateRef,
        updatePresentationSlides,
        addPresentationToTimeline
    });

    useTimelineShortcuts({
        activePresentationId,
        slides: presentation?.slides || [],
        selectedSlideIds,
        previewSlideId,
        isTimelineHoveredRef,
        copySlides,
        pasteSlides,
        duplicateSlides,
        duplicateSlide,
        removeSlides,
        removeSlide,
        setSelectedSlideIds,
        clearSelection
    });

    // Synchronization Effects
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

    useEffect(() => {
        if (!IpcService.isElectron()) return;
        const unsub = IpcService.on('projector-ready', () => {
            if (appMode === 'presentation' && liveSlideId) {
                const liveItem = visualTimeline.find(item => item.id === liveSlideId);
                if (liveItem?.slide) LiveSyncService.showSlide(liveItem.slide);
            }
        });
        return () => unsub?.();
    }, [appMode, liveSlideId, visualTimeline]);

    useEffect(() => {
        if (previewSlideId) trackRef.current?.scrollToSlide(previewSlideId);
    }, [previewSlideId]);

    const handleSelect = useCallback((id: string, multi: boolean, range?: boolean) => {
        toggleSlideSelection(id, multi, range);
        setPreviewSlide(id, activePresentationId);
        setTransEditId(null);
        selectAudioScope(null);
    }, [toggleSlideSelection, setPreviewSlide, activePresentationId, setTransEditId, selectAudioScope]);

    if (!activePresentationId) return null;

    return (
        <div
            data-timeline-root
            className="absolute bottom-0 left-0 right-0 bg-stone-900/60 backdrop-blur-xl border-t border-white/5 flex flex-col z-30 animate-in slide-in-from-bottom duration-500"
            style={{ height: 236 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <TimelineToolbar
                t={t}
                slideCount={localSlides.length}
                isDetached={isDetached}
                handleAddSlide={handleAddSlide}
                handleAddTimer={handleAddTimer}
                openModal={openModal}
            />

            <div className="flex bg-stone-950/20 overflow-hidden flex-1 relative">
                <TimelineTrackHeaders t={t} hasSlides={localSlides.length > 0} />
                
                <TimelineSlideTrack
                    localSlides={localSlides}
                    visualTimeline={visualTimeline}
                    sensors={sensors}
                    handleDragStart={handleDragStart}
                    handleDragOver={handleDragOver}
                    handleDragEnd={handleDragEnd}
                    handleDragCancel={handleDragCancel}
                    handleDragMove={handleDragMove}
                    handleAddSlide={handleAddSlide}
                    addPresentationToTimeline={addPresentationToTimeline}
                    setNativeDropIndex={setNativeDropIndex}
                    trackRef={trackRef}
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
                    setLiveSlide={setLiveSlide}
                    toggleSlideSelection={handleSelect}
                    toggleSlideExpansion={toggleSlideExpansion}
                    setContextMenu={setContextMenu}
                    isSubItemSelected={isSubItemSelected}
                    dragActiveId={activeId}
                >
                    {nativeDropIndex === localSlides.length && (
                        <div className="w-32 h-[72px] shrink-0 rounded-xl relative overflow-hidden transition-all duration-300 transform animate-in zoom-in-95 opacity-80 outline-dashed outline-2 outline-accent outline-offset-1 flex items-center justify-center bg-accent/20 shadow-[0_0_15px_rgba(var(--accent-rgb, 147, 51, 234),0.2)]">
                            <Presentation className="w-8 h-8 text-accent animate-pulse" />
                        </div>
                    )}

                    <TimelineDragOverlayContent
                        activeId={activeId}
                        selectedSlideIds={selectedSlideIds}
                        localSlides={localSlides}
                        templatesMap={templatesMap}
                        blocksMap={blocksMap}
                        lang={lang}
                    />
                </TimelineSlideTrack>
            </div>

            {/* Lane 2: Audio (Fixed height container) */}
            {localSlides.length > 0 && (
                <div className="flex items-center px-8 pt-[10px] pb-4 shrink-0 overflow-visible h-[98px] border-t border-white/5 bg-stone-950/20">
                    <AudioTrack visualTimeline={visualTimeline} />
                </div>
            )}

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
