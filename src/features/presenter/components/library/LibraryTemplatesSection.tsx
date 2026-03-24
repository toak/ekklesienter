import React from 'react';
import { Layers, Layout, type LucideIcon, Presentation, Monitor, Music, Coins, Baby, Mic2, Megaphone, BookOpen, Plus } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ITemplate, ITemplateSlide, IBlock, ISlide } from '@/core/types';
import { GraceLibBin } from './GraceLibBin';
import { TemplatePreviewItem } from './TemplatePreviewItem';
import { GraceLibExportService } from '@/features/presenter/services/GraceLibExportService';
import { TFunction } from 'i18next';

export interface ITemplateNav {
    id: string;
    type: 'root' | 'all' | 'blocks' | 'template' | 'block';
    name?: string;
    nameRu?: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
    Monitor, Music, Coins, Baby, Mic2, Megaphone, BookOpen, Plus, Presentation, Layers, Layout
};

interface ILibraryTemplatesSectionProps {
    currentNav: ITemplateNav;
    allTemplates: ITemplate[];
    blocks: IBlock[];
    isRu: boolean;
    lang: string;
    t: TFunction;
    activePresentationId: string | null;
    selectedSlide: ISlide | undefined;
    devMode: boolean;
    pushTemplateNav: (nav: ITemplateNav) => void;
    handleTemplateClick: (template: ITemplate, templateSlideId?: string, isBefore?: boolean) => void;
    handleOverrideTemplateSlide: (template: ITemplate, layoutSlideId: string) => void;
    setContextMenu: (menu: { x: number; y: number; item: any; type: 'template' | 'media-bin' | 'template-slide' | 'presentation-bin' | 'presentation' } | null) => void;
}

