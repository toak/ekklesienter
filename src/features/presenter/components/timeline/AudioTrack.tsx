import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { IAudioScope, ISlide, ICanvasSlide, ITimerSlide } from '@/core/types';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { Music, Plus } from 'lucide-react';
import AudioScopeBlock from './AudioScopeBlock';
import TimerAudioClip from './TimerAudioClip';
import { findOverlappingScopes } from '../../utils/timelineUtils';

/** Width of each slide tile in the timeline (matches SlideTimeline w-32 = 128px) */
const TILE_WIDTH = 128;
/** Gap between tiles in the timeline (matches gap-3 = 12px) */
const TILE_GAP = 12;

interface AudioTrackProps {
    visualTimeline: Array<{
        id: string,
        width: number,
        x: number,
        type: 'slide' | 'nested' | 'edit-button' | 'spacer',
        slide?: ISlide,
        presentationId?: string,
        parentSlideId?: string
    }>;
}

const AudioTrack: React.FC<AudioTrackProps> = ({ visualTimeline }) => {
    const { t } = useTranslation();
    const { openModal } = useModalStore();
    const { addAudioScope } = usePresentationStore();
    const [hoveredSlotIdx, setHoveredSlotIdx] = React.useState<number | null>(null);

    // Map slide IDs to their first visual index for scope resolution
    const slideToIndexMap = useMemo(() => {
        const map = new Map<string, number>();
        visualTimeline.forEach((item, idx) => {
            if (item.slide) {
                map.set(item.slide.id, idx);
            }
        });
        return map;
    }, [visualTimeline]);

    // Collect all audio scopes from all visible slides in the timeline
    const allScopes = useMemo(() => {
        const scopes: Array<{ scope: IAudioScope; startIdx: number; endIdx: number }> = [];
        const seenScopeIds = new Set<string>();

        visualTimeline.forEach((item, idx) => {
            if (item.slide?.type === 'normal') {
                const canvasSlide = item.slide as ICanvasSlide;
                if (canvasSlide.audioScopes) {
                    for (const scope of canvasSlide.audioScopes) {
                        if (seenScopeIds.has(scope.id)) continue;

                        const sIdx = slideToIndexMap.get(scope.startSlideId);
                        const eIdx = slideToIndexMap.get(scope.endSlideId);

                        if (sIdx !== undefined && eIdx !== undefined) {
                            scopes.push({ scope, startIdx: sIdx, endIdx: eIdx });
                            seenScopeIds.add(scope.id);
                        }
                    }
                }
            }
        });
        return scopes;
        // AI Fix: Only depend on the identity and count of items in visualTimeline, plus the slideToIndexMap
    }, [visualTimeline.length, slideToIndexMap]);

    const [isDraggingOver, setIsDraggingOver] = React.useState(false);

    // ── Drag and Drop ─────────────────────────────────────────────────
    const handleDragOver = useCallback((e: React.DragEvent) => {
        const hasAudio = Array.from(e.dataTransfer.items).some(
            item => (item.kind === 'file' && item.type.startsWith('audio/')) ||
                (item.type === 'application/json')
        );
        if (hasAudio) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setIsDraggingOver(true);
        }
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;

        let foundIdx = -1;
        for (let i = 0; i < visualTimeline.length; i++) {
            const item = visualTimeline[i];
            if (relativeX >= item.x && relativeX <= item.x + item.width) {
                foundIdx = i;
                break;
            }
        }
        setHoveredSlotIdx(foundIdx !== -1 ? foundIdx : null);
    }, [visualTimeline]);

    const handleMouseLeave = useCallback((e: React.DragEvent) => {
        setIsDraggingOver(false);
    }, []);

    const handleMouseLeaveContainer = useCallback(() => {
        setHoveredSlotIdx(null);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingOver(false);

        // Handle native files
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));

        // Handle Media Pool items
        let mediaPoolAudioPath: string | null = null;
        try {
            const jsonData = e.dataTransfer.getData('application/json');
            if (jsonData) {
                const data = JSON.parse(jsonData);
                if (data.source === 'media-pool' && data.media.type === 'audio') {
                    mediaPoolAudioPath = data.media.path;
                }
            }
        } catch (err) {
            // Not JSON or wrong format
        }

        if (files.length === 0 && !mediaPoolAudioPath) return;
        if (visualTimeline.length === 0) return;

        // Determine which slot the drop landed on based on X position
        const rect = e.currentTarget.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;

        let targetSlotIdx = -1;
        for (let i = 0; i < visualTimeline.length; i++) {
            const item = visualTimeline[i];
            // Since elements in Lane 1 are positioned with absolute-like logic (p-4 + gaps),
            // and we share the same parent scroll, relativeX is directly comparable to item.x
            // BUT relativeX is 0 at the start of AudioTrack component.
            // visualTimeline.x is also relative to the container (p-4).
            // So they are perfectly aligned.

            if (relativeX >= item.x && relativeX <= item.x + item.width) {
                targetSlotIdx = i;
                break;
            }
        }

        // If no direct hit, find nearest slide if possible
        if (targetSlotIdx === -1) {
            let minDistance = Infinity;
            visualTimeline.forEach((item, idx) => {
                if (item.slide) {
                    const center = item.x + item.width / 2;
                    const dist = Math.abs(relativeX - center);
                    if (dist < minDistance) {
                        minDistance = dist;
                        targetSlotIdx = idx;
                    }
                }
            });
        }

        const targetItem = targetSlotIdx !== -1 ? visualTimeline[targetSlotIdx] : null;
        const targetSlideId = targetItem?.slide?.id;
        if (!targetSlideId) return;

        // Process files (Electron provides .path on dropped File objects)
        for (const file of files) {
            const filePath = (file as unknown as { path: string }).path || file.name;
            await addAudioScope(targetSlideId, filePath, file.name);
        }

        if (mediaPoolAudioPath) {
            const jsonData = e.dataTransfer.getData('application/json');
            let name = mediaPoolAudioPath.split(/[/\\]/).pop() || 'Audio Track';
            try {
                const data = JSON.parse(jsonData);
                if (data.media?.name) name = data.media.name;
            } catch (e) { }

            // Check for overlaps (assume 1 slide span for new drop)
            const overlaps = findOverlappingScopes(targetSlotIdx, targetSlotIdx, visualTimeline, slideToIndexMap);

            if (overlaps.length > 0) {
                openModal(ModalType.AUDIO_CONFLICT, {
                    targetSlideId,
                    fileId: mediaPoolAudioPath,
                    overlappingScopes: overlaps
                });
            } else {
                await addAudioScope(targetSlideId, mediaPoolAudioPath, name);
            }
        }
    }, [visualTimeline, addAudioScope, slideToIndexMap, openModal]);

    // Calculate total width based on the visual model
    const totalWidth = useMemo(() => {
        if (visualTimeline.length === 0) return 0;
        const lastItem = visualTimeline[visualTimeline.length - 1];
        return lastItem.x + lastItem.width;
    }, [visualTimeline]);

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeaveContainer}
            onDrop={handleDrop}
            className={cn(
                'relative shrink-0 transition-all rounded-xl border-2',
                isDraggingOver ? 'border-purple-500/50 bg-purple-500/10' : 'border-transparent'
            )}
            style={{
                height: 72,
                width: totalWidth || '100%',
                minWidth: totalWidth || '100%',
            }}
        >
            {isDraggingOver && allScopes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none text-purple-400">
                    <Music className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{t('drop_audio_here', 'Drop Audio Here')}</span>
                </div>
            )}

            {/* Hover Highlight & Plus Button */}
            {!isDraggingOver &&
                hoveredSlotIdx !== null &&
                visualTimeline[hoveredSlotIdx]?.type === 'slide' &&
                visualTimeline[hoveredSlotIdx]?.slide &&
                !allScopes.some(s => s.startIdx <= (hoveredSlotIdx || -1) && s.endIdx >= (hoveredSlotIdx || -1)) &&
                !((visualTimeline[hoveredSlotIdx]?.slide as ITimerSlide)?.playlist?.length) && (
                    <div
                        className="absolute top-1 bottom-1 border-2 border-dashed border-purple-500/30 rounded-xl pointer-events-none z-10 flex items-center justify-center transition-all animate-in fade-in duration-200"
                        style={{
                            left: visualTimeline[hoveredSlotIdx].x,
                            width: visualTimeline[hoveredSlotIdx].width
                        }}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const slideId = visualTimeline[hoveredSlotIdx].slide?.id;
                                if (slideId) {
                                    openModal(ModalType.AUDIO_PICKER, { targetSlideId: slideId });
                                }
                            }}
                            className="pointer-events-auto h-8 w-8 rounded-full bg-purple-500/20 text-purple-500 border border-purple-500/30 hover:bg-purple-500 hover:text-white hover:scale-110 active:scale-95 transition-all flex items-center justify-center shadow-lg"
                            title={t('add_audio', 'Add Audio')}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                )}

            {visualTimeline.map((item) => {
                if (item.type === 'slide' && item.slide?.type === 'timer' && (item.slide as ITimerSlide).playlist?.length) {
                    return (
                        <TimerAudioClip
                            key={`timer-audio-${item.slide.id}`}
                            slide={item.slide}
                            x={item.x}
                            width={item.width}
                        />
                    );
                }
                return null;
            })}

            {allScopes.map(({ scope, startIdx, endIdx }) => (
                <AudioScopeBlock
                    key={scope.id}
                    scope={scope}
                    startIdx={startIdx}
                    endIdx={endIdx}
                    visualTimeline={visualTimeline}
                    tileGap={TILE_GAP}
                />
            ))}
        </div>
    );
};

export default React.memo(AudioTrack);
