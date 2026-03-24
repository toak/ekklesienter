import { StateCreator } from 'zustand';
import { ISlide, ICanvasSlide, IVerseSlide, ITimerSlide, ICanvasItem, IPresentationFile, IServiceFile, IPresentationSummary, IStyleLayer, BackgroundSettings, IAudioScope, ITimerSettings, ITemplate, IPresentationBin, ISlideTransition } from '@/core/types';

export interface PresentationState {
    activeServiceId: string | null;
    activePresentationId: string | null;
    selectedPresentationId: string | null;
    previewSlideId: string | null;
    liveSlideId: string | null;
    activeBlockId: string | null;
    selectedAudioScopeId: string | null;
    graceLibSection: 'templates' | 'presentations' | 'media' | null;
    graceLibMediaBins: Array<{ id: string, name: string, mediaIds: string[] }>;
    templateNavPath: Array<{ id: string, type: 'root' | 'all' | 'blocks' | 'template' | 'block', name?: string, nameRu?: string }>;
    presentationBinNavPath: string[];
    selectedSlideIds: string[];
    clipboard: { slideIds: string[], presentationId: string, isCut: boolean } | null;
    presentationStack: Array<{ presentationId: string; parentNestedSlideId: string }>;

    // Preloaded Data
    activeService: IServiceFile | null;
    activePresentation: IPresentationFile | null;
    selectedPresentation: IPresentationFile | null;
    cachedPresentation: IPresentationFile | null;
    recents: IPresentationSummary[];
    navigationParentSlideId: string | null;
    navigationDirection: 'forward' | 'backward';

    // UI Actions
    setActiveService: (id: string | null) => Promise<void>;
    setActivePresentation: (id: string | null) => Promise<void>;

    // Blind Mode Actions
    setPreviewSlide: (id: string | null, presentationId?: string | null) => Promise<void>;
    setLiveSlide: (id: string | null) => void;
    syncPreviewToLive: () => void;

    setActiveBlockId: (id: string | null) => void;
    setGraceLibSection: (section: 'templates' | 'presentations' | 'media' | null) => void;
    addMediaBin: (name: string) => Promise<void>;
    updateMediaBin: (binId: string, updates: Partial<{ name: string, mediaIds: string[] }>) => Promise<void>;
    removeMediaBin: (binId: string) => Promise<void>;
    addPresentationToGraceLib: (presentationId: string) => Promise<void>;

    // Template Actions
    setTemplateNavPath: (path: Array<{ id: string, type: 'root' | 'all' | 'blocks' | 'template' | 'block', name?: string, nameRu?: string }>) => void;
    pushTemplateNav: (item: { id: string, type: 'root' | 'all' | 'blocks' | 'template' | 'block', name?: string, nameRu?: string }) => void;
    popTemplateNav: () => void;
    updateTemplate: (templateId: string, updates: Partial<ITemplate>, force?: boolean) => Promise<void>;
    removeTemplate: (templateId: string, force?: boolean) => Promise<void>;
    overrideTemplateSlide: (templateId: string, slideId: string, sourceSlide: ISlide, force?: boolean) => Promise<void>;
    renameTemplateSlide: (templateId: string, slideId: string, newName: string, force?: boolean) => Promise<void>;
    removeTemplateSlide: (templateId: string, slideId: string, force?: boolean) => Promise<void>;

    // Presentation Bin Actions
    setPresentationBinNavPath: (path: string[]) => void;
    createPresentationBin: (name: string) => Promise<string>;
    renamePresentationBin: (id: string, newName: string) => Promise<void>;
    removePresentationBin: (id: string) => Promise<void>;
    movePresentationToBin: (presentationId: string, binId: string | null) => Promise<void>;

    // Timeline Structure
    toggleSlideExpansion: (slideId: string) => Promise<void>;
    detachNestedInstance: (slideId: string) => Promise<void>;

