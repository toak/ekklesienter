import React from 'react';
import { TFunction } from 'i18next';
import { ChevronRight, Download, LayoutTemplate, Presentation, Music, Layers, type LucideIcon } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { IPresentationBin } from '@/core/types';
import { ITemplateNav } from './LibraryTemplatesSection';

interface LibraryHeaderProps {
    graceLibSection: string | null;
    templateNavPath: ITemplateNav[];
    presentationBinNavPath: string[];
    presentationBins: IPresentationBin[];
    isRu: boolean;
    t: TFunction;
    setTemplateNavPath: (path: ITemplateNav[]) => void;
    setPresentationBinNavPath: (path: string[]) => void;
    handleImportClick: () => void;
}

export const LibraryHeader: React.FC<LibraryHeaderProps> = ({
    graceLibSection,
    templateNavPath,
    presentationBinNavPath,
    presentationBins,
    isRu,
    t,
    setTemplateNavPath,
    setPresentationBinNavPath,
    handleImportClick
}) => {
    return (
        <div className="p-4 border-b border-white/5 flex items-center gap-2 shrink-0 h-[60px] overflow-hidden">
            <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar scroll-smooth">
                {graceLibSection === 'templates' && templateNavPath.map((nav, index) => (
                    <React.Fragment key={`${nav.id}-${index}`}>
                        {index > 0 && <ChevronRight className="w-3 h-3 text-stone-700 shrink-0" />}
                        <button
                            onClick={() => setTemplateNavPath(templateNavPath.slice(0, index + 1))}
                            className={cn(
                                "text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors flex items-center gap-1.5",
                                index === templateNavPath.length - 1
                                    ? "text-stone-300 pointer-events-none"
                                    : "text-stone-600 hover:text-accent cursor-pointer"
                            )}
                        >
                            {index === 0 && <LayoutTemplate className="w-3.5 h-3.5" />}
                            {isRu ? nav.nameRu || nav.name : nav.name}
                        </button>
                    </React.Fragment>
                ))}

                {graceLibSection === 'presentations' && (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <button
                            onClick={() => setPresentationBinNavPath([])}
                            className={cn(
                                "text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors flex items-center gap-1.5",
                                presentationBinNavPath.length === 0 ? "text-stone-300" : "text-stone-600 hover:text-accent"
                            )}
                        >
                            <Presentation className="w-3.5 h-3.5" />
                            {t('grace_presentations', 'Grace Presentations')}
                        </button>
                        {presentationBinNavPath.map((binId, index) => {
                            const bin = presentationBins.find(b => b.id === binId);
                            if (!bin) return null;
                            return (
                                <React.Fragment key={binId}>
                                    <ChevronRight className="w-3 h-3 text-stone-700 shrink-0" />
                                    <button
                                        onClick={() => setPresentationBinNavPath(presentationBinNavPath.slice(0, index + 1))}
                                        className={cn(
                                            "text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors",
                                            index === presentationBinNavPath.length - 1
                                                ? "text-stone-300 pointer-events-none"
                                                : "text-stone-600 hover:text-accent cursor-pointer"
                                        )}
                                    >
                                        {bin.name}
                                    </button>
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}

                {graceLibSection === 'media' && (
                    <h3 className="text-[9px] font-bold text-stone-300 uppercase tracking-widest flex items-center gap-2">
                        <Music className="w-3.5 h-3.5" />
                        {t('grace_media', 'Grace Media')}
                    </h3>
                )}

                {!graceLibSection && (
                    <h3 className="text-[9px] font-bold text-stone-300 uppercase tracking-widest flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5" />
                        {t('grace_lib', 'GraceLib')}
                    </h3>
                )}
            </div>

            <button
                onClick={handleImportClick}
                className="ml-auto flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent border border-accent/20 transition-all shrink-0 cursor-pointer shadow-lg outline-none"
                title={t('import_files_desc', 'Import presentations, templates, or media')}
            >
                <Download className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">{t('import', 'Import')}</span>
            </button>
        </div>
    );
};
