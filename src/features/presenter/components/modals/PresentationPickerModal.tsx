import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ISlide, ICanvasSlide } from '@/core/types';
import { X, Layers, Monitor, Music, Plus, Search, Folder } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import { useContainFit } from '@/core/hooks/useContainFit';
import TrackContainer from '../timeline/TrackContainer';

const ModalAudioScope: React.FC<{
    scope: any;
    startIdx: number;
    endIdx: number;
    visualTimeline: any[];
}> = ({ scope, startIdx, endIdx, visualTimeline }) => {
    const left = visualTimeline[startIdx]?.x || 0;
    const right = visualTimeline[endIdx] ? (visualTimeline[endIdx].x + visualTimeline[endIdx].width) : left;
    const width = right - left;

    if (width <= 0) return null;

    return (
        <div
            className="absolute top-0 h-10 bg-purple-500/20 border border-purple-500/30 rounded-lg flex items-center px-3 overflow-hidden backdrop-blur-sm shadow-lg shadow-purple-500/5 animate-in fade-in zoom-in-95 duration-300"
            style={{ left, width, marginTop: '8px' }}
        >
            <Music className="w-3.5 h-3.5 text-purple-400 mr-2 shrink-0" />
            <span className="text-[10px] font-black text-purple-100 truncate uppercase tracking-wider">{scope.fileName || 'Audio Track'}</span>
        </div>
    );
};

