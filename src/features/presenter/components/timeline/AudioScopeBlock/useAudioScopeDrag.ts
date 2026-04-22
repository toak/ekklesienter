import { useState, useCallback, useRef, useEffect } from 'react';
import { IAudioScope } from '@/core/types';

interface DragState {
    type: 'clip' | 'left' | 'right';
    dx: number;
    initialLeft: number;
    initialWidth: number;
}

interface UseAudioScopeDragProps {
    scope: IAudioScope;
    visualTimeline: any[];
    startIdx: number;
    endIdx: number;
    left: number;
    width: number;
    selectAudioScope: (id: string) => void;
    updateAudioScopeBoundary: (id: string, startId: string, endId: string) => void;
}

export function useAudioScopeDrag({
    scope,
    visualTimeline,
    startIdx,
    endIdx,
    left,
    width,
    selectAudioScope,
    updateAudioScopeBoundary
}: UseAudioScopeDragProps) {
    const [dragState, setDragState] = useState<DragState | null>(null);

    const visualRef = useRef(visualTimeline);
    const startIdxRef = useRef(startIdx);
    const endIdxRef = useRef(endIdx);
    const scopeRef = useRef(scope);

    useEffect(() => {
        visualRef.current = visualTimeline;
        startIdxRef.current = startIdx;
        endIdxRef.current = endIdx;
        scopeRef.current = scope;
    }, [visualTimeline, startIdx, endIdx, scope]);

    const resolveIdxAtX = useCallback((x: number) => {
        const visual = visualRef.current;
        let bestIdx = -1;
        let minDiff = Infinity;
        for (let i = 0; i < visual.length; i++) {
            const item = visual[i];
            const center = item.x + item.width / 2;
            const diff = Math.abs(x - center);
            if (diff < minDiff) {
                minDiff = diff;
                bestIdx = i;
            }
        }
        return bestIdx;
    }, []);

    const onClipDragDown = useCallback((e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        
        e.preventDefault();
        e.stopPropagation();

        selectAudioScope(scopeRef.current.id);

        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);

        const initialLeft = left;
        const initialWidth = width;

        // Capture how far into the clip the user clicked so the clip left edge
        // tracks correctly — without this the clip snaps to the pointer position
        // using its left-edge, causing it to jump ahead of the cursor.
        const pointerOffsetInClip = e.clientX - initialLeft;

        setDragState({ type: 'clip', dx: 0, initialLeft, initialWidth });
        
        const currentVisual = visualRef.current;
        const currentScope = scopeRef.current;
        const currentStartIdx = startIdxRef.current;
        const currentEndIdx = endIdxRef.current;

        const presentationSlideIndices = currentVisual
            .map((item, idx) => item.presentationId === currentScope.presentationId && item.slide ? idx : -1)
            .filter(idx => idx !== -1);
            
        const startPosInPresIdx = presentationSlideIndices.indexOf(currentStartIdx);
        const endPosInPresIdx = presentationSlideIndices.indexOf(currentEndIdx);
        
        if (startPosInPresIdx === -1 || endPosInPresIdx === -1) {
            setDragState(null);
            return;
        }
        
        const clipSlideCount = endPosInPresIdx - startPosInPresIdx;
        let lastInformedStartIdxInPres = startPosInPresIdx;

        const onPointerMove = (ev: PointerEvent) => {
            // Compute the clip's left edge position that keeps the grab point under the pointer
            const targetX = ev.clientX - pointerOffsetInClip;
            const rawDx = targetX - initialLeft;
            const newTileIdx = resolveIdxAtX(targetX);
            
            if (newTileIdx === -1) {
                setDragState(prev => prev ? { ...prev, dx: rawDx } : null);
                return;
            }

            const freshVisual = visualRef.current;
            const snappedX = freshVisual[newTileIdx].x;
            const dist = Math.abs(targetX - snappedX);
            const visualDx = dist < 20 ? (snappedX - initialLeft) : rawDx;
            
            setDragState(prev => prev ? { ...prev, dx: visualDx } : null);
            
            const presIndices = freshVisual
                .map((item, idx) => item.presentationId === currentScope.presentationId && item.slide ? idx : -1)
                .filter(idx => idx !== -1);

            let nearestPresSlideIdx = -1;
            let minDistance = Infinity;
            
            presIndices.forEach((tileIdx, presIdx) => {
                const dist = Math.abs(tileIdx - newTileIdx);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestPresSlideIdx = presIdx;
                }
            });

            if (nearestPresSlideIdx !== -1 && nearestPresSlideIdx !== lastInformedStartIdxInPres) {
                const newStartPosInPres = nearestPresSlideIdx;
                const newEndPosInPres = Math.min(presIndices.length - 1, newStartPosInPres + clipSlideCount);
                
                const startSlideId = freshVisual[presIndices[newStartPosInPres]]?.slide?.id;
                const endSlideId = freshVisual[presIndices[newEndPosInPres]]?.slide?.id;
                
                if (startSlideId && endSlideId) {
                    lastInformedStartIdxInPres = newStartPosInPres;
                    updateAudioScopeBoundary(currentScope.id, startSlideId, endSlideId);
                }
            }
        };

        const onPointerUp = (ev: PointerEvent) => {
            target.releasePointerCapture(ev.pointerId);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            setDragState(null);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    }, [left, width, resolveIdxAtX, updateAudioScopeBoundary, selectAudioScope]);

    const onLeftHandleDown = useCallback((e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        
        e.preventDefault();
        e.stopPropagation();

        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);

        const currentVisual = visualRef.current;
        const currentScope = scopeRef.current;
        const currentEndIdx = endIdxRef.current;
        const endSlideId_val = currentVisual[currentEndIdx]?.slide?.id;
        
        if (!endSlideId_val) return;
        
        let lastInformedStartIdx = startIdxRef.current;
        const initialLeft = left;
        const initialWidth = width;

        // Capture grab offset relative to the left edge so the handle tracks the pointer
        const pointerOffsetFromLeftEdge = e.clientX - initialLeft;

        setDragState({ type: 'left', dx: 0, initialLeft, initialWidth });

        const onPointerMove = (ev: PointerEvent) => {
            const freshVisual = visualRef.current;
            // Left edge position under pointer corrected for grab offset
            const targetX = ev.clientX - pointerOffsetFromLeftEdge;
            const rawDx = targetX - initialLeft;
            const newIdx = resolveIdxAtX(targetX);
            
            if (newIdx !== -1 && newIdx <= currentEndIdx) {
                const snappedX = freshVisual[newIdx].x;
                const dist = Math.abs(targetX - snappedX);
                const visualDx = dist < 20 ? (snappedX - initialLeft) : rawDx;
                
                setDragState(prev => prev ? { ...prev, dx: visualDx } : null);
                
                let snappedIdx = newIdx;
                while (snappedIdx < freshVisual.length && snappedIdx >= 0 && 
                      (!freshVisual[snappedIdx]?.slide || freshVisual[snappedIdx]?.presentationId !== currentScope.presentationId) && 
                      snappedIdx <= currentEndIdx) {
                    snappedIdx++;
                }
                const targetSlide = freshVisual[snappedIdx]?.slide;
                if (targetSlide && snappedIdx !== lastInformedStartIdx) {
                    lastInformedStartIdx = snappedIdx;
                    updateAudioScopeBoundary(currentScope.id, targetSlide.id, endSlideId_val);
                }
            }
        };

        const onPointerUp = (ev: PointerEvent) => {
            target.releasePointerCapture(ev.pointerId);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            setDragState(null);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    }, [left, width, resolveIdxAtX, updateAudioScopeBoundary]);

    const onRightHandleDown = useCallback((e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        
        e.preventDefault();
        e.stopPropagation();

        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);

        const currentVisual = visualRef.current;
        const currentScope = scopeRef.current;
        const currentStartIdx = startIdxRef.current;
        const startSlideId_val = currentVisual[currentStartIdx]?.slide?.id;
        
        if (!startSlideId_val) return;
        
        let lastInformedEndIdx = endIdxRef.current;
        const initialLeft = left;
        const initialWidth = width;
        const initialRightEdge = initialLeft + initialWidth;

        // Capture grab offset relative to the right edge so the handle tracks the pointer
        const pointerOffsetFromRightEdge = e.clientX - initialRightEdge;

        setDragState({ type: 'right', dx: 0, initialLeft, initialWidth });

        const onPointerMove = (ev: PointerEvent) => {
            const freshVisual = visualRef.current;
            // Right edge position under pointer corrected for grab offset
            const targetX = ev.clientX - pointerOffsetFromRightEdge;
            const rawDx = targetX - initialRightEdge;
            const newIdx = resolveIdxAtX(targetX);
            
            if (newIdx !== -1 && newIdx >= currentStartIdx) {
                const snappedX = freshVisual[newIdx].x + freshVisual[newIdx].width;
                const dist = Math.abs(targetX - snappedX);
                const visualDx = dist < 20 ? (snappedX - initialRightEdge) : rawDx;
                
                setDragState(prev => prev ? { ...prev, dx: visualDx } : null);
                
                let snappedIdx = newIdx;
                while (snappedIdx >= 0 && 
                      (!freshVisual[snappedIdx]?.slide || freshVisual[snappedIdx]?.presentationId !== currentScope.presentationId) && 
                      snappedIdx >= currentStartIdx) {
                    snappedIdx--;
                }
                const targetSlide = freshVisual[snappedIdx]?.slide;
                if (targetSlide && snappedIdx !== lastInformedEndIdx) {
                    lastInformedEndIdx = snappedIdx;
                    updateAudioScopeBoundary(currentScope.id, startSlideId_val, targetSlide.id);
                }
            }
        };

        const onPointerUp = (ev: PointerEvent) => {
            target.releasePointerCapture(ev.pointerId);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            setDragState(null);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    }, [left, width, resolveIdxAtX, updateAudioScopeBoundary]);

    return {
        dragState,
        onClipDragDown,
        onLeftHandleDown,
        onRightHandleDown
    };
}
