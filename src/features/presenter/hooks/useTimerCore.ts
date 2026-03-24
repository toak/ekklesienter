import { useState, useEffect, useRef, useCallback } from 'react';
import { ITimerSettings } from '@/core/types';
import { useSetAtom } from 'jotai';
import { activeOverrideAtom } from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { audioService } from '@/features/presenter/services/AudioService';

export const useTimerCore = (id: string, settings: ITimerSettings, isLive: boolean) => {
    const [timeLeft, setTimeLeft] = useState(settings.duration);
    const [showFlash, setShowFlash] = useState(false);
    const setOverride = useSetAtom(activeOverrideAtom as any);
    const firedTriggers = useRef<Set<string>>(new Set());
    const settingsRef = useRef(settings);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    useEffect(() => {
        if (!isLive) {
            setTimeLeft(settings.duration);
            firedTriggers.current.clear();
        }
    }, [settings.duration, isLive]);

    const executeActions = useCallback((actions: any[]) => {
        actions.forEach(action => {
            switch (action.type) {
                case 'next_slide':
                    usePresentationStore.getState().navigateNext();
                    break;
                case 'blackout':
                    setOverride('blackout');
                    break;
                case 'play_sound':
                    try {
                        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(880, ctx.currentTime);
                        gain.gain.setValueAtTime(0.1, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                        osc.start();
                        osc.stop(ctx.currentTime + 0.5);
                    } catch (e) {
                        console.error('Failed to play trigger sound:', e);
                    }
                    break;
                case 'flash':
                    setShowFlash(true);
                    setTimeout(() => setShowFlash(false), 500);
                    break;
                case 'change_bg':
                    if (action.payload?.background) {
                        usePresentationStore.getState().updateSlideBackground(id, action.payload.background);
                    }
                    break;
                case 'volume_fade':
                    const volume = action.payload?.volume ?? 0;
                    const fadeDuration = action.payload?.duration ?? 0.1;
                    if (volume === 0) {
                        audioService.stopAll(fadeDuration);
                    } else {
                        audioService.stopAll(fadeDuration);
                    }
                    break;
            }
        });
    }, [id, setOverride]);

    const handleEndAction = useCallback(() => {
        if (!isLive) return;
        if (settingsRef.current.endAction === 'loop') {
            setTimeLeft(settingsRef.current.duration);
        } else if (settingsRef.current.endAction === 'next') {
            usePresentationStore.getState().navigateNext();
        }
    }, [isLive]);

    useEffect(() => {
        if (!isLive) return;

        const startTime = Date.now();
        const initialTime = timeLeft;

        const interval = setInterval(() => {
            const currentSettings = settingsRef.current;
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = Math.max(0, initialTime - elapsed);

            setTimeLeft(prev => {
                if (prev === remaining) return prev;
                return remaining;
            });

            if (currentSettings.triggers) {
                currentSettings.triggers.forEach(trigger => {
                    let shouldFire = false;
                    const elapsedFromStart = currentSettings.duration - remaining;

                    switch (trigger.type) {
                        case 'start':
                            if (elapsedFromStart <= 0.1) shouldFire = true;
                            break;
                        case 'finish':
                            if (remaining <= 0.1) shouldFire = true;
                            break;
                        case 'remaining':
                            if (remaining <= trigger.value && remaining > trigger.value - 1) shouldFire = true;
                            break;
                        case 'elapsed':
                            if (elapsedFromStart >= trigger.value && elapsedFromStart < trigger.value + 1) shouldFire = true;
                            break;
                        case 'percentage':
                            const currentPct = (elapsedFromStart / currentSettings.duration) * 100;
                            if (currentPct >= trigger.value) shouldFire = true;
                            break;
                    }

                    if (shouldFire && !firedTriggers.current.has(trigger.id)) {
                        firedTriggers.current.add(trigger.id);
                        executeActions(trigger.actions);
                    }
                });
            }

            if (remaining === 0) {
                clearInterval(interval);
                handleEndAction();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isLive, id, executeActions, handleEndAction]);

    const formatTime = useCallback((seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    return {
        timeLeft,
        showFlash,
        formatTime,
    };
};
