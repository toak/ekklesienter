import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { ISlide, ICanvasSlide, INestedSlide, IBlock, ITemplate, IPresentationFile } from '@/core/types';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import {
    ChevronRight, ChevronDown, ExternalLink, Layers, Link2,
    Presentation
} from 'lucide-react';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import { IpcService } from '@/core/services/IpcService';

const ICON_MAP: Record<string, React.FC<{ className?: string; strokeWidth?: number }>> = {
    Presentation
};

interface NestedPresentationTileProps {
    slide: ISlide;
    nestedPresentation: IPresentationFile;
    blocksMap: Map<string, IBlock>;
    templatesMap: Map<string, ITemplate>;
    lang: string;
    previewSlideId: string | null;
    selectedPresentationId: string | null;
    onContextMenu: (e: React.MouseEvent, slideId: string, presentationId: string) => void;
}

/**
 * Renders the inline-expanded nested presentation content —
 * a bounding box with nested slide previews and an "Edit" button.
 * Only renders when slide.isExpanded is true.
 */
const NestedPresentationTile: React.FC<NestedPresentationTileProps> = ({
    slide,
    nestedPresentation,
    blocksMap,
    templatesMap,
    lang,
    previewSlideId,
    selectedPresentationId,
    onContextMenu,
}) => {
    const { t } = useTranslation();
    const { setPreviewSlide, setLiveSlide, setActivePresentation, toggleSlideExpansion } = usePresentationStore();

    if (!slide.isExpanded) return null;

    const isLinked = slide.type === 'normal' && Boolean((slide as ICanvasSlide).linkedPresentationId);

    return (
        <div className="flex items-center gap-2 px-2 bg-white/2 rounded-2xl border border-white/5 py-3 ml-[-8px]">
            {/* Left accent bar */}
            <div className={cn(
                'w-1 h-12 rounded-full shrink-0',
                isLinked ? 'bg-accent/30' : 'bg-orange-500/20'
            )} />

            <div className="flex gap-2.5">
                {nestedPresentation.slides.map((nestedSlide, idx) => {
                    const nb = blocksMap.get(nestedSlide.blockId);
                    const nt = templatesMap.get(nestedSlide.templateId);
                    const isNSel = previewSlideId === nestedSlide.id && selectedPresentationId === nestedPresentation.id;

                    return (
                        <div
                            key={nestedSlide.id}
                            onClick={() => setPreviewSlide(nestedSlide.id, nestedPresentation.id)}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                onContextMenu(e, nestedSlide.id, nestedPresentation.id);
                            }}
                            onDoubleClick={async () => {
                                setPreviewSlide(nestedSlide.id, nestedPresentation.id);
                                setLiveSlide(nestedSlide.id);

                                if (IpcService.isElectron()) {
                                    const displaySettings = usePresenterStore.getState().settings.display;
                                    await IpcService.invoke('open-projector', displaySettings);
                                }
                            }}
                            className={cn(
                                'group/nested relative shrink-0 w-24 aspect-video rounded-lg border transition-all cursor-pointer overflow-hidden',
                                isNSel
                                    ? 'border-accent ring-1 ring-accent/30 scale-105 z-10'
                                    : 'border-white/5 hover:border-white/20 bg-stone-900/50'
                            )}
                        >
                            {/* Nested slide — mini preview */}
                            <SlideContentRenderer
                                template={nt}
                                block={nb}
                                variables={(nestedSlide as ICanvasSlide).content?.variables || {}}
                                lang={lang}
                                isPreview={true}
                                scale={96 / 1920}
                                slide={nestedSlide}
                                slideId={nestedSlide.id}
                            />

                            {/* Slide number badge */}
                            <div className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded bg-black/40 text-[6px] font-black text-stone-500">
                                {idx + 1}
                            </div>

                            {/* Linked indicator */}
                            {isLinked && idx === 0 && (
                                <div className="absolute bottom-0.5 right-0.5 px-1 py-0.5 rounded bg-accent/20 border border-accent/20">
                                    <Link2 className="w-2 h-2 text-accent" />
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Edit Nested Button */}
                <button
                    onClick={() => setActivePresentation(nestedPresentation.id)}
                    className="w-10 aspect-video rounded-lg border border-dashed border-white/10 flex flex-col items-center justify-center gap-1 hover:border-accent/40 hover:bg-accent/5 transition-all group"
                    title={t('edit_nested_presentation', 'Open for full editing')}
                >
                    <ExternalLink className="w-3 h-3 text-stone-600 group-hover:text-accent" />
                    <span className="text-[6px] font-bold text-stone-700 uppercase group-hover:text-accent/70">
                        {t('edit', 'Edit')}
                    </span>
                </button>
            </div>

            {/* Right accent bar */}
            <div className={cn(
                'w-1 h-12 rounded-full shrink-0',
                isLinked ? 'bg-accent/30' : 'bg-orange-500/20'
            )} />
        </div>
    );
};

export default React.memo(NestedPresentationTile);
