import React, { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import { cn } from '@/core/utils/cn';
import { IAudioScope, ISlide, ICanvasSlide } from '@/core/types';
import { Music, Repeat, Trash2, Volume2, ArrowRightLeft } from 'lucide-react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { gainToDb, dbToGain } from '@/core/utils/audioUtils';
import { audioService } from '@/features/presenter/services/AudioService';

interface AudioScopeBlockProps {
    scope: IAudioScope;
    /** Start index in the visualTimeline array */
    startIdx: number;
    /** End index in the visualTimeline array */
    endIdx: number;
    /** Flattened visual model from SlideTimeline */
    visualTimeline: Array<{
        id: string;
        width: number;
        x: number;
        type: string;
        slide?: ISlide;
    }>;
    /** Gap between tiles in px */
    tileGap: number;
}

const AudioScopeBlock: React.FC<AudioScopeBlockProps> = ({
    scope,
    startIdx: propStartIdx,
    endIdx: propEndIdx,
    visualTimeline,
    tileGap,
}) => {
    const { updateAudioScopeBoundary, updateAudioScope, removeAudioScope, activePresentation, selectedAudioScopeId, selectAudioScope } = usePresentationStore();
    const { settings } = usePresenterStore();
    const blockRef = useRef<HTMLDivElement>(null);

    const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number } | null>(null);
    const [isEditingVolume, setIsEditingVolume] = React.useState(false);
    const [volumeInputValue, setVolumeInputValue] = React.useState('');
    const [waveform, setWaveform] = useState<number[]>([]);
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch real waveform data
    useEffect(() => {
        let isMounted = true;
        const fetchWaveform = async () => {
            setIsLoading(true);
            setHasError(false);
            // Fetch significantly more points for a dense "Telegram" look
            const points = await audioService.getWaveform(scope.fileId, 120);
            if (isMounted) {
                setIsLoading(false);
                if (points) {
                    setWaveform(points);
                } else {
                    // AI Fix: If no points, check if file exists but is just too large/streamed
                    const exists = await db.mediaPool.get(scope.fileId);
                    if (exists) {
                        setWaveform([]); // Clear waveform, but not an error
                        setHasError(false);
                    } else {
                        setHasError(true);
                        // AUTO-REPAIR: If file is missing, try to find it in mediaPool by name
                        if (scope.fileName) {
                            try {
                                const match = await db.mediaPool.where('name').equals(scope.fileName).first();
                                if (match && match.path !== scope.fileId) {
                                    updateAudioScope(scope.id, { fileId: match.path });
                                }
                            } catch (e) {
                                console.warn('[AudioScopeBlock] Failed to auto-repair:', e);
                            }
                        }
                    }
                }
            }
        };
        fetchWaveform();
        return () => { isMounted = false; };
    }, [scope.fileId, scope.fileName, scope.id, updateAudioScope]);


    const mediaItem = useLiveQuery(
        async () => {
            // Try by ID first (indexed)
            const byId = await db.mediaPool.get(scope.fileId);
            if (byId) return byId;
            // Fallback to path (not indexed, but table is small so filter is fine)
            return db.mediaPool.filter(m => m.path === scope.fileId).first();
        },
        [scope.fileId]
    );

    // Proactively populate fileName for existing clips so they can be auto-repaired later
    useEffect(() => {
        if (mediaItem?.name && !scope.fileName) {
            updateAudioScope(scope.id, { fileName: mediaItem.name });
        }
    }, [mediaItem, scope.fileName, scope.id, updateAudioScope]);

    const displayName = mediaItem?.name || scope.fileName || scope.fileId.split('/').pop() || 'Audio Track';

    // Calculate position and width using the visual model
    const left = useMemo(() => {
        return visualTimeline[propStartIdx]?.x || 0;
    }, [propStartIdx, visualTimeline]);

    const width = useMemo(() => {
        const startItem = visualTimeline[propStartIdx];
        const endItem = visualTimeline[propEndIdx];
        if (!startItem || !endItem) return 0;
        return (endItem.x + endItem.width) - startItem.x;
    }, [propStartIdx, propEndIdx, visualTimeline]);

    // ── Precompute X intervals for drag snapping ─────────────────────
    const slotXMap = useMemo(() => {
        return visualTimeline.map((item, idx) => ({
            start: item.x,
            end: item.x + item.width + tileGap,
            idx
        }));
    }, [visualTimeline, tileGap]);

    const resolveIdxAtX = useCallback((x: number) => {
        const match = slotXMap.find(interval => x >= interval.start && x <= interval.end);
        return match ? match.idx : -1;
    }, [slotXMap]);

    // ── Drag Handlers ────────────────────────────────────────────────
    const onLeftHandleDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const pointerId = e.pointerId;
        e.currentTarget.setPointerCapture(pointerId);

        const initialX = left;
        const pointerStartX = e.clientX;
        let lastInformedStartIdx = propStartIdx;

        const controller = new AbortController();

        const onMove = (ev: PointerEvent) => {
            const dx = ev.clientX - pointerStartX;
            const targetX = initialX + dx;
            let newIdx = resolveIdxAtX(targetX);

            if (newIdx !== -1 && newIdx <= propEndIdx) {
                // Snap to valid slide slots
                let snappedIdx = newIdx;
                while (snappedIdx < visualTimeline.length && !visualTimeline[snappedIdx].slide && snappedIdx <= propEndIdx) {
                    snappedIdx++;
                }
                const targetSlide = visualTimeline[snappedIdx]?.slide;
                if (targetSlide && snappedIdx !== lastInformedStartIdx) {
                    lastInformedStartIdx = snappedIdx;
                    updateAudioScopeBoundary(scope.id, targetSlide.id, visualTimeline[propEndIdx].slide!.id);
                }
            }
        };

        const onUp = () => {
            controller.abort();
            if (e.currentTarget) e.currentTarget.releasePointerCapture(pointerId);
        };

        document.addEventListener('pointermove', onMove, { signal: controller.signal });
        document.addEventListener('pointerup', onUp, { signal: controller.signal });
    }, [left, propStartIdx, propEndIdx, visualTimeline, scope.id, resolveIdxAtX, updateAudioScopeBoundary]);

    const onRightHandleDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const pointerId = e.pointerId;
        e.currentTarget.setPointerCapture(pointerId);

        const initialEndX = left + width;
        const pointerStartX = e.clientX;
        let lastInformedEndIdx = propEndIdx;

        const controller = new AbortController();

        const onMove = (ev: PointerEvent) => {
            const dx = ev.clientX - pointerStartX;
            const targetX = initialEndX + dx;
            let newIdx = resolveIdxAtX(targetX);

            if (newIdx !== -1 && newIdx >= propStartIdx) {
                // Snap to valid slide slots
                let snappedIdx = newIdx;
                while (snappedIdx >= 0 && !visualTimeline[snappedIdx].slide && snappedIdx >= propStartIdx) {
                    snappedIdx--;
                }
                const targetSlide = visualTimeline[snappedIdx]?.slide;
                if (targetSlide && snappedIdx !== lastInformedEndIdx) {
                    lastInformedEndIdx = snappedIdx;
                    updateAudioScopeBoundary(scope.id, visualTimeline[propStartIdx].slide!.id, targetSlide.id);
                }
            }
        };

        const onUp = () => {
            controller.abort();
            if (e.currentTarget) e.currentTarget.releasePointerCapture(pointerId);
        };

        document.addEventListener('pointermove', onMove, { signal: controller.signal });
        document.addEventListener('pointerup', onUp, { signal: controller.signal });
    }, [left, width, propStartIdx, propEndIdx, visualTimeline, scope.id, resolveIdxAtX, updateAudioScopeBoundary]);

    const onFadeInHandleDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const isCurrentlyFaded = (scope.crossfadeSettings?.fadeInDuration || 0) > 0;
        const newFade = isCurrentlyFaded ? 0 : 1.0;

        updateAudioScope(scope.id, {
            crossfadeSettings: {
                ...scope.crossfadeSettings,
                fadeInDuration: newFade,
                fadeOutDuration: scope.crossfadeSettings?.fadeOutDuration || 0
            }
        });
    }, [scope.id, scope.crossfadeSettings, updateAudioScope]);

    const onFadeOutHandleDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const isCurrentlyFaded = (scope.crossfadeSettings?.fadeOutDuration || 0) > 0;
        const newFade = isCurrentlyFaded ? 0 : 1.0;

        updateAudioScope(scope.id, {
            crossfadeSettings: {
                ...scope.crossfadeSettings,
                fadeOutDuration: newFade,
                fadeInDuration: scope.crossfadeSettings?.fadeInDuration || 0
            }
        });
    }, [scope.id, scope.crossfadeSettings, updateAudioScope]);

    const adjustFade = useCallback((type: 'in' | 'out', delta: number) => {
        const current = type === 'in'
            ? (scope.crossfadeSettings?.fadeInDuration || 0)
            : (scope.crossfadeSettings?.fadeOutDuration || 0);

        const newValue = Math.max(0, current + delta);

        updateAudioScope(scope.id, {
            crossfadeSettings: {
                ...scope.crossfadeSettings,
                [type === 'in' ? 'fadeInDuration' : 'fadeOutDuration']: newValue,
                fadeInDuration: type === 'in' ? newValue : (scope.crossfadeSettings?.fadeInDuration || 0),
                fadeOutDuration: type === 'out' ? newValue : (scope.crossfadeSettings?.fadeOutDuration || 0)
            }
        });
    }, [scope.id, scope.crossfadeSettings, updateAudioScope]);

    // ── Volume Drag Logic ─────────────────────────────────────────────
    const onVolumeBadgeDown = useCallback((e: React.PointerEvent) => {
        if (isEditingVolume) return;
        e.preventDefault();
        e.stopPropagation();
        const pointerId = e.pointerId;
        e.currentTarget.setPointerCapture(pointerId);

        const startX = e.clientX;
        const startGain = scope.volume || 1.0;
        const startDbStr = gainToDb(startGain);
        const startDb = startDbStr === '-∞' ? -60 : parseFloat(startDbStr);

        const controller = new AbortController();

        const onMove = (ev: PointerEvent) => {
            const dx = ev.clientX - startX;
            // Sensitivity: 1px = 0.5dB
            const deltaDb = dx * 0.5;
            const newDb = Math.max(-60, Math.min(12, startDb + deltaDb));
            const newGain = newDb <= -59.5 ? 0 : dbToGain(newDb);

            updateAudioScope(scope.id, { volume: newGain });
        };

        const onUp = () => {
            controller.abort();
            if (e.currentTarget) e.currentTarget.releasePointerCapture(pointerId);
        };

        document.addEventListener('pointermove', onMove, { signal: controller.signal });
        document.addEventListener('pointerup', onUp, { signal: controller.signal });
    }, [scope.id, scope.volume, updateAudioScope, isEditingVolume]);

    const handleVolumeSubmit = () => {
        const val = parseFloat(volumeInputValue);
        if (!isNaN(val)) {
            const newGain = dbToGain(val);
            updateAudioScope(scope.id, { volume: newGain });
        }
        setIsEditingVolume(false);
    };

    // Detect if we have adjacent scopes for crossfade indicator
    const hasNextScope = useMemo(() => {
        if (!activePresentation) return false;
        const nextSlideIdx = propEndIdx + 1;
        if (nextSlideIdx >= visualTimeline.length) return false;

        // Find if any scope starts at this next slide
        return activePresentation.slides.some(s =>
            (s.type === 'normal' && (s as ICanvasSlide).audioScopes?.some(scp => scp.startSlideId === visualTimeline[nextSlideIdx]?.slide?.id))
        );
    }, [activePresentation, propEndIdx, visualTimeline]);

    const isSelected = selectedAudioScopeId === scope.id;

    return (
        <div
            ref={blockRef}
            className="absolute top-0 h-[72px] flex items-center group/scope"
            style={{ left, width }}
            onClick={(e) => {
                e.stopPropagation();
                selectAudioScope(scope.id);
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY });
            }}
        >
            <div className={cn(
                "relative w-full h-full rounded-xl bg-purple-500/10 border-2 flex flex-col justify-end p-2 overflow-hidden backdrop-blur-sm transition-all group-hover/scope:bg-purple-500/15 group-hover/scope:border-purple-500/30",
                isSelected ? "border-amber-500/80 bg-purple-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/30" : "border-purple-500/20"
            )}>
                <svg className="absolute inset-0 w-full h-full opacity-30 text-purple-400" preserveAspectRatio="none" viewBox="0 0 100 100">
                    {/* Fade In Region */}
                    {(scope.crossfadeSettings?.fadeInDuration ?? 0) > 0 && (
                        <path
                            d={`M 0 100 L ${Math.min(25, (scope.crossfadeSettings?.fadeInDuration || 0) * 8)} 100 L 0 0 Z`}
                            fill="currentColor"
                            className="text-amber-400 opacity-60"
                        />
                    )}
                    {/* Fade Out Region */}
                    {(scope.crossfadeSettings?.fadeOutDuration ?? 0) > 0 && (
                        <path
                            d={`M 100 100 L ${Math.max(75, 100 - (scope.crossfadeSettings?.fadeOutDuration || 0) * 8)} 100 L 100 0 Z`}
                            fill="currentColor"
                            className="text-amber-400 opacity-60"
                        />
                    )}
                    {waveform.length > 0 ? (
                        <g className="text-purple-300">
                            {waveform.map((val, i) => {
                                const x = (i / (waveform.length - 1)) * 100;
                                const barWidth = 0.5; // Fine-tune bar width
                                const minHeight = 2;   // Subtle base height
                                const h = Math.max(minHeight, val * 60);
                                const y = 50 - h / 2;
                                return (
                                    <rect
                                        key={i}
                                        x={x}
                                        y={y}
                                        width={barWidth}
                                        height={h}
                                        rx={barWidth / 2}
                                        fill="currentColor"
                                        className="transition-all duration-300"
                                        style={{ opacity: 0.3 + (val * 0.5) }}
                                    />
                                );
                            })}
                        </g>
                    ) : (
                        <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.5" opacity="0.3" strokeDasharray="1 2" />
                    )}
                </svg>

                {/* Resize Handles & Fade Buttons */}
                <div className="absolute inset-0 pointer-events-none z-10">
                    {/* Left Side */}
                    <div className="absolute left-0 top-0 w-8 h-full">
                        {/* Fade In Button */}
                        <button
                            onClick={onFadeInHandleDown}
                            className={cn(
                                "absolute top-0 left-0 w-8 h-8 transition-all flex items-start justify-start p-1 rounded-br-lg pointer-events-auto cursor-pointer",
                                (scope.crossfadeSettings?.fadeInDuration || 0) > 0
                                    ? "text-amber-500 hover:text-amber-400"
                                    : "text-purple-300/40 hover:text-purple-100"
                            )}
                            title={`Fade In: ${scope.crossfadeSettings?.fadeInDuration?.toFixed(1) || 0}s (Click to toggle)`}
                        >
                            <div className={cn(
                                "w-2.5 h-2.5 border-t-2 border-l-2",
                                (scope.crossfadeSettings?.fadeInDuration || 0) > 0 ? "border-amber-500" : "border-current"
                            )} />
                        </button>

                        {/* Left Stretch Handle */}
                        <div
                            onPointerDown={onLeftHandleDown}
                            className="absolute left-0 top-6 bottom-0 w-3 cursor-ew-resize flex items-center justify-center hover:bg-purple-500/30 transition-colors touch-none pointer-events-auto group/handle-l"
                        >
                            <div className="w-1 h-6 bg-purple-400/50 group-hover/handle-l:bg-purple-400 rounded-full shadow-sm transition-colors" />
                        </div>
                    </div>

                    {/* Right Side */}
                    <div className="absolute right-0 top-0 w-8 h-full">
                        {/* Fade Out Button */}
                        <button
                            onClick={onFadeOutHandleDown}
                            className={cn(
                                "absolute top-0 right-0 w-8 h-8 transition-all flex items-start justify-end p-1 rounded-bl-lg pointer-events-auto cursor-pointer",
                                (scope.crossfadeSettings?.fadeOutDuration || 0) > 0
                                    ? "text-amber-500 hover:text-amber-400"
                                    : "text-purple-300/40 hover:text-purple-100"
                            )}
                            title={`Fade Out: ${scope.crossfadeSettings?.fadeOutDuration?.toFixed(1) || 0}s (Click to toggle)`}
                        >
                            <div className={cn(
                                "w-2.5 h-2.5 border-t-2 border-r-2",
                                (scope.crossfadeSettings?.fadeOutDuration || 0) > 0 ? "border-amber-500" : "border-current"
                            )} />
                        </button>

                        {/* Right Stretch Handle */}
                        <div
                            onPointerDown={onRightHandleDown}
                            className="absolute right-0 top-6 bottom-0 w-3 cursor-ew-resize flex items-center justify-center hover:bg-purple-500/30 transition-colors touch-none pointer-events-auto group/handle-r"
                        >
                            <div className="w-1 h-6 bg-purple-400/50 group-hover/handle-r:bg-purple-400 rounded-full shadow-sm transition-colors" />
                        </div>
                    </div>
                </div>

                {/* Top Controls (Volume & Mute) */}
                <div className="absolute top-1 right-1 flex items-center gap-1 z-20">
                    {scope.loop && (
                        <div className="bg-stone-900/60 p-1 rounded-lg border border-white/5 backdrop-blur-xl shadow-lg">
                            <Repeat className="w-3 h-3 text-purple-300" />
                        </div>
                    )}
                    <div
                        onPointerDown={onVolumeBadgeDown}
                        className={cn(
                            "bg-stone-900/60 h-7 px-2 rounded-lg border border-white/5 backdrop-blur-xl shadow-lg flex items-center gap-2 cursor-ew-resize transition-all hover:bg-stone-800/80 hover:border-white/10 select-none group/vol",
                            isEditingVolume && "ring-2 ring-purple-500/50"
                        )}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                updateAudioScope(scope.id, { isMuted: !scope.isMuted });
                            }}
                            className={cn(
                                "transition-colors cursor-pointer",
                                scope.isMuted ? "text-red-400" : "text-purple-300 hover:text-white"
                            )}
                        >
                            <Volume2 className="w-3 h-3" />
                        </button>

                        {isEditingVolume ? (
                            <input
                                autoFocus
                                value={volumeInputValue}
                                onChange={(e) => setVolumeInputValue(e.target.value)}
                                onBlur={handleVolumeSubmit}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleVolumeSubmit();
                                    if (e.key === 'Escape') setIsEditingVolume(false);
                                }}
                                className="w-10 bg-transparent text-[10px] font-black text-white outline-none text-center"
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const currentDb = parseFloat(gainToDb(scope.volume));
                                    setVolumeInputValue(isNaN(currentDb) ? '0' : currentDb.toString());
                                    setIsEditingVolume(true);
                                }}
                                className={cn(
                                    "text-[10px] font-black tracking-tighter transition-colors cursor-text hover:text-white",
                                    scope.isMuted ? "text-red-400/50" : "text-purple-100"
                                )}
                            >
                                {gainToDb(scope.volume)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Context/Controls (Hover) */}
                <div className="absolute top-1 left-9 z-20 opacity-0 group-hover/scope:opacity-100 transition-opacity flex items-center gap-1">
                    {hasNextScope && (
                        <div className="p-1 bg-amber-500/80 text-black border border-amber-500/30 rounded-md shadow-lg backdrop-blur-md animate-pulse" title="Crossfade Active">
                            <ArrowRightLeft className="w-3 h-3" />
                        </div>
                    )}
                </div>

                {/* Audio Label (Icon + Name) - Low Focus */}
                <div className="absolute bottom-1.5 left-2.5 z-10 flex items-center gap-1.5 opacity-40 pointer-events-none group-hover/scope:opacity-60 transition-opacity">
                    <Music className={cn(
                        "w-2.5 h-2.5 shrink-0",
                        hasError ? "text-red-400" : "text-purple-300"
                    )} />
                    <span className={cn(
                        "text-[10px] font-medium tracking-tight truncate max-w-[150px]",
                        hasError ? "text-red-400" : "text-white"
                    )}>
                        {displayName}
                        {hasError && !isLoading && " (Missing)"}
                        {!hasError && !isLoading && waveform.length === 0 && " (Streaming)"}
                        {isLoading && " (Loading...)"}
                    </span>

                </div>
            </div>

            {contextMenu && (
                <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
                    <ContextMenuItem
                        icon={<Trash2 className="w-4 h-4" />}
                        label="Delete Audio Clip"
                        onClick={() => {
                            removeAudioScope(scope.id);
                            setContextMenu(null);
                        }}
                        danger
                    />
                    <div className="h-px bg-white/5 my-1" />
                    <ContextMenuItem
                        icon={<ArrowRightLeft className="w-4 h-4" />}
                        label="Fade In +1s"
                        onClick={() => adjustFade('in', 1)}
                    />
                    <ContextMenuItem
                        icon={<ArrowRightLeft className="w-4 h-4 rotate-180" />}
                        label="Fade In -1s"
                        onClick={() => adjustFade('in', -1)}
                    />
                    <div className="h-px bg-white/5 my-1" />
                    <ContextMenuItem
                        icon={<ArrowRightLeft className="w-4 h-4" />}
                        label="Fade Out +1s"
                        onClick={() => adjustFade('out', 1)}
                    />
                    <ContextMenuItem
                        icon={<ArrowRightLeft className="w-4 h-4 rotate-180" />}
                        label="Fade Out -1s"
                        onClick={() => adjustFade('out', -1)}
                    />
                </ContextMenu>
            )}
        </div>
    );
};

export default React.memo(AudioScopeBlock);
