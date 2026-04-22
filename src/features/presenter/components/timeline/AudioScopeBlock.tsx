import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { IAudioScope, ISlide, ICanvasSlide } from '@/core/types';
import { Music, Repeat, Trash2, ArrowRightLeft, AlertCircle, Copy, Layers } from 'lucide-react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { gainToDb, dbToGain } from '@/core/utils/audioUtils';

// Sub-components & Hooks
import { AudioWaveform } from './AudioScopeBlock/AudioWaveform';
import { useAudioScopeDrag } from './AudioScopeBlock/useAudioScopeDrag';
import { AudioVolumeBadge, AudioFadeHandles } from './AudioScopeBlock/AudioControls';

interface AudioScopeBlockProps {
    scope: IAudioScope;
    startIdx: number;
    endIdx: number;
    visualTimeline: Array<{
        id: string;
        width: number;
        x: number;
        type: string;
        slide?: ISlide;
        presentationId?: string;
        parentSlideId?: string;
    }>;
    tileGap: number;
}

const AudioScopeBlock: React.FC<AudioScopeBlockProps> = ({
    scope,
    startIdx,
    endIdx,
    visualTimeline,
}) => {
    const { t } = useTranslation();
    
    // ─── Granular Selectors to prevent full store subscription ────────────────
    const updateAudioScopeBoundary = usePresentationStore(s => s.updateAudioScopeBoundary);
    const updateAudioScope = usePresentationStore(s => s.updateAudioScope);
    const removeAudioScope = usePresentationStore(s => s.removeAudioScope);
    const duplicateAudioScope = usePresentationStore(s => s.duplicateAudioScope);
    const copyAudioScope = usePresentationStore(s => s.copyAudioScope);
    const selectAudioScope = usePresentationStore(s => s.selectAudioScope);
    const selectedAudioScopeId = usePresentationStore(s => s.selectedAudioScopeId);
    
    // We only need the ID and types of slides to check for neighbors, not the whole presentation object
    const activePresentationSlides = usePresentationStore(s => s.activePresentation?.slides);
    const settings = usePresenterStore(s => s.settings);

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [isEditingVolume, setIsEditingVolume] = useState(false);
    const [volumeInputValue, setVolumeInputValue] = useState('');

    // ─── Data fetch ────────────────────────────────────────────────────────
    const mediaItem = useLiveQuery(
        async () => {
            if (!scope.fileId) return null;
            const byId = await db.mediaPool.get(scope.fileId);
            if (byId) return byId;
            return db.mediaPool.where('path').equals(scope.fileId).first();
        },
        [scope.fileId]
    );

// Helper to identify technical IDs that need replacement with human-readable names
const isTechnicalId = (val: string) => {
    if (!val) return false;
    const clean = val.trim().replace(/\.(mp3|wav|ogg|m4a|aac|flac|bin|mp4|webm)$/i, '');
    // Check for SHA-256 (64 hex), UUID (36 chars), or MD5 (32 hex)
    return /^[a-fA-F0-9]{64}$/.test(clean) || 
           /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean) ||
           /^[0-9a-f]{32}$/i.test(clean) ||
           clean.startsWith('imported_');
};

