import React, { useState, useMemo } from 'react';
import { cn } from '@/core/utils/cn';
import { ITemplate, IBlock, ICanvasItem } from '@/core/types';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';

interface ITemplatePickerProps {
    allTemplates: ITemplate[];
    allBlocks: Pick<IBlock, 'id' | 'name' | 'nameRu'>[];
    currentSlide: { id: string; templateId?: string; content?: { variables?: Record<string, unknown>; canvasItems?: ICanvasItem[] } } | undefined;
    presentation: { id: string; slides?: unknown[] } | undefined;
    updatePresentationSlides: (id: string, slides: unknown[]) => Promise<void>;
    isRu: boolean;
    t: (key: string, fallback?: string) => string;
    // Unused but kept for interface compatibility
    selectedAudioScopeId?: string | null;
    selectAudioScope?: (id: string | null) => void;
    activePresentation?: unknown;
    updateAudioScope?: (id: string, updates: unknown) => Promise<void>;
    removeAudioScope?: (id: string) => Promise<void>;
}

export const TemplatePicker: React.FC<ITemplatePickerProps> = ({
    allTemplates,
    allBlocks,
    currentSlide,
    presentation,
    updatePresentationSlides,
    isRu,
    t,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const blocksMap = useMemo(() => new Map(allBlocks.map(b => [b.id, b])), [allBlocks]);

    const filteredTemplates = useMemo(() => {
        return allTemplates.filter(template => {
            const matchesSearch = (isRu ? template.nameRu : template.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
                template.category?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = !selectedCategory || template.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [allTemplates, searchQuery, selectedCategory, isRu]);

    const handleSelectTemplate = async (template: ITemplate) => {
        if (!presentation || !currentSlide) return;
        const newSlides = ((presentation as Record<string, unknown>).slides as Array<Record<string, unknown>> || []).map(s =>
            s.id === currentSlide.id ? { ...s, templateId: template.id, backgroundOverride: undefined } : s
        );
        await updatePresentationSlides(presentation.id, newSlides);
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Search & Categories */}
            <div className="space-y-3">
                <input
                    type="text"
                    placeholder={t('search_templates', 'Search templates...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-accent/40"
                />
                <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border",
                            !selectedCategory ? "bg-accent/20 border-accent/30 text-accent" : "bg-white/5 border-white/5 text-stone-500 hover:text-stone-300"
                        )}
                    >
                        {t('all', 'All')}
                    </button>
                    {allBlocks.map(block => (
                        <button
                            key={block.id}
                            onClick={() => setSelectedCategory(block.id)}
                            className={cn(
                                "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border",
                                selectedCategory === block.id ? "bg-accent/20 border-accent/30 text-accent" : "bg-white/5 border-white/5 text-stone-500 hover:text-stone-300"
                            )}
                        >
                            {isRu ? block.nameRu : block.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-2 gap-3">
                {filteredTemplates.map((template) => {
                    const isActive = currentSlide?.templateId === template.id;
                    const block = blocksMap.get(template.category);

                    return (
                        <button
                            key={template.id}
                            onClick={() => handleSelectTemplate(template)}
                            className={cn(
                                "aspect-video rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden group/tpl",
                                isActive ? "border-accent ring-1 ring-accent/20" : "border-white/5 hover:border-white/20"
                            )}
                        >
                            <SlideContentRenderer
                                template={template}
                                block={block as IBlock | undefined}
                                variables={currentSlide?.content?.variables as Record<string, string> || {}}
                                lang={isRu ? 'ru' : 'en'}
                                isPreview={true}
                                scale={180 / 1920}
                                showLockBadge={!template.isUserCreated}
                                canvasItems={currentSlide?.content?.canvasItems || []}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/tpl:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-[8px] font-black text-white uppercase tracking-widest bg-black/60 px-2 py-1 rounded-lg backdrop-blur-sm">
                                    {isRu ? template.nameRu : template.name}
                                </span>
                            </div>
                            {isActive && (
                                <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-accent z-30" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
