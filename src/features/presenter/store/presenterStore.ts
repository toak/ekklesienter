import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PresenterSettings, ILogo, ILogoGroup, IStyleLayer, BackgroundSettings } from '@/core/types';
import { ensureLayers } from '@/core/utils/styleMigration';
import { PresenterService } from '../services/presenterService';
import { LiveSyncService } from '@/core/services/liveSyncService';

interface PresenterStore {
    settings: PresenterSettings;
    draftSettings: PresenterSettings | null;
    startEditing: () => void;
    updateDraft: (update: Partial<PresenterSettings> | ((prev: PresenterSettings) => PresenterSettings)) => void;
    commitDraft: () => void;
    cancelEditing: () => void;
    updateBackground: (layers: IStyleLayer[]) => void;
    updateFont: (font: Partial<PresenterSettings['font']>) => void;
    updateReference: (ref: Partial<PresenterSettings['reference']>) => void;
    updateTranslationLabel: (label: Partial<PresenterSettings['translationLabel']>) => void;
    updateDisplay: (display: Partial<PresenterSettings['display']>) => void;
    updateLogo: (logo: Partial<PresenterSettings['logo']>) => void;
    updateAudioSettings: (audio: Partial<PresenterSettings['audio']>) => void;
    updateStageSettings: (stage: Partial<PresenterSettings['stage']>) => void;
    toggleStageQr: (show: boolean) => void;
    updateOverrideBackground: (type: 'blackout' | 'whiteout' | 'logo', layers: IStyleLayer[]) => void;
    addCustomLogo: (logo: ILogo) => void;
    removeCustomLogo: (logoId: string) => void;
    setActiveLogo: (logoId: string | null) => void;
    addLogoGroup: (group: ILogoGroup) => void;
    removeLogoGroup: (groupId: string) => void;
    addLogosToGroup: (logos: ILogo[], groupId: string) => void;
    moveLogoToGroup: (logoId: string, targetGroupId: string | null) => void;
    setSettings: (settings: PresenterSettings) => void;
    resetSettings: () => void;
    syncSettings: () => void;
}

export const DEFAULT_SETTINGS: PresenterSettings = {
    background: [
        {
            id: 'default-bg',
            type: 'gradient',
            visible: true,
            opacity: 1,
            blendMode: 'normal',
            gradient: {
                from: '#1c1917', // stone-900
                to: '#0c0a09', // stone-950
                angle: 135
            },
            adjustments: {
                brightness: 100,
                contrast: 100,
                exposure: 0,
                saturation: 100,
                vibrance: 0,
                hue: 0,
                blur: 0,
                dimmingColor: '#000000',
                dimmingOpacity: 0
            },
            media: {
                speed: 1,
                isLooping: true,
                framing: 'fill',
                scale: 1
            }
        }
    ],
    font: {
        family: 'serif',
        weight: '400',
        size: 56, // 3.5rem * 16
        color: '#f5f5f4', // stone-100
        shadow: false,
        shadowColor: 'rgba(0,0,0,0.8)',
        shadowBlur: 12,
        shadowOffsetX: 0,
        shadowOffsetY: 4,
        showSuperscript: true
    },
    reference: {
        style: 'classic',
        position: 'bottom',
        opacity: 0.9,
        scale: 0.4,
        fontSize: 19, // ~1.2rem * 16
        color: '#f5f5f4', // stone-100
        fontFamily: 'sans'
    },
    translationLabel: {
        enabled: true,
        color: '#f5f5f4', // stone-100
        opacity: 0.3,
        fontSize: 13, // ~0.8rem * 16
        fontFamily: 'sans'
    },
    display: {
        autoDefine: true,
        cornerRadius: 0,
        referenceGap: 16,
        translationGap: 32,
        verseGap: 24,
        padding: {
            top: 48,
            bottom: 48,
            left: 64,
            right: 64
        }
    },
    logo: {
        activeLogoId: null,
        customLogos: [],
        customGroups: [],
        logoGroups: []
    },
    stage: {
        layout: [
            { id: 'current', visible: true, x: 0, y: 0, w: 8, h: 8 },
            { id: 'next', visible: true, x: 8, y: 0, w: 4, h: 4 },
            { id: 'prev', visible: true, x: 8, y: 4, w: 4, h: 4 },
            { id: 'sound', visible: true, x: 0, y: 8, w: 12, h: 2 }
        ],
        gap: 24,
        cornerRadius: 24,
        showRemoteQr: false
    },
    audio: {
        defaultFadeDuration: 1.0
    },
    overrides: {
        blackout: {
            background: [{
                id: 'blackout-bg',
                type: 'color',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                color: '#000000',
                adjustments: { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, hue: 0, blur: 0 }
            }]
        },
        whiteout: {
            background: [{
                id: 'whiteout-bg',
                type: 'color',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                color: '#ffffff',
                adjustments: { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, hue: 0, blur: 0 }
            }]
        },
        logo: {
            background: [{
                id: 'logo-bg',
                type: 'color',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                color: '#0c0a09', // stone-950
                adjustments: { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, hue: 0, blur: 0 }
            }]
        }
    }
};