// tracks already repaired in this session to prevent re-writes
const sessionRepairedIds = new Set<string>();
        
    // ─── Metadata Auto-Repair ──────────────────────────────────────────────
    useEffect(() => {
        if (!mediaItem || sessionRepairedIds.has(scope.id)) return;
        
        const updates: Partial<IAudioScope> = {};
        
        if (mediaItem.name && (!scope.fileName || isTechnicalId(scope.fileName))) {
            if (!isTechnicalId(mediaItem.name)) {
                updates.fileName = mediaItem.name;
            } else if (mediaItem.path) {
                const extracted = mediaItem.path.split(/[/\\]/).pop();
                if (extracted && !isTechnicalId(extracted)) updates.fileName = extracted;
            }
        }
        
        if (mediaItem.id !== scope.fileId) {
            updates.fileId = mediaItem.id;
        }
        
        if (Object.keys(updates).length > 0) {
            sessionRepairedIds.add(scope.id);
            updateAudioScope(scope.id, updates);
        }
    }, [mediaItem, scope.fileName, scope.fileId, scope.id, updateAudioScope]);

    const displayName = useMemo(() => {
        if (mediaItem?.name && !isTechnicalId(mediaItem.name)) return mediaItem.name;
        if (scope.fileName && !isTechnicalId(scope.fileName)) return scope.fileName;
        return t('untitled_audio', 'Untitled Audio');
    }, [mediaItem?.name, scope.fileName, t]);

    // ─── Positioning ────────────────────────────────────────────────────────
    const left = useMemo(() => visualTimeline[startIdx]?.x || 0, [startIdx, visualTimeline]);
    const width = useMemo(() => {
        const startItem = visualTimeline[startIdx];
        const endItem = visualTimeline[endIdx];
        if (!startItem || !endItem) return 0;
        return (endItem.x + endItem.width) - startItem.x;
    }, [startIdx, endIdx, visualTimeline]);

    // ─── Drag Logic ─────────────────────────────────────────────────────────
    const { dragState, onClipDragDown, onLeftHandleDown, onRightHandleDown } = useAudioScopeDrag({
        scope, visualTimeline, startIdx, endIdx, left, width,
        selectAudioScope, updateAudioScopeBoundary
    });

    // ─── Handlers ───────────────────────────────────────────────────────────
    const adjustFade = useCallback((type: 'in' | 'out', delta: number) => {
        const current = type === 'in' ? (scope.crossfadeSettings?.fadeInDuration || 0) : (scope.crossfadeSettings?.fadeOutDuration || 0);
        const newValue = Math.max(0, current + delta);
        updateAudioScope(scope.id, {
            crossfadeSettings: {
                ...scope.crossfadeSettings,
                [type === 'in' ? 'fadeInDuration' : 'fadeOutDuration']: newValue
            }
        });
    }, [scope.id, scope.crossfadeSettings, updateAudioScope]);

    const onFadeInToggle = useCallback((e: React.PointerEvent) => {
        e.stopPropagation();
        const defaultFade = settings.audio?.defaultFadeDuration || 1.0;
        const current = scope.crossfadeSettings?.fadeInDuration || 0;
        updateAudioScope(scope.id, { crossfadeSettings: { ...scope.crossfadeSettings, fadeInDuration: current > 0 ? 0 : defaultFade } });
    }, [scope.id, scope.crossfadeSettings, updateAudioScope, settings.audio?.defaultFadeDuration]);

    const onFadeOutToggle = useCallback((e: React.PointerEvent) => {
        e.stopPropagation();
        const defaultFade = settings.audio?.defaultFadeDuration || 1.0;
        const current = scope.crossfadeSettings?.fadeOutDuration || 0;
        updateAudioScope(scope.id, { crossfadeSettings: { ...scope.crossfadeSettings, fadeOutDuration: current > 0 ? 0 : defaultFade } });
    }, [scope.id, scope.crossfadeSettings, updateAudioScope, settings.audio?.defaultFadeDuration]);

    const onVolumeBadgeDown = useCallback((e: React.PointerEvent) => {
        if (isEditingVolume) return;
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startGain = scope.volume || 1.0;
        const startDb = parseFloat(gainToDb(startGain)) || -60;
        const onMove = (ev: PointerEvent) => {
            const newDb = Math.max(-60, Math.min(12, startDb + (ev.clientX - startX) * 0.5));
            updateAudioScope(scope.id, { volume: newDb <= -59.5 ? 0 : dbToGain(newDb) });
        };
        const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }, [scope.id, scope.volume, updateAudioScope, isEditingVolume]);

    const isSelected = selectedAudioScopeId === scope.id;
    const isMissing = !!mediaItem && 'isMissing' in mediaItem && (mediaItem as any).isMissing;

    // ─── Render ─────────────────────────────────────────────────────────────
    const hasNextScope = useMemo(() => {
        if (!activePresentationSlides) return false;
        const nextSlideIdx = endIdx + 1;
        if (nextSlideIdx >= visualTimeline.length) return false;
        const nextSlideId = visualTimeline[nextSlideIdx]?.slide?.id;
        return activePresentationSlides.some(s => s.type === 'normal' && (s as ICanvasSlide).audioScopes?.some(scp => scp.startSlideId === nextSlideId));
    }, [activePresentationSlides, endIdx, visualTimeline]);

    return (
        <>
            <div
                className={cn("absolute top-0 h-[72px] flex items-center group/scope", dragState && "z-0")}
                style={{ left, width }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
            >
                <div 
                    className={cn(
                        "relative w-full h-full rounded-xl border-2 flex flex-col justify-end p-2 overflow-hidden backdrop-blur-sm transition-opacity cursor-grab active:cursor-grabbing touch-none select-none",
                        dragState ? "border-dashed border-purple-500/30 bg-purple-500/5 backdrop-blur-none" : "bg-purple-500/10 group-hover/scope:bg-purple-500/15 group-hover/scope:border-purple-500/30",
                        !dragState && (isSelected ? "border-amber-500/80 bg-purple-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]" : "border-purple-500/20"),
                        isMissing && "border-red-500/50 bg-red-950/40"
                    )}
                    onPointerDown={onClipDragDown}
                >
                    <div className={cn("w-full h-full transition-opacity duration-200", dragState && "opacity-0")}>
                        <AudioScopeBlockContent 
                            scope={scope}
                            updateAudioScope={updateAudioScope}
                            onFadeInToggle={onFadeInToggle}
                            onFadeOutToggle={onFadeOutToggle}
                            onLeftHandleDown={onLeftHandleDown}
                            onRightHandleDown={onRightHandleDown}
                            t={t}
                            isEditingVolume={isEditingVolume}
                            volumeInputValue={volumeInputValue}
                            onVolumeBadgeDown={onVolumeBadgeDown}
                            setVolumeInputValue={setVolumeInputValue}
                            setIsEditingVolume={setIsEditingVolume}
                            hasNextScope={hasNextScope}
                            displayName={displayName}
                            isMissing={isMissing}
                        />
                    </div>
                </div>
            </div>

            {dragState && (
                <div
                    className="absolute top-0 h-[72px] flex items-center shadow-2xl z-50 pointer-events-none"
                    style={{ 
                        left: dragState.type === 'right' ? dragState.initialLeft : dragState.initialLeft + dragState.dx,
                        width: dragState.type === 'clip' ? dragState.initialWidth : (dragState.type === 'left' ? Math.max(30, dragState.initialWidth - dragState.dx) : Math.max(30, dragState.initialWidth + dragState.dx))
                    }}
                >
                    <div className={cn(
                        "relative w-full h-full rounded-xl border-2 flex flex-col justify-end p-2 overflow-hidden backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.3)] opacity-90",
                        isMissing ? "bg-red-900/80 border-red-400" : "bg-purple-900/80 border-purple-400"
                    )}>
                        <AudioScopeBlockContent 
                            scope={scope}
                            updateAudioScope={updateAudioScope}
                            onFadeInToggle={onFadeInToggle}
                            onFadeOutToggle={onFadeOutToggle}
                            onLeftHandleDown={onLeftHandleDown}
                            onRightHandleDown={onRightHandleDown}
                            t={t}
                            isEditingVolume={isEditingVolume}
                            volumeInputValue={volumeInputValue}
                            onVolumeBadgeDown={onVolumeBadgeDown}
                            setVolumeInputValue={setVolumeInputValue}
                            setIsEditingVolume={setIsEditingVolume}
                            hasNextScope={hasNextScope}
                            displayName={displayName}
                            isMissing={isMissing}
                        />
                    </div>
                </div>
            )}

            {contextMenu && (
                <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
                    <ContextMenuItem icon={<Layers className="w-4 h-4" />} label={t('duplicate')} onClick={() => { duplicateAudioScope(scope.id); setContextMenu(null); }} />
                    <ContextMenuItem icon={<Copy className="w-4 h-4" />} label={t('copy')} onClick={() => { copyAudioScope(scope.id); setContextMenu(null); }} />
                    <div className="h-px bg-white/5 my-1" />
                    <ContextMenuItem icon={<Trash2 className="w-4 h-4" />} label={t('delete_audio_clip')} onClick={() => { removeAudioScope(scope.id); setContextMenu(null); }} danger />
                    <div className="h-px bg-white/5 my-1" />
                    <ContextMenuItem icon={<ArrowRightLeft className="w-4 h-4" />} label={t('fade_in_plus_1s')} onClick={() => adjustFade('in', 1)} />
                    <ContextMenuItem icon={<ArrowRightLeft className="w-4 h-4 rotate-180" />} label={t('fade_in_minus_1s')} onClick={() => adjustFade('in', -1)} />
                    <div className="h-px bg-white/5 my-1" />
                    <ContextMenuItem icon={<ArrowRightLeft className="w-4 h-4" />} label={t('fade_out_plus_1s')} onClick={() => adjustFade('out', 1)} />
                </ContextMenu>
            )}
        </>
    );
};

