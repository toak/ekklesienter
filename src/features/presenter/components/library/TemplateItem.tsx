import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Download, LayoutTemplate } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ITemplate, IBlock, ISlide, ICanvasSlide, ITemplateSlide } from '@/core/types';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';

export interface TemplateItemProps {
    template: ITemplate;
    selectedBlock: IBlock | undefined;
    selectedSlide: ISlide | undefined;
    lang: string;
    isRu: boolean;
    activePresentationId: string | null;
    onClick: (template: ITemplate, templateSlideId?: string, isBefore?: boolean) => void;
    onExport?: () => void;
    onContextMenu?: (e: React.MouseEvent, template: ITemplate, slide?: ITemplateSlide) => void;
    onOverride?: (template: ITemplate, layoutSlideId: string) => void;
    layoutSlide?: ITemplateSlide;
    blocks: IBlock[];
    t: any;
}

/**
 * TemplateItem component for the presentation library.
 * Renders a thumbnail preview of a template with its layout and provides actions.
 */
export const TemplateItem: React.FC<TemplateItemProps> = React.memo(({ 
    template, 
    selectedBlock, 
    selectedSlide, 
    lang, 
    isRu, 
    activePresentationId, 
    onClick, 
    onExport, 
    onOverride, 
    onContextMenu, 
    layoutSlide, 
    blocks, 
    t 
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.1);

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width;
                if (width > 0) {
                    setScale(width / 1920);
                }
            }
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    return (
        <button
            onClick={(e) => {
                const isBefore = e.metaKey || e.ctrlKey;
                onClick(template, layoutSlide?.id, isBefore);
            }}
            onContextMenu={(e) => onContextMenu?.(e, template, layoutSlide)}
            disabled={!activePresentationId}
            className={cn(
                "aspect-video rounded-xl border transition-all cursor-pointer group flex flex-col items-center justify-center p-2 text-center relative overflow-hidden min-w-[140px] max-w-full shadow-lg shadow-black/20",
                activePresentationId
                    ? "border-white/5 hover:border-accent/40 hover:scale-[1.02] active:scale-[0.98] bg-stone-900/60"
                    : "border-white/3 opacity-50 cursor-not-allowed"
            )}
        >
            {/* Live Preview Wrapper */}
            <div ref={containerRef} className="absolute inset-0 overflow-hidden">
                <SlideContentRenderer
                    template={template}
                    block={selectedBlock || blocks.find(b => b.id === (layoutSlide?.categoryId || template.category))}
                    variables={(selectedSlide?.type === 'normal' ? (selectedSlide as ICanvasSlide).content?.variables : null) || {}}
                    lang={lang}
                    isPreview={true}
                    scale={scale}
                    canvasItems={layoutSlide?.canvasItems || template.canvasItems || []}
                    hideOverlays={false}
                />
            </div>

            {/* Overlay for Actions */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all z-20 flex flex-col items-center justify-center gap-2 p-2 backdrop-blur-[1px]">
                <div className="flex items-center gap-2">
                    {onOverride && layoutSlide && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onOverride(template, layoutSlide.id);
                            }}
                            className="p-1.5 rounded-lg bg-accent/80 hover:bg-accent text-white shadow-xl transition-all border border-white/20 transform hover:scale-110 active:scale-95"
                            title={t('override_template_slide', "Override template's slide with current slide")}
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    )}
                    {onExport && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onExport();
                            }}
                            className="p-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-white shadow-xl transition-all border border-white/10 transform hover:scale-110 active:scale-95"
                            title={t('export_template', "Export Template")}
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <span className="text-[9px] font-bold text-white uppercase tracking-wider drop-shadow-md bg-black/60 px-2 py-0.5 rounded-full">
                    {layoutSlide ? (isRu ? layoutSlide.nameRu || layoutSlide.name : layoutSlide.name) : (isRu ? template.nameRu : template.name)}
                </span>
            </div>

            {/* Overlay + Label (Only for Blank Template) */}
            {template.id === 'blank-dark' && (
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all z-10 flex flex-col items-center justify-center gap-1 p-2">
                    <LayoutTemplate className="w-5 h-5 text-white/50 group-hover:text-white/90 transition-all transform group-hover:scale-110" />
                    <span className="text-[10px] font-black text-white/70 group-hover:text-white uppercase tracking-wider transition-all line-clamp-2 drop-shadow-md">
                        {isRu ? template.nameRu : template.name}
                    </span>
                </div>
            )}
        </button>
    );
});