const PresentationPickerModal: React.FC = () => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const { closeModal, stack } = useModalStore();
    // Find the LAST instance to correctly support nested modals
    const modalData = [...stack].reverse().find(m => m.id === ModalType.PRESENTATION_PICKER);
    const isOpen = !!modalData;

    const { addPresentationToTimeline, activeServiceId } = usePresentationStore();

    const [selectedPresentationId, setSelectedPresentationId] = useState<string | null>(null);
    const [previewSlideId, setPreviewSlideId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const allPresentations = useLiveQuery(() => db.presentationFiles.toArray()) || [];
    const allTemplates = useLiveQuery(() => db.templates.toArray()) || [];
    const allBlocks = useLiveQuery(() => db.blocks.toArray()) || [];
    
    const templatesMap = useMemo(() => new Map(allTemplates.map(t => [t.id, t])), [allTemplates]);
    const blocksMap = useMemo(() => new Map(allBlocks.map(b => [b.id, b])), [allBlocks]);

    // Filter for current service's presentations
    const availablePresentations = useMemo(() => {
        if (!activeServiceId) return [];
        let filtered = allPresentations.filter(p => p.serviceId === activeServiceId);
        
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(p => p.name.toLowerCase().includes(query));
        }
        
        return filtered.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    }, [allPresentations, searchQuery]);

    const activePresentation = useMemo(() => {
        return allPresentations.find(p => p.id === selectedPresentationId) || null;
    }, [allPresentations, selectedPresentationId]);

    const slides = useMemo(() => {
        const s = activePresentation?.slides || [];
        return [...s].sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [activePresentation]);

    const visualTimeline = useMemo(() => {
        const items: Array<{
            id: string,
            width: number,
            x: number,
            type: 'slide',
            slide: ISlide,
        }> = [];

        const TILE_WIDTH = 160; 
        const TILE_GAP = 12;

        let currentX = 0;

        for (const slide of slides) {
            items.push({
                id: slide.id,
                width: TILE_WIDTH,
                x: currentX,
                type: 'slide',
                slide,
            });
            currentX += TILE_WIDTH + TILE_GAP;
        }
        return items;
    }, [slides]);

    const slideToIndexMap = useMemo(() => {
        const map = new Map<string, number>();
        visualTimeline.forEach((item, idx) => {
            map.set(item.id, idx);
        });
        return map;
    }, [visualTimeline]);

    // Audio scopes from slides
    const allScopes = useMemo(() => {
        const scopes: Array<{ scope: any; startIdx: number; endIdx: number }> = [];
        const seenScopeIds = new Set<string>();

        slides.forEach((s) => {
            if (s.type === 'normal' && (s as ICanvasSlide).audioScopes) {
                for (const scope of (s as ICanvasSlide).audioScopes!) {
                    if (seenScopeIds.has(scope.id)) continue;

                    const sIdx = slideToIndexMap.get(scope.startSlideId);
                    const eIdx = slideToIndexMap.get(scope.endSlideId);

                    if (sIdx !== undefined && eIdx !== undefined) {
                        scopes.push({ scope: { ...scope, fileName: scope.fileName || scope.fileId.split('/').pop() }, startIdx: sIdx, endIdx: eIdx });
                        seenScopeIds.add(scope.id);
                    }
                }
            }
        });
        return scopes;
    }, [slides, slideToIndexMap]);

    // Auto-select first slide for preview when presentation changes
    useEffect(() => {
        if (slides.length > 0) {
            setPreviewSlideId(slides[0].id);
        } else {
            setPreviewSlideId(null);
        }
    }, [selectedPresentationId, slides]);

    const { width: fitWidth, height: fitHeight, containerRef } = useContainFit(16 / 9, 32);

    if (!isOpen) return null;

    const handleAdd = () => {
        if (!selectedPresentationId) return;
        
        // Find insertion index: after the currently selected slide
        const { activePresentation, selectedSlideIds } = usePresentationStore.getState();
        let insertionIndex: number | undefined;
        
        if (activePresentation && selectedSlideIds.length > 0) {
            const lastSelectedIndex = activePresentation.slides.findIndex(s => s.id === selectedSlideIds[selectedSlideIds.length - 1]);
            if (lastSelectedIndex !== -1) {
                insertionIndex = lastSelectedIndex + 1;
            }
        }

        addPresentationToTimeline(selectedPresentationId, insertionIndex);
        closeModal(ModalType.PRESENTATION_PICKER);
    };

    const currentPreviewSlide = slides.find(s => s.id === previewSlideId) || slides[0];

    return createPortal(
        <div className="fixed inset-0 z-10001 flex items-center justify-center bg-black/85 backdrop-blur-2xl animate-in fade-in duration-300 p-6">
            <div className="bg-stone-900 border border-white/10 rounded-[40px] w-full max-w-7xl h-[90vh] flex overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-500">
                
                {/* Left Sidebar - Presentation Selection */}
                <div className="w-80 shrink-0 border-r border-white/5 bg-stone-900/50 flex flex-col z-20">
                    <div className="p-6 border-b border-white/5 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">
                                {t('store')}
                            </h2>
                            <button
                                onClick={() => closeModal(ModalType.PRESENTATION_PICKER)}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-stone-400 hover:text-white transition-all active:scale-95"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                            <input
                                type="text"
                                placeholder={t('search_presentations')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 custom-scrollbar">
                        {availablePresentations.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedPresentationId(p.id)}
                                className={cn(
                                    "flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 group relative overflow-hidden",
                                    selectedPresentationId === p.id 
                                        ? "bg-accent/10 border-accent/30 shadow-[0_0_20px_rgba(147,51,234,0.15)]" 
                                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                                )}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={cn(
                                        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                        selectedPresentationId === p.id ? "bg-accent text-white" : "bg-black/30 text-stone-400 group-hover:text-stone-300"
                                    )}>
                                        <Layers className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn(
                                            "text-xs font-bold truncate transition-colors",
                                            selectedPresentationId === p.id ? "text-white" : "text-stone-300 group-hover:text-white"
                                        )}>
                                            {p.name}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-stone-500">
                                        {p.slides.length} {t('slides')}
                                    </span>
                                    {p.binId && (
                                        <div className="flex items-center gap-1 text-stone-600">
                                            <Folder className="w-3 h-3" />
                                            <span className="text-[8px] font-bold uppercase tracking-wider truncate max-w-[80px]">Bin</span>
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}

                        {availablePresentations.length === 0 && (
                            <div className="text-center py-10 flex flex-col items-center justify-center gap-3 text-stone-500">
                                <Layers className="w-8 h-8 opacity-20" />
                                <span className="text-[10px] font-black uppercase tracking-widest">{t('no_presentations_found')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Area - Preview */}
                <div className="flex-1 flex flex-col overflow-hidden bg-black/20">
                    {/* Top: Large Preview Area */}
                    <div
                        ref={containerRef}
                        className="flex-1 flex flex-col items-center justify-center relative overflow-hidden group/main-preview"
                    >
                        {!activePresentation ? (
                            <div className="text-stone-700 flex flex-col items-center gap-6">
                                <div className="w-24 h-24 rounded-[32px] bg-white/5 flex items-center justify-center border border-white/5">
                                    <Layers className="w-10 h-10 opacity-20" />
                                </div>
                                <p className="text-sm font-black uppercase tracking-widest opacity-30">{t('select_to_preview')}</p>
                            </div>
                        ) : currentPreviewSlide && fitWidth && fitHeight ? (
                            <>
                                {/* Background Decor */}
                                <div className="absolute inset-0 opacity-10 pointer-events-none">
                                    <div className="absolute inset-0 bg-radial-gradient from-accent/30 to-transparent scale-150" />
                                </div>
                                
                                <div
                                    className="relative shadow-[0_40px_100px_rgba(0,0,0,0.6)] rounded-[32px] overflow-hidden border border-white/10 ring-8 ring-white/5 animate-in fade-in zoom-in-95 duration-700 pointer-events-none"
                                    style={{ width: fitWidth, height: fitHeight }}
                                >
                                    <SlideContentRenderer
                                        template={templatesMap.get(currentPreviewSlide.templateId)}
                                        block={blocksMap.get(currentPreviewSlide.blockId)}
                                        variables={currentPreviewSlide.type === 'normal' ? (currentPreviewSlide as ICanvasSlide).content?.variables : undefined}
                                        lang={lang}
                                        backgroundOverride={currentPreviewSlide.type === 'normal' ? (currentPreviewSlide as ICanvasSlide).backgroundOverride : undefined}
                                        canvasItems={currentPreviewSlide.type === 'normal' ? (currentPreviewSlide as ICanvasSlide).content?.canvasItems : []}
                                        slide={currentPreviewSlide}
                                        scale={fitWidth / 1920}
                                    />

                                    <div className="absolute bottom-8 left-8 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl px-5 py-3 shadow-2xl">
                                        <p className="text-xs font-black text-white uppercase tracking-widest mb-1">
                                            {(currentPreviewSlide.type === 'normal' ? (currentPreviewSlide as ICanvasSlide).content?.variables?.title : undefined) || t('no_title')}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                                            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                                                {blocksMap.get(currentPreviewSlide.blockId)?.name || currentPreviewSlide.blockId}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-stone-700 flex flex-col items-center gap-6 animate-pulse">
                                <div className="w-24 h-24 rounded-[32px] bg-white/5 flex items-center justify-center border border-white/5">
                                    <Monitor className="w-10 h-10 opacity-20" />
                                </div>
                                <p className="text-sm font-black uppercase tracking-widest opacity-30">{t('preparing_preview')}</p>
                            </div>
                        )}
                    </div>

                    {/* Bottom: Horizontal Timeline Area */}
                    <div className={cn(
                        "h-[240px] shrink-0 bg-stone-950 border-t border-white/10 flex flex-col relative shadow-[0_-20px_50px_rgba(0,0,0,0.4)] z-10 transition-opacity duration-300",
                        activePresentation ? "opacity-100" : "opacity-50 pointer-events-none grayscale"
                    )}>
                        <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-stone-900/40 backdrop-blur-md">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
                                    {t('timeline')}
                                </span>
                                <div className="w-px h-3 bg-white/10" />
                                <span className="text-[9px] font-bold text-stone-600 uppercase tracking-widest">
                                    {slides.length} {t('slides')}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 relative flex">
                            {/* Track Names */}
                            <div className="w-16 shrink-0 border-r border-white/5 bg-stone-900/40 flex flex-col z-20 backdrop-blur-md">
                                <div className="h-[104px] flex flex-col items-center justify-center gap-1 opacity-40">
                                    <Monitor className="w-4 h-4 text-stone-400" />
                                    <span className="text-[7px] font-black uppercase tracking-widest text-stone-500">{t('slides')}</span>
                                </div>
                                <div className="h-14 border-t border-white/5 flex flex-col items-center justify-center gap-1 bg-purple-500/5 opacity-50">
                                    <Music className="w-3 h-3 text-purple-400" />
                                    <span className="text-[7px] font-black uppercase tracking-widest text-purple-500">{t('audio')}</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden relative">
                                <TrackContainer className="px-8">
                                    <div className="flex flex-col min-w-full py-4 gap-2">
                                        {/* Slides Lane */}
                                        <div className="flex gap-3 relative h-24">
                                            {visualTimeline.map((item, index) => {
                                                const slide = item.slide;
                                                const template = templatesMap.get(slide.templateId);
                                                const block = blocksMap.get(slide.blockId);
                                                const isCurrent = previewSlideId === slide.id;

                                                return (
                                                    <div
                                                        key={slide.id}
                                                        data-slide-id={slide.id}
                                                        className={cn(
                                                            "group relative shrink-0 rounded-2xl border-2 transition-all cursor-pointer overflow-hidden leading-none",
                                                            isCurrent
                                                                ? "border-accent ring-4 ring-accent/10 scale-105 z-10 shadow-xl shadow-accent/10"
                                                                : "border-white/5 hover:border-white/20 bg-stone-900"
                                                        )}
                                                        style={{ width: item.width }}
                                                        onClick={() => setPreviewSlideId(slide.id)}
                                                    >
                                                        <div className="absolute inset-0 z-0 pointer-events-none">
                                                            <SlideContentRenderer
                                                                template={template}
                                                                block={block}
                                                                variables={slide.type === 'normal' ? (slide as ICanvasSlide).content?.variables : undefined}
                                                                lang={lang}
                                                                isPreview={true}
                                                                scale={item.width / 1920}
                                                                backgroundOverride={slide.type === 'normal' ? (slide as ICanvasSlide).backgroundOverride : undefined}
                                                                canvasItems={slide.type === 'normal' ? (slide as ICanvasSlide).content?.canvasItems : []}
                                                                slide={slide}
                                                            />
                                                        </div>

                                                        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-black/40 backdrop-blur-md border border-white/5 text-[8px] font-black text-stone-400 z-10 tracking-widest">
                                                            {(slide.order || index) + 1}
                                                        </div>

                                                        <div className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-black/80 to-transparent z-10 p-2 flex flex-col justify-end">
                                                            <p className="text-[7px] font-black text-white/80 uppercase truncate">
                                                                {(slide.type === 'normal' ? (slide as ICanvasSlide).content?.variables?.title : undefined) || `${t('slide')} ${index + 1}`}
                                                            </p>
                                                        </div>

                                                        <div className={cn(
                                                            "absolute inset-0 bg-accent/5 transition-opacity duration-300",
                                                            isCurrent ? "opacity-100" : "opacity-0"
                                                        )} />
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Audio Lane */}
                                        <div className="flex relative h-14 bg-purple-500/5 rounded-2xl border border-purple-500/5 mt-1">
                                            {allScopes.map(({ scope, startIdx, endIdx }) => (
                                                <ModalAudioScope
                                                    key={scope.id}
                                                    scope={scope}
                                                    startIdx={startIdx}
                                                    endIdx={endIdx}
                                                    visualTimeline={visualTimeline}
                                                />
                                            ))}
                                            {allScopes.length === 0 && (
                                                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                                    <span className="text-[8px] text-stone-500 font-bold uppercase tracking-widest">{t('no_audio_tracks')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TrackContainer>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-8 py-5 border-t border-white/5 bg-stone-900 flex items-center justify-end shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] z-20">
                        <div className="flex flex-col items-end gap-3 w-full">
                            <button
                                onClick={handleAdd}
                                disabled={!selectedPresentationId}
                                className={cn(
                                    "group px-10 py-3.5 font-black rounded-2xl transition-all border shadow-2xl text-xs uppercase tracking-widest flex items-center gap-3",
                                    selectedPresentationId
                                        ? "bg-accent text-black border-accent-hover shadow-accent/30 hover:scale-[1.02] active:scale-[0.98]"
                                        : "bg-stone-800 text-stone-500 border-white/5 cursor-not-allowed opacity-50"
                                )}
                            >
                                <Plus className={cn("w-5 h-5 transition-transform group-hover:rotate-90 duration-500", !selectedPresentationId && "opacity-20")} />
                                {t('add_to_timeline')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PresentationPickerModal;
