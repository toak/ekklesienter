import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAtom } from 'jotai';
import { db } from '@/core/db';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useTranslation } from 'react-i18next';
import { BookOpen, Monitor, Music, Coins, Baby, Mic2, Megaphone, Plus, Presentation, LayoutTemplate, Layers, Layout, type LucideIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/core/utils/cn';
import { themeAccentAtom, devModeAtom } from '@/core/store/uiAtoms';
import { IBlock, ISlide, ICanvasSlide, ITemplate, ITemplateSlide, ICanvasItem, IPresentationFile, IPresentationBin } from '@/core/types';
import PresentationSelector from './PresentationSelector';
import SlideContentRenderer from '@/features/presenter/components/slide-editor/SlideContentRenderer';
import { GraceLibBin } from './GraceLibBin';
import { EktpService } from '@/features/presenter/services/ektpService';
import { EktmpService } from '@/features/presenter/services/ektmpService';
import { MediaType } from '@/core/types';
import { GraceLibExportService } from '@/features/presenter/services/GraceLibExportService';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';
import { Edit2, RefreshCw, ChevronRight, FolderPlus, MoreVertical, Folder, Download } from 'lucide-react';
import { IpcService } from '@/core/services/IpcService';
import { TemplatePreviewItem } from './TemplatePreviewItem';
import { LibraryImportService } from '../../services/LibraryImportService';
import { LibraryTemplatesSection } from './LibraryTemplatesSection';
import { LibraryPresentationsSection } from './LibraryPresentationsSection';
import { LibraryMediaSection } from './LibraryMediaSection';

import { LibraryHeader } from './LibraryHeader';
import { LibraryContextMenu } from './LibraryContextMenu';
import { useLibraryInteraction } from '../../hooks/useLibraryInteraction';

const ICON_MAP: Record<string, LucideIcon> = {
    Monitor, Music, Coins, Baby, Mic2, Megaphone, BookOpen, Plus, Presentation, Layers, Layout
};

const PresentationLibrary: React.FC = () => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const isRu = lang === 'ru';

    const {
        activePresentationId,
        activeServiceId,
        activeService,
        updatePresentationSlides,
        setPreviewSlide,
        activeBlockId,
        setActiveBlockId,
        previewSlideId,
        graceLibSection,
        setGraceLibSection,
        graceLibMediaBins,
        addMediaBin,
        updateMediaBin,
        removeMediaBin,
        templateNavPath,
        pushTemplateNav,
        popTemplateNav,
        setTemplateNavPath,
        presentationBinNavPath,
        setPresentationBinNavPath,
        createPresentationBin,
        renamePresentationBin,
        removePresentationBin,
        movePresentationToBin,
        overrideTemplateSlide,
        updateTemplate,
        removeTemplate,
        renameTemplateSlide,
        removeTemplateSlide
    } = usePresentationStore();

    const { openModal: openGlobalModal } = useModalStore();
    const [devMode] = useAtom(devModeAtom);

    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        item: ITemplate | ITemplateSlide | IPresentationBin | IPresentationFile | { id: string; name: string; mediaIds: string[] };
        type: 'template' | 'media-bin' | 'template-slide' | 'presentation-bin' | 'presentation';
    } | null>(null);

    const blocks = useLiveQuery(() => db.blocks.toArray()) || [];
    const presentation = useLiveQuery(
        () => activePresentationId ? db.presentationFiles.get(activePresentationId) : undefined,
        [activePresentationId]
    );
    const allPresentations = useLiveQuery(() => db.presentationFiles.toArray()) || [];
    const presentationBins = useLiveQuery(() => db.presentationBins.toArray()) || [];
    const allTemplates = useLiveQuery(() => db.templates.toArray()) || [];

    const selectedSlide = useMemo(() =>
        presentation?.slides?.find((s: ISlide) => s.id === previewSlideId),
        [presentation, previewSlideId]
    );

    const currentBinId = presentationBinNavPath.length > 0 ? presentationBinNavPath[presentationBinNavPath.length - 1] : null;

    const filteredPresentations = useMemo(() => {
        return allPresentations.filter((p: IPresentationFile) => !p.serviceId && (p.binId || null) === (currentBinId || null));
    }, [allPresentations, currentBinId]);

    const filteredBins = useMemo(() => {
        return presentationBins.filter((b: IPresentationBin) => (b.parentId || null) === (currentBinId || null));
    }, [presentationBins, currentBinId]);

    const {
        isDragging,
        handleImportClick,
        handleDragOver,
        handleDragLeave,
        handleDrop
    } = useLibraryInteraction({
        currentBinId,
        t,
        createPresentationBin
    });

    useEffect(() => {
        if (!IpcService.isElectron()) return;

        const unsubs = [
            IpcService.on('menu:export-gracelib', () => {
                GraceLibExportService.exportGraceLib();
            }),
            IpcService.on('menu:export-presentations', () => {
                GraceLibExportService.exportCollection('presentations');
            }),
            IpcService.on('menu:export-templates', () => {
                GraceLibExportService.exportCollection('templates');
            })
        ];

        return () => {
            unsubs.forEach((unsub) => unsub());
        };
    }, []);

    const handleTemplateClick = async (template: ITemplate, templateSlideId?: string, isBefore?: boolean) => {
        if (!activePresentationId || !presentation) return;

        const slides = presentation.slides || [];
        const currentSlideIdx = slides.findIndex((s: ISlide) => s.id === previewSlideId);

        let slideLayout: ITemplateSlide | undefined;
        if (templateSlideId && template.templateSlides) {
            slideLayout = template.templateSlides.find((s: ITemplateSlide) => s.id === templateSlideId);
        }

        const sourceCanvasItems = slideLayout?.canvasItems || template.canvasItems || [];
        const newCanvasItems = sourceCanvasItems.map((item: ICanvasItem) => ({
            ...item,
            id: crypto.randomUUID()
        }));

        const newSlide: ICanvasSlide = {
            id: crypto.randomUUID(),
            type: 'normal',
            order: slides.length,
            blockId: slideLayout?.categoryId || template.category,
            templateId: template.id,
            backgroundOverride: slideLayout?.backgroundOverride || undefined,
            content: {
                variables: template.assets?.[0]?.type === 'text' ? { content: template.assets[0].content } : {},
                canvasItems: newCanvasItems.length > 0 ? newCanvasItems : undefined
            },
        };

        let newSlides = [...slides];
        if (isBefore && currentSlideIdx !== -1) {
            newSlides.splice(currentSlideIdx, 0, newSlide);
        } else if (currentSlideIdx !== -1) {
            newSlides.splice(currentSlideIdx + 1, 0, newSlide);
        } else {
            newSlides.push(newSlide);
        }

        newSlides = newSlides.map((s, i) => ({ ...s, order: i }));

        await updatePresentationSlides(activePresentationId, newSlides);
        setPreviewSlide(newSlide.id);
    };

    const handleOverrideTemplateSlideInLibrary = async (template: ITemplate, layoutSlideId: string) => {
        if (!selectedSlide) return;
        await overrideTemplateSlide(template.id, layoutSlideId, selectedSlide, devMode);
    };

    const currentNav = templateNavPath[templateNavPath.length - 1];

    return (
        <div className="h-full flex flex-col bg-stone-900/30 border-r border-white/5">
            <LibraryHeader
                graceLibSection={graceLibSection}
                templateNavPath={templateNavPath}
                presentationBinNavPath={presentationBinNavPath}
                presentationBins={presentationBins}
                isRu={isRu}
                t={t}
                setTemplateNavPath={setTemplateNavPath}
                setPresentationBinNavPath={setPresentationBinNavPath}
                handleImportClick={handleImportClick}
            />

            <div className="flex-1 overflow-y-auto no-scrollbar p-3">
                {!graceLibSection ? (
                    <div className="flex flex-col items-center justify-center h-full text-stone-600 gap-3 px-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-stone-800/50 flex items-center justify-center">
                            <Layers className="w-6 h-6 opacity-30" />
                        </div>
                        <p className="text-xs font-medium italic opacity-50">
                            {t('select_library_hint', 'Select a section in GraceLib to browse content')}
                        </p>
                    </div>
                ) : (
                    <>
                        {graceLibSection === 'templates' && (
                            <LibraryTemplatesSection
                                currentNav={currentNav}
                                allTemplates={allTemplates}
                                blocks={blocks}
                                isRu={isRu}
                                lang={lang}
                                selectedSlide={selectedSlide}
                                activePresentationId={activePresentationId}
                                devMode={devMode}
                                t={t}
                                pushTemplateNav={pushTemplateNav}
                                setContextMenu={setContextMenu}
                                handleTemplateClick={handleTemplateClick}
                                handleOverrideTemplateSlide={handleOverrideTemplateSlideInLibrary}
                            />
                        )}
                        {graceLibSection === 'presentations' && (
                            <LibraryPresentationsSection
                                filteredPresentations={filteredPresentations}
                                filteredBins={filteredBins}
                                currentBinId={currentBinId}
                                isDragging={isDragging}
                                isRu={isRu}
                                t={t}
                                activePresentationId={activePresentationId}
                                handlePresentationClick={(pres) => {
                                    openGlobalModal(ModalType.PRESENTATION_IMPORTER, { presentationId: pres.id });
                                }}
                                pushPresentationBinNav={(id) => setPresentationBinNavPath([...presentationBinNavPath, id])}
                                handleCreateBin={() => {
                                    openGlobalModal(ModalType.PROMPT, {
                                        title: t('enter_bin_name', 'Enter bin name:'),
                                        onSelection: (name: string | null) => {
                                            if (name) createPresentationBin(name);
                                        }
                                    });
                                }}
                                setContextMenu={setContextMenu}
                                handleDragOver={handleDragOver}
                                handleDragLeave={handleDragLeave}
                                handleDrop={handleDrop}
                            />
                        )}
                        {graceLibSection === 'media' && (
                            <LibraryMediaSection
                                graceLibMediaBins={graceLibMediaBins}
                                t={t}
                                handleAddBin={() => {
                                    openGlobalModal(ModalType.PROMPT, {
                                        title: t('enter_bin_name', 'Enter bin name:'),
                                        onSelection: (name: string | null) => {
                                            if (name) addMediaBin(name);
                                        }
                                    });
                                }}
                                setContextMenu={setContextMenu}
                            />
                        )}
                    </>
                )}
            </div>

            <div className="shrink-0 p-3 border-t border-white/5 bg-stone-950/40 relative z-30">
                <PresentationSelector className="h-[60px]" />
            </div>

            <LibraryContextMenu
                contextMenu={contextMenu}
                onClose={() => setContextMenu(null)}
                t={t}
                isRu={isRu}
                devMode={devMode}
                openGlobalModal={openGlobalModal}
                updateTemplate={updateTemplate}
                renamePresentationBin={renamePresentationBin}
                updateMediaBin={updateMediaBin}
                removeTemplate={removeTemplate}
                templateNavPath={templateNavPath}
                setTemplateNavPath={setTemplateNavPath}
                removePresentationBin={removePresentationBin}
                presentationBinNavPath={presentationBinNavPath}
                setPresentationBinNavPath={setPresentationBinNavPath}
                removeMediaBin={removeMediaBin}
                renameTemplateSlide={renameTemplateSlide}
                removeTemplateSlide={removeTemplateSlide}
                handleOverrideTemplateSlide={handleOverrideTemplateSlideInLibrary}
            />
        </div>
    );
};

export default PresentationLibrary;