    // Audio Actions
    addAudioScope: (slideId: string, fileId: string, fileName?: string) => Promise<void>;
    updateAudioScopeBoundary: (scopeId: string, startSlideId: string, endSlideId: string) => Promise<void>;
    updateAudioScope: (scopeId: string, updates: Partial<IAudioScope>) => Promise<void>;
    removeAudioScope: (scopeId: string) => Promise<void>;
    selectAudioScope: (id: string | null) => void;
    resolveAudioConflict: (action: 'replace' | 'shift', params: { targetSlideId: string, fileId: string, overlappingScopes: IAudioScope[] }) => Promise<void>;

    // Data Actions
    loadRecents: () => Promise<void>;
    createService: (name: string) => Promise<string>;
    createPresentation: (name: string, options?: { serviceId?: string, isMaster?: boolean }) => Promise<string>;
    renamePresentation: (presentationId: string, newName: string) => Promise<void>;
    removePresentation: (presentationId: string) => Promise<void>;
    updatePresentationSlides: (presentationId: string, slides: ISlide[]) => Promise<void>;
    updateSlideVariable: (slideId: string, name: string, value: string) => Promise<void>;
    updateSlideBackground: (slideId: string, background: IStyleLayer[] | null) => Promise<void>;
    updateSlideTransition: (slideId: string, transition: ISlideTransition | undefined) => Promise<void>;
    updatePresentationEndTransition: (transition: ISlideTransition | undefined) => Promise<void>;
    triggerTransitionPreview: () => void;
    lastTransitionTrigger: number;
    applyBackgroundToAll: (background: IStyleLayer[]) => Promise<void>;
    saveActiveService: () => Promise<void>;
    duplicateSlide: (presentationId: string, slideId: string) => Promise<void>;
    duplicateSlides: (presentationId: string, slideIds: string[]) => Promise<void>;
    moveSlide: (presentationId: string, slideId: string, direction: 'back' | 'forth' | 'start' | 'end') => Promise<void>;
    removeSlide: (presentationId: string, slideId: string) => Promise<void>;
    removeSlides: (presentationId: string, slideIds: string[]) => Promise<void>;

    // Selection Actions
    setSelectedSlideIds: (ids: string[]) => void;
    toggleSlideSelection: (id: string, multi?: boolean, range?: boolean) => void;
    clearSelection: () => void;

    // Clipboard Actions
    copySlides: (presentationId: string, slideIds: string[], isCut?: boolean) => void;
    pasteSlides: (presentationId: string, targetIndex?: number) => Promise<void>;

    // Canvas Item CRUD
    addCanvasItem: (slideId: string, item: ICanvasItem) => Promise<void>;
    updateCanvasItem: (slideId: string, itemId: string, updates: Partial<ICanvasItem>) => Promise<void>;
    updateCanvasItems: (slideId: string, updates: Array<{ id: string, updates: Partial<ICanvasItem> }>) => Promise<void>;
    updateCanvasItemsOrder: (slideId: string, items: ICanvasItem[]) => Promise<void>;
    removeCanvasItem: (slideId: string, itemId: string) => Promise<void>;
    reorderCanvasItem: (slideId: string, itemId: string, direction: 'up' | 'down') => Promise<void>;
    setMediaBackground: (slideId: string, mediaItem: any) => Promise<void>;
    addMediaLayer: (slideId: string, mediaItem: any, position?: { x: number, y: number }) => Promise<void>;

    // Timer Actions
    updateTimerSettings: (slideId: string, settings: Partial<ITimerSettings>) => Promise<void>;

    // History Actions
    undo: () => Promise<void>;
    redo: () => Promise<void>;
    takeSnapshot: (slideId: string) => Promise<void>;
    navigateNext: (detached?: boolean) => Promise<void>;
    navigatePrev: (detached?: boolean) => Promise<void>;

    // Nested Stacks Actions
    addPresentationToTimeline: (presentationId: string, index?: number) => Promise<void>;
    saveNestedChanges: (options: { syncBack: boolean }) => Promise<void>;

    // Stage 1: Save Performance & Assets
    isSaving: boolean;
    saveActivePresentation: () => Promise<void>;
    importSlidesToService: (presentationName: string, slides: ISlide[]) => Promise<void>;
    syncNestedPresentation: (parentSlideId: string) => Promise<void>;
}

export type PresentationSliceCreator = StateCreator<
    PresentationState,
    [['zustand/persist', unknown]],
    [],
    Partial<PresentationState>
>;