// ─── Sub-Component for Isolated Rendering ────────────────────────────────
interface AudioScopeBlockContentProps {
    scope: IAudioScope;
    updateAudioScope: (id: string, updates: Partial<IAudioScope>) => void;
    onFadeInToggle: (e: React.PointerEvent) => void;
    onFadeOutToggle: (e: React.PointerEvent) => void;
    onLeftHandleDown: (e: React.PointerEvent) => void;
    onRightHandleDown: (e: React.PointerEvent) => void;
    t: any;
    isEditingVolume: boolean;
    volumeInputValue: string;
    onVolumeBadgeDown: (e: React.PointerEvent) => void;
    setVolumeInputValue: (val: string) => void;
    setIsEditingVolume: (val: boolean) => void;
    hasNextScope: boolean;
    displayName: string;
    isMissing?: boolean;
}

const AudioScopeBlockContent = React.memo(({
    scope, updateAudioScope, onFadeInToggle, onFadeOutToggle,
    onLeftHandleDown, onRightHandleDown, t, isEditingVolume,
    volumeInputValue, onVolumeBadgeDown, setVolumeInputValue,
    setIsEditingVolume, hasNextScope, displayName, isMissing
}: AudioScopeBlockContentProps) => (
    <>
        {!isMissing && <AudioWaveform scope={scope} updateAudioScope={updateAudioScope} />}
        
        <AudioFadeHandles 
            onFadeInDown={onFadeInToggle} 
            onFadeOutDown={onFadeOutToggle}
            onLeftHandleDown={onLeftHandleDown}
            onRightHandleDown={onRightHandleDown}
            fadeInActive={(scope.crossfadeSettings?.fadeInDuration || 0) > 0}
            fadeOutActive={(scope.crossfadeSettings?.fadeOutDuration || 0) > 0}
            fadeInTitle={`${t('fade_in')}: ${scope.crossfadeSettings?.fadeInDuration?.toFixed(1) || 0}s`}
            fadeOutTitle={`${t('fade_out')}: ${scope.crossfadeSettings?.fadeOutDuration?.toFixed(1) || 0}s`}
        />

        <div className="absolute top-1 right-1 flex items-center gap-1 z-20">
            {scope.loop && (
                <div className="bg-stone-900/60 p-1 rounded-lg border border-white/5 backdrop-blur-xl shadow-lg">
                    <Repeat className="w-3 h-3 text-purple-300" />
                </div>
            )}
            <AudioVolumeBadge 
                scope={scope}
                isEditingVolume={isEditingVolume}
                volumeInputValue={volumeInputValue}
                onVolumeBadgeDown={onVolumeBadgeDown}
                onToggleMute={(e) => { e.stopPropagation(); updateAudioScope(scope.id, { isMuted: !scope.isMuted }); }}
                onVolumeClick={(e) => { e.stopPropagation(); setVolumeInputValue(gainToDb(scope.volume ?? 1.0)); setIsEditingVolume(true); }}
                onVolumeInputChange={(e) => setVolumeInputValue(e.target.value)}
                onVolumeBlur={() => { if (!isNaN(parseFloat(volumeInputValue))) updateAudioScope(scope.id, { volume: dbToGain(parseFloat(volumeInputValue)) }); setIsEditingVolume(false); }}
                onVolumeKeyDown={(e) => { if (e.key === 'Enter') { if (!isNaN(parseFloat(volumeInputValue))) updateAudioScope(scope.id, { volume: dbToGain(parseFloat(volumeInputValue)) }); setIsEditingVolume(false); } if (e.key === 'Escape') setIsEditingVolume(false); }}
            />
        </div>

        <div className="absolute top-1 left-9 z-20 opacity-0 group-hover/scope:opacity-100 transition-opacity flex items-center gap-1">
            {hasNextScope && (
                <div className="p-1 bg-amber-500/80 text-black border border-amber-500/30 rounded-md shadow-lg backdrop-blur-md animate-pulse">
                    <ArrowRightLeft className="w-3 h-3" />
                </div>
            )}
        </div>

        <div className="absolute bottom-1.5 left-2.5 right-2.5 z-10 flex items-center gap-1.5 pointer-events-none transition-opacity min-w-0 opacity-40 group-hover/scope:opacity-60">
            {isMissing ? (
                <AlertCircle className="w-2.5 h-2.5 shrink-0 text-red-400" />
            ) : (
                <Music className="w-2.5 h-2.5 shrink-0 text-purple-300" />
            )}
            <span className={cn(
                "text-[10px] font-medium tracking-tight min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
                isMissing ? "text-red-400" : "text-white"
            )}>
                {displayName} {isMissing && `(${t('file_missing', 'Missing')})`}
            </span>
        </div>
    </>
));

AudioScopeBlockContent.displayName = 'AudioScopeBlockContent';

export default React.memo(AudioScopeBlock);