export const LibraryTemplatesSection: React.FC<ILibraryTemplatesSectionProps> = ({
    currentNav,
    allTemplates,
    blocks,
    isRu,
    lang,
    t,
    activePresentationId,
    selectedSlide,
    devMode,
    pushTemplateNav,
    handleTemplateClick,
    handleOverrideTemplateSlide,
    setContextMenu
}) => {
    // Root view: All Templates & Blocks system bins
    if (currentNav.type === 'root') {
        return (
            <div className="grid grid-cols-1 gap-2">
                <GraceLibBin
                    id="all-templates"
                    name={t('all_templates', 'All Templates')}
                    icon={Layers}
                    isActive={false}
                    onClick={() => pushTemplateNav({ id: 'all-templates', type: 'all', name: 'All Templates' })}
                    description={t('all_templates_desc', 'Browse all available templates')}
                />
                <GraceLibBin
                    id="blocks-bin"
                    name={t('blocks', 'Blocks')}
                    icon={Layout}
                    isActive={false}
                    onClick={() => pushTemplateNav({ id: 'blocks-bin', type: 'blocks', name: 'Blocks' })}
                    description={t('blocks_desc', 'Filter templates by block types')}
                />
            </div>
        );
    }

    // All Templates view: List of template bins
    if (currentNav.type === 'all') {
        return (
            <div className="grid grid-cols-1 gap-2">
                {allTemplates.map((tmpl: ITemplate) => (
                    <GraceLibBin
                        key={tmpl.id}
                        id={tmpl.id}
                        name={isRu ? tmpl.nameRu : tmpl.name}
                        icon={Layers}
                        isActive={false}
                        onClick={() => pushTemplateNav({
                            id: tmpl.id,
                            type: 'template',
                            name: tmpl.name,
                            nameRu: tmpl.nameRu
                        })}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            if (tmpl.isUserCreated || devMode) {
                                setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    item: { id: tmpl.id, name: tmpl.name, nameRu: tmpl.nameRu, type: 'template', isSystem: !tmpl.isUserCreated },
                                    type: 'template'
                                });
                            }
                        }}
                        description={tmpl.isUserCreated ? t('user_template', 'User Template') : t('system_template', 'System Template')}
                    />
                ))}
            </div>
        );
    }

    // Inside a Template bin: Slides + block bins if 2+ share a block
    if (currentNav.type === 'template') {
        const template = allTemplates.find(t => t.id === currentNav.id);
        if (!template) return null;

        const slides = template.templateSlides || [];
        // Group slides by blockId
        const groupedByBlock = slides.reduce((acc: Record<string, ITemplateSlide[]>, s: ITemplateSlide) => {
            const bId = s.categoryId || 'undefined';
            if (!acc[bId]) acc[bId] = [];
            acc[bId].push(s);
            return acc;
        }, {} as Record<string, ITemplateSlide[]>);

        const blockBins = Object.entries(groupedByBlock).filter(([bId, slds]) => bId !== 'undefined' && slds.length >= 2);
        const blockBinIds = new Set(blockBins.map(([bId]) => bId));

        // Slides not in any block bin
        const independentSlides = slides.filter(s => {
            const bId = s.categoryId || 'undefined';
            return !blockBinIds.has(bId);
        });

        return (
            <div className="space-y-4">
                {blockBins.length > 0 && (
                    <div className="grid grid-cols-1 gap-2">
                        {blockBins.map(([bId, slds]: [string, ITemplateSlide[]]) => {
                            const block = blocks.find((b: IBlock) => b.id === bId);
                            return (
                                <GraceLibBin
                                    key={bId}
                                    id={bId}
                                    name={block ? (isRu ? block.nameRu : block.name) : bId}
                                    icon={block?.icon ? (ICON_MAP[block.icon] || Layout) : Layout}
                                    isActive={false}
                                    onClick={() => pushTemplateNav({
                                        id: `${template.id}:${bId}`,
                                        type: 'block',
                                        name: block ? block.name : bId,
                                        nameRu: block ? block.nameRu : undefined
                                    })}
                                    count={slds.length}
                                />
                            );
                        })}
                    </div>
                )}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                    {independentSlides.map((slide: ITemplateSlide) => (
                        <TemplatePreviewItem
                            key={slide.id}
                            template={template}
                            layoutSlide={slide}
                            selectedBlock={blocks.find((b: IBlock) => b.id === (slide.categoryId || template.category))}
                            selectedSlide={selectedSlide}
                            lang={lang}
                            isRu={isRu}
                            activePresentationId={activePresentationId}
                            onClick={handleTemplateClick}
                            onOverride={(template.isUserCreated || devMode) ? handleOverrideTemplateSlide : undefined}
                            blocks={blocks}
                            t={t}
                        />
                    ))}
                    {/* Fallback to base template if no slides defined */}
                    {slides.length === 0 && (
                        <TemplatePreviewItem
                            template={template}
                            selectedBlock={blocks.find((b: IBlock) => b.id === template.category)}
                            selectedSlide={selectedSlide}
                            lang={lang}
                            isRu={isRu}
                            activePresentationId={activePresentationId}
                            onClick={handleTemplateClick}
                            onContextMenu={(e, t, s) => {
                                e.preventDefault();
                                if (template.isUserCreated || devMode) {
                                    setContextMenu({
                                        x: e.clientX,
                                        y: e.clientY,
                                        item: { templateId: t.id, slide: s },
                                        type: 'template-slide'
                                    });
                                }
                            }}
                            blocks={blocks}
                            t={t}
                        />
                    )}
                </div>
            </div>
        );
    }

    // Blocks view: List of block bins
    if (currentNav.type === 'blocks') {
        return (
            <div className="grid grid-cols-1 gap-2">
                {blocks.map((block: IBlock) => {
                    // Count template slides across all templates for this block
                    const count = allTemplates.reduce((acc: number, tmpl: ITemplate) =>
                        acc + (tmpl.templateSlides?.filter((s: ITemplateSlide) => s.categoryId === block.id).length || 0), 0
                    );
                    return (
                        <GraceLibBin
                            key={block.id}
                            id={block.id}
                            name={isRu ? block.nameRu : block.name}
                            icon={block.icon ? (ICON_MAP[block.icon] || Presentation) : Presentation}
                            isActive={false}
                            onClick={() => pushTemplateNav({
                                id: block.id,
                                type: 'block',
                                name: block.name,
                                nameRu: block.nameRu
                            })}
                            count={count}
                        />
                    );
                })}
            </div>
        );
    }

    // Inside a Block bin (from Blocks view OR from Template view)
    if (currentNav.type === 'block') {
        const isFromTemplate = currentNav.id.includes(':');
        let blockId = currentNav.id;
        let targetTemplateId: string | undefined;

        if (isFromTemplate) {
            [targetTemplateId, blockId] = currentNav.id.split(':');
        }

        const activeBlock = blocks.find((b: IBlock) => b.id === blockId);

        // Collect all slides for this block
        const allSlidesForBlock: Array<{ template: ITemplate, slide: ITemplateSlide }> = [];
        allTemplates.forEach((tmpl: ITemplate) => {
            if (targetTemplateId && tmpl.id !== targetTemplateId) return;
            tmpl.templateSlides?.forEach((s: ITemplateSlide) => {
                if (s.categoryId === blockId) {
                    allSlidesForBlock.push({ template: tmpl, slide: s });
                }
            });
        });

        // Group by template if not targetTemplateId
        if (!targetTemplateId) {
            const groupedByTemplate: Record<string, typeof allSlidesForBlock> = {};
            allSlidesForBlock.forEach(item => {
                if (!groupedByTemplate[item.template.id]) groupedByTemplate[item.template.id] = [];
                groupedByTemplate[item.template.id].push(item);
            });

            const templateBins = Object.entries(groupedByTemplate).filter(([tId, items]) => items.length >= 2);
            const templateBinIds = new Set(templateBins.map(([tId]) => tId));

            const independentItems = allSlidesForBlock.filter(item => !templateBinIds.has(item.template.id));

            return (
                <div className="space-y-4">
                    {templateBins.length > 0 && (
                        <div className="grid grid-cols-1 gap-2">
                            {templateBins.map(([tId, items]) => (
                                <GraceLibBin
                                    key={tId}
                                    id={tId}
                                    name={isRu ? items[0].template.nameRu : items[0].template.name}
                                    icon={Layers}
                                    isActive={false}
                                    onClick={() => pushTemplateNav({
                                        id: `${tId}:${blockId}`,
                                        type: 'block',
                                        name: items[0].template.name,
                                        nameRu: items[0].template.nameRu
                                    })}
                                    count={items.length}
                                />
                            ))}
                        </div>
                    )}
                    <div className="grid grid-cols-1 @[280px]:grid-cols-2 @[420px]:grid-cols-3 gap-3">
                        {independentItems.map(({ template, slide }) => (
                            <TemplatePreviewItem
                                key={slide.id}
                                template={template}
                                layoutSlide={slide}
                                selectedBlock={activeBlock}
                                selectedSlide={selectedSlide}
                                lang={lang}
                                isRu={isRu}
                                activePresentationId={activePresentationId}
                                onClick={handleTemplateClick}
                                onOverride={(template.isUserCreated || devMode) ? handleOverrideTemplateSlide : undefined}
                                onContextMenu={(e, t, s) => {
                                    e.preventDefault();
                                    if (template.isUserCreated || devMode) {
                                        setContextMenu({
                                            x: e.clientX,
                                            y: e.clientY,
                                            item: { templateId: t.id, slide: s },
                                            type: 'template-slide'
                                        });
                                    }
                                }}
                                onExport={() => GraceLibExportService.exportItem(template.id, 'template', template.name)}
                                blocks={blocks}
                                t={t}
                            />
                        ))}
                    </div>
                </div>
            );
        } else {
            // We are inside a template-group within a block
            return (
                <div className="grid grid-cols-1 @[280px]:grid-cols-2 @[420px]:grid-cols-3 gap-3">
                    {allSlidesForBlock.map(({ template, slide }) => (
                        <TemplatePreviewItem
                            key={slide.id}
                            template={template}
                            layoutSlide={slide}
                            selectedBlock={activeBlock}
                            selectedSlide={selectedSlide}
                            lang={lang}
                            isRu={isRu}
                            activePresentationId={activePresentationId}
                            onClick={handleTemplateClick}
                            onOverride={(template.isUserCreated || devMode) ? handleOverrideTemplateSlide : undefined}
                            onExport={() => GraceLibExportService.exportItem(template.id, 'template', template.name)}
                            blocks={blocks}
                            t={t}
                        />
                    ))}
                </div>
            );
        }
    }

    return null;
};