export const usePresenterStore = create<PresenterStore>()(
    persist(
        (set, get) => ({
            settings: DEFAULT_SETTINGS,
            draftSettings: null,

            startEditing: () => {
                set({ draftSettings: structuredClone(get().settings) });
            },

            updateDraft: (update) => {
                set((state) => {
                    if (!state.draftSettings) return state;

                    let newDraft: PresenterSettings;
                    if (typeof update === 'function') {
                        newDraft = update(state.draftSettings);
                    } else {
                        newDraft = { ...state.draftSettings, ...update };
                    }

                    return { draftSettings: newDraft };
                });
            },

            commitDraft: () => {
                const { draftSettings } = get();
                if (draftSettings) {
                    set({ settings: draftSettings, draftSettings: null });
                    get().syncSettings();
                }
            },

            cancelEditing: () => {
                set({ draftSettings: null });
            },

            updateBackground: (layers) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        background: layers
                    }
                }));
                get().syncSettings();
            },

            updateFont: (font) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        font: { ...state.settings.font, ...font }
                    }
                }));
                get().syncSettings();
            },

            updateReference: (ref) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        reference: { ...state.settings.reference, ...ref }
                    }
                }));
                get().syncSettings();
            },

            updateTranslationLabel: (label) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        translationLabel: { ...state.settings.translationLabel, ...label }
                    }
                }));
                get().syncSettings();
            },

            updateDisplay: (display) => {
                set((state) => {
                    const newDisplay = { ...state.settings.display, ...display };
                    const nextState: Partial<PresenterStore> = {
                        settings: { ...state.settings, display: newDisplay }
                    };

                    if (state.draftSettings) {
                        nextState.draftSettings = {
                            ...state.draftSettings,
                            display: { ...state.draftSettings.display, ...display }
                        };
                    }

                    return nextState;
                });
                get().syncSettings();
            },

            updateLogo: (logo) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        logo: { ...state.settings.logo, ...logo }
                    }
                }));
                get().syncSettings();
            },

            updateAudioSettings: (audio) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        audio: { ...state.settings.audio, ...audio }
                    }
                }));
                get().syncSettings();
            },

            updateStageSettings: (stage) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        stage: { ...state.settings.stage, ...stage }
                    }
                }));
                get().syncSettings();
            },

            toggleStageQr: (show) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        stage: { ...state.settings.stage, showRemoteQr: show }
                    }
                }));
                get().syncSettings();
            },

            updateOverrideBackground: (type, layers) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        overrides: {
                            ...state.settings.overrides,
                            [type]: {
                                ...state.settings.overrides[type],
                                background: layers
                            }
                        }
                    }
                }));
                get().syncSettings();
            },

            addCustomLogo: (logo: ILogo) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        logo: {
                            ...state.settings.logo,
                            customLogos: [...state.settings.logo.customLogos, logo]
                        }
                    }
                }));
                get().syncSettings();
            },

            removeCustomLogo: (logoId: string) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        logo: {
                            ...state.settings.logo,
                            customLogos: state.settings.logo.customLogos.filter(l => l.id !== logoId),
                            activeLogoId: state.settings.logo.activeLogoId === logoId ? null : state.settings.logo.activeLogoId
                        }
                    }
                }));
                get().syncSettings();
            },

            setActiveLogo: (logoId: string | null) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        logo: { ...state.settings.logo, activeLogoId: logoId }
                    }
                }));
                get().syncSettings();
            },

            addLogoGroup: (group: ILogoGroup) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        logo: {
                            ...state.settings.logo,
                            customGroups: [...state.settings.logo.customGroups, group]
                        }
                    }
                }));
                get().syncSettings();
            },

            removeLogoGroup: (groupId: string) => {
                set((state) => {
                    const group = state.settings.logo.customGroups.find(g => g.id === groupId);
                    const removedLogoIds = group ? group.logos.map(l => l.id) : [];
                    const wasActive = state.settings.logo.activeLogoId && removedLogoIds.includes(state.settings.logo.activeLogoId);
                    return {
                        settings: {
                            ...state.settings,
                            logo: {
                                ...state.settings.logo,
                                customGroups: state.settings.logo.customGroups.filter(g => g.id !== groupId),
                                activeLogoId: wasActive ? null : state.settings.logo.activeLogoId
                            }
                        }
                    };
                });
                get().syncSettings();
            },

            addLogosToGroup: (logos: ILogo[], groupId: string) => {
                set((state) => ({
                    settings: {
                        ...state.settings,
                        logo: {
                            ...state.settings.logo,
                            customGroups: state.settings.logo.customGroups.map(g =>
                                g.id === groupId
                                    ? { ...g, logos: [...g.logos, ...logos.map(l => ({ ...l, groupId }))] }
                                    : g
                            )
                        }
                    }
                }));
                get().syncSettings();
            },

            moveLogoToGroup: (logoId: string, targetGroupId: string | null) => {
                set((state) => {
                    // Find the logo across all sources
                    let movedLogo: ILogo | undefined;
                    let newCustomLogos = [...state.settings.logo.customLogos];
                    let newCustomGroups = state.settings.logo.customGroups.map(g => ({ ...g, logos: [...g.logos] }));

                    // Remove from ungrouped
                    const ungroupedIdx = newCustomLogos.findIndex(l => l.id === logoId);
                    if (ungroupedIdx !== -1) {
                        movedLogo = { ...newCustomLogos[ungroupedIdx] };
                        newCustomLogos.splice(ungroupedIdx, 1);
                    }

                    // Remove from any custom group
                    if (!movedLogo) {
                        for (const group of newCustomGroups) {
                            const idx = group.logos.findIndex(l => l.id === logoId);
                            if (idx !== -1) {
                                movedLogo = { ...group.logos[idx] };
                                group.logos.splice(idx, 1);
                                break;
                            }
                        }
                    }

                    if (!movedLogo) return state;

                    // Add to target
                    if (targetGroupId === null) {
                        movedLogo.groupId = undefined;
                        newCustomLogos.push(movedLogo);
                    } else {
                        movedLogo.groupId = targetGroupId;
                        newCustomGroups = newCustomGroups.map(g =>
                            g.id === targetGroupId ? { ...g, logos: [...g.logos, movedLogo!] } : g
                        );
                    }

                    return {
                        settings: {
                            ...state.settings,
                            logo: {
                                ...state.settings.logo,
                                customLogos: newCustomLogos,
                                customGroups: newCustomGroups
                            }
                        }
                    };
                });
                get().syncSettings();
            },

            setSettings: (settings) => {
                set({ settings });
            },

            resetSettings: () => {
                set({ settings: DEFAULT_SETTINGS });
                get().syncSettings();
            },
            syncSettings: () => {
                LiveSyncService.syncSettings(get().settings);
            }
        }),
        {
            name: 'presenter-settings',
            storage: createJSONStorage(() => localStorage),
            version: 3,
            migrate: (persistedState: unknown, version: number) => {
                const state = persistedState as { settings?: PresenterSettings };

                // Add default audio settings if missing
                if (state.settings && !state.settings.audio) {
                    state.settings.audio = DEFAULT_SETTINGS.audio;
                }
                
                // Add default stage settings if missing
                if (state.settings && !state.settings.stage) {
                    state.settings.stage = DEFAULT_SETTINGS.stage;
                }

                if (version === 0 && state.settings) {
                    state.settings.background = ensureLayers(state.settings.background as any);
                    if (state.settings.overrides) {
                        state.settings.overrides.blackout.background = ensureLayers(state.settings.overrides.blackout.background as any);
                        state.settings.overrides.whiteout.background = ensureLayers(state.settings.overrides.whiteout.background as any);
                        state.settings.overrides.logo.background = ensureLayers(state.settings.overrides.logo.background as any);
                    }
                }
                if (version === 2 && state.settings) {
                    const s = state.settings;
                    if (s.font && typeof s.font.size === 'number') s.font.size *= 16;
                    if (s.reference && typeof s.reference.fontSize === 'number') s.reference.fontSize *= 16;
                    if (s.translationLabel && typeof s.translationLabel.fontSize === 'number') s.translationLabel.fontSize *= 16;
                }
                return state as any; // Persist expects explicit return of state
            }
        }
    )
);
