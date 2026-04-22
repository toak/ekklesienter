import { useState, useEffect, useRef, useCallback } from 'react';
import { ITimerSettings, ITimerAction, ITimerTrigger } from '@/core/types/timer';
import { useSetAtom } from 'jotai';
import { activeOverrideAtom } from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { audioService } from '@/features/presenter/services/AudioService';

import { useTimerAudio } from './useTimerAudio';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { IpcService } from '@/core/services/IpcService';

export const useTimerCore = (id: string, settings: ITimerSettings, isLive: boolean, isProjector: boolean = false, isPreloading: boolean = false) => {
    const [timeLeft, setTimeLeft] = useState(settings.duration);
    const [isPaused, setIsPaused] = useState(false);
    const [showFlash, setShowFlash] = useState(false);
    const keyResolvers = useRef<Map<string, (key: string) => void>>(new Map());
    const firedTriggers = useRef<Set<string>>(new Set());
    const settingsRef = useRef(settings);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    useEffect(() => {
        // Always reset timer state when the slide ID changes
        setTimeLeft(settings.duration);
        setIsPaused(false);
        firedTriggers.current.clear();
    }, [id]);

    useEffect(() => {
        // Keep preview in sync when duration changes
        if (!isLive) {
            setTimeLeft(settings.duration);
            setIsPaused(false);
            firedTriggers.current.clear();
        }
    }, [settings.duration, isLive]);

    // Listen for remote timer commands
    useEffect(() => {
        if (!isLive) return;

        const unsub = LiveSyncService.onTimerCommand(({ slideId, command }) => {
            if (slideId !== id) return;

            if (command === 'pause') setIsPaused(true);
            else if (command === 'resume') setIsPaused(false);
            else if (command === 'toggle') setIsPaused(prev => !prev);
        });

        return unsub;
    }, [id, isLive]);

    const runSequence = useCallback(async (actions: ITimerAction[]) => {
        // Only the master window (projector in electron, or main window in web) executes actions
        const isMaster = isProjector || !IpcService.isElectron();
        if (!isLive || !isMaster || isPreloading) return;

        for (const action of actions) {
            // Sequence Halt: Wait
            if (action.type === 'wait') {
                const duration = (action.payload.duration || 0) * 1000;
                if (duration > 0) {
                    await new Promise(resolve => setTimeout(resolve, duration));
                }
                continue;
            }

            // Sequence Halt: Key Halt
            if (action.type === 'key_halt') {
                const targetKey = action.payload.key || 'Enter';
                await new Promise<void>(resolve => {
                    const id = crypto.randomUUID();
                    keyResolvers.current.set(id, (pressedKey) => {
                        if (pressedKey.toLowerCase() === targetKey.toLowerCase()) {
                            keyResolvers.current.delete(id);
                            resolve();
                        }
                    });
                });
                continue;
            }

            // Navigation Actions (NOW NON-TERMINAL)
            if (action.type === 'next_slide') {
                LiveSyncService.sendTimerAction('next_slide');
                // Give a small delay to ensure IPC is processed before any subsequent sequence steps
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (action.type === 'prev_slide') {
                LiveSyncService.sendTimerAction('prev_slide');
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (action.type === 'navigate_to' && action.payload?.slideId) {
                LiveSyncService.sendTimerAction('navigate_to', { slideId: action.payload.slideId });
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Standard Actions
            switch (action.type) {
                case 'apply_override':
                    LiveSyncService.sendTimerAction('override', action.payload?.override || 'blackout');
                    break;
                case 'close_override':
                    LiveSyncService.sendTimerAction('override', null);
                    break;
                case 'blackout':
                    LiveSyncService.sendTimerAction('override', 'blackout');
                    break;
                case 'play_sound':
                    const soundId = action.payload.soundId || 'ring_default';
                    const mediaId = action.payload.mediaId;

                    if (mediaId) {
                        // Play User Media from Library
                        audioService.playScope({
                            id: `timer-audio-${id}-${action.id}`,
                            presentationId: '',
                            startSlideId: id,
                            endSlideId: id,
                            fileId: mediaId,
                            volume: action.payload?.volume ?? 1,
                            loop: false
                        });
                    } else {
                        // Play Synthesized Sounds
                        const playTone = (ctx: AudioContext, freq: number, dur: number, type: OscillatorType, delay: number = 0, vol: number = 0.1) => {
                            const osc = ctx.createOscillator();
                            const g = ctx.createGain();
                            osc.connect(g);
                            g.connect(ctx.destination);
                            osc.type = type;
                            osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
                            g.gain.setValueAtTime(0.001, ctx.currentTime + delay);
                            g.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.02);
                            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
                            osc.start(ctx.currentTime + delay);
                            osc.stop(ctx.currentTime + delay + dur);
                        };

                        try {
                            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                            const ctx = new AudioContextClass();
                            if (ctx.state === 'suspended') {
                                await ctx.resume();
                            }
                            
                            switch (soundId) {
                                case 'ring_default': playTone(ctx, 880, 0.4, 'sine'); break;
                                case 'ring_double':
                                    playTone(ctx, 880, 0.1, 'sine', 0);
                                    playTone(ctx, 880, 0.1, 'sine', 0.15);
                                    break;
                                case 'ring_bell':
                                    playTone(ctx, 880, 1.2, 'sine', 0, 0.05);
                                    playTone(ctx, 1100, 1.2, 'sine', 0, 0.03);
                                    playTone(ctx, 1320, 1.2, 'sine', 0, 0.02);
                                    break;
                                case 'ring_chime':
                                    playTone(ctx, 523.25, 0.5, 'sine', 0);
                                    playTone(ctx, 659.25, 0.5, 'sine', 0.2);
                                    playTone(ctx, 783.99, 0.8, 'sine', 0.4);
                                    break;
                                case 'ring_retro':
                                    playTone(ctx, 440, 0.1, 'square', 0, 0.05);
                                    playTone(ctx, 440, 0.1, 'square', 0.15, 0.05);
                                    playTone(ctx, 440, 0.1, 'square', 0.3, 0.05);
                                    break;
                                case 'ring_uplift':
                                    playTone(ctx, 261.63, 1.5, 'sine', 0, 0.1);
                                    playTone(ctx, 329.63, 1.5, 'sine', 0.2, 0.1);
                                    playTone(ctx, 392.00, 1.5, 'sine', 0.4, 0.1);
                                    playTone(ctx, 493.88, 1.5, 'sine', 0.6, 0.1);
                                    playTone(ctx, 523.25, 2.0, 'sine', 0.8, 0.2);
                                    for (let i = 0; i < 8; i++) {
                                        const startTime = 2.5 + (i * 0.8);
                                        playTone(ctx, 659.25, 0.3, 'triangle', startTime, 0.05);
                                        playTone(ctx, 523.25, 0.2, 'sine', startTime + 0.1, 0.03);
                                    }
                                    playTone(ctx, 261.63, 1.0, 'sine', 9.0, 0.5);
                                    break;
                                case 'ring_shimmer':
                                    playTone(ctx, 185.00, 2.5, 'sine', 0, 0.1);
                                    playTone(ctx, 739.99, 0.6, 'sine', 0.2, 0.05);
                                    playTone(ctx, 830.61, 0.6, 'sine', 0.4, 0.05);
                                    playTone(ctx, 932.33, 0.6, 'sine', 0.6, 0.05);
                                    playTone(ctx, 1108.73, 1.2, 'sine', 0.8, 0.08);
                                    for (let i = 0; i < 4; i++) {
                                        const beat = 2.5 + (i * 1.5);
                                        playTone(ctx, 554.37, 0.2, 'sine', beat, 0.05);
                                        playTone(ctx, 739.99, 0.1, 'triangle', beat + 0.15, 0.02);
                                    }
                                    playTone(ctx, 369.99, 1.5, 'sine', 8.5, 0.1);
                                    break;
                                case 'ring_cathedral':
                                    playTone(ctx, 174.61, 4.0, 'triangle', 0, 0.2);
                                    playTone(ctx, 349.23, 3.0, 'sine', 0.05, 0.1);
                                    playTone(ctx, 440.00, 2.5, 'sine', 0.1, 0.05);
                                    playTone(ctx, 174.61, 5.0, 'sine', 2.0, 0.05);
                                    playTone(ctx, 220.00, 4.5, 'sine', 2.5, 0.04);
                                    playTone(ctx, 261.63, 4.0, 'sine', 3.0, 0.04);
                                    playTone(ctx, 349.23, 3.5, 'sine', 3.5, 0.03);
                                    playTone(ctx, 130.81, 2.0, 'sine', 8.0, 0.1);
                                    break;
                                default: playTone(ctx, 880, 0.4, 'sine');
                            }
                        } catch (e) {
                            console.error('Failed to play trigger sound:', e);
                        }
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
                    audioService.stopAll(action.payload.duration ?? 0.5);
                    break;
            }
        }
    }, [id, isLive]);

    const handleEndAction = useCallback(() => {
        const isMaster = isProjector || !IpcService.isElectron();
        if (!isLive || !isMaster || isPreloading) return;
        if (settingsRef.current.endAction === 'loop') {
            setTimeLeft(settingsRef.current.duration);
            firedTriggers.current.clear();
        } else if (settingsRef.current.endAction === 'next') {
            LiveSyncService.sendTimerAction('next_slide');
        }
    }, [isLive]);

    useEffect(() => {
        if (!isLive || isPreloading) return;

        const interval = setInterval(() => {
            if (isPaused) return;

            const currentSettings = settingsRef.current;

            setTimeLeft(prev => {
                const remaining = Math.max(0, prev - 1);

                // Triggers logic moved inside here to stay in sync with actual ticks
                if (currentSettings.triggers) {
                    currentSettings.triggers.forEach(trigger => {
                        let shouldFire = false;
                        const elapsedFromStart = currentSettings.duration - remaining;

                        const triggerType = trigger.type;

                        switch (triggerType) {
                            case 'on_start':
                            case 'start' as string: // Legacy support
                                // Fire if we are within the first second of starting
                                if (elapsedFromStart <= 1) shouldFire = true;
                                break;
                            case 'on_end':
                            case 'finish' as string: // Legacy support
                                if (remaining === 0) shouldFire = true;
                                break;
                            case 'remaining':
                                if ('value' in trigger && remaining === trigger.value) shouldFire = true;
                                break;
                            case 'elapsed':
                                if ('value' in trigger && elapsedFromStart === trigger.value) shouldFire = true;
                                break;
                            case 'percentage':
                                if ('value' in trigger) {
                                    const currentPct = (elapsedFromStart / currentSettings.duration) * 100;
                                    if (currentPct >= trigger.value) shouldFire = true;
                                }
                                break;
                        }

                        if (shouldFire && !firedTriggers.current.has(trigger.id)) {
                            firedTriggers.current.add(trigger.id);
                            runSequence(trigger.actions);
                        }
                    });
                }

                if (remaining === 0) {
                    clearInterval(interval);
                    // Minimal delay to allow audio synthesis to start before unmounting
                    setTimeout(() => {
                        handleEndAction();
                    }, 50);
                }

                return remaining;
            });
        }, 1000);

        return () => clearInterval(interval);
        }, [isLive, id, runSequence, handleEndAction]);

    // Keyboard sequence handling
    useEffect(() => {
        const isMaster = isProjector || !IpcService.isElectron();
        if (!isLive || !isMaster || isPreloading) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Resolve all key-halt promises that match this key
            keyResolvers.current.forEach(resolve => resolve(e.key));

            // Also check for direct keyboard triggers
            if (settingsRef.current.triggers) {
                settingsRef.current.triggers
                    .filter(t => t.type === 'on_keypress' && t.triggerValue === e.key)
                    .forEach(trigger => {
                        // Key triggers can fire multiple times, so we don't check firedTriggers.current
                        runSequence(trigger.actions);
                    });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLive, runSequence]);

    const formatTime = useCallback((seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    return {
        timeLeft,
        isPaused,
        showFlash,
        formatTime,
    };
};
