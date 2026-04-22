import React from 'react';
import { 
    SidebarClose, SidebarOpen, Clock, Undo2, Redo2, 
    MonitorPlay, Palette, Square, Image as ImageIcon 
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { useTranslation } from 'react-i18next';
import { ModalType } from '@/core/store/modalStore';
import { OverrideType } from '@/core/store/uiAtoms';

interface AppToolbarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    historyOpen: boolean;
    setHistoryOpen: (open: boolean) => void;
    designPanelOpen: boolean;
    setDesignPanelOpen: (open: boolean) => void;
    appMode: 'scripture' | 'presentation';
    activeOverride: OverrideType | null;
    toggleOverride: (type: OverrideType) => void;
    activeLogoUrl: string | null;
    activeLogoName?: string;
    undo: () => void;
    redo: () => void;
    openProjector: () => void;
    openGlobalModal: (type: ModalType) => void;
    isBibleSlide?: boolean;
}

export const AppToolbar: React.FC<AppToolbarProps> = ({
    sidebarOpen,
    setSidebarOpen,
    historyOpen,
    setHistoryOpen,
    designPanelOpen,
    setDesignPanelOpen,
    appMode,
    activeOverride,
    toggleOverride,
    activeLogoUrl,
    activeLogoName,
    undo,
    redo,
    openProjector,
    openGlobalModal,
    isBibleSlide
}) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const isCyrillic = ['ru', 'uk', 'bg', 'be'].includes(lang);

    const handleToggleSidebar = React.useCallback(() => setSidebarOpen(!sidebarOpen), [sidebarOpen, setSidebarOpen]);
    const handleToggleHistory = React.useCallback(() => setHistoryOpen(!historyOpen), [historyOpen, setHistoryOpen]);
    const handleToggleDesignPanel = React.useCallback(() => {
        if (isBibleSlide || appMode !== 'presentation') {
            setDesignPanelOpen(false);
            openGlobalModal(ModalType.CUSTOMIZATION);
        } else {
            setDesignPanelOpen(!designPanelOpen);
        }
    }, [appMode, designPanelOpen, setDesignPanelOpen, openGlobalModal, isBibleSlide]);
    const handleToggleBlackout = React.useCallback(() => toggleOverride('blackout'), [toggleOverride]);
    const handleToggleWhiteout = React.useCallback(() => toggleOverride('whiteout'), [toggleOverride]);
    const handleToggleLogo = React.useCallback(() => toggleOverride('logo'), [toggleOverride]);

    return (
        <div className="absolute top-4 left-4 z-50 flex gap-2">
            <button
                onClick={handleToggleSidebar}
                className="p-2 bg-stone-900/80 text-stone-400 rounded-md hover:text-amber-400 hover:bg-stone-800 border border-stone-800 backdrop-blur-md transition-colors"
                title={sidebarOpen ? t('hide_controls') : t('show_controls')}
            >
                {sidebarOpen ? <SidebarClose className="w-5 h-5" /> : <SidebarOpen className="w-5 h-5" />}
            </button>

            {appMode === 'scripture' && (
                <button
                    onClick={handleToggleHistory}
                    className={cn(
                        "p-2 rounded-md border backdrop-blur-md transition-colors",
                        historyOpen
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                            : "bg-stone-900/80 text-stone-400 hover:text-amber-400 hover:bg-stone-800 border-stone-800"
                    )}
                    title={t('history')}
                >
                    <Clock className="w-5 h-5" />
                </button>
            )}

            <div className="h-9 w-px bg-white/5 mx-1" />

            <button
                onClick={undo}
                className="p-2 rounded-md bg-stone-900/80 text-stone-400 hover:text-accent hover:bg-stone-800 border border-stone-800 backdrop-blur-md transition-colors"
                title={`${t('undo', 'Undo')} (Cmd+Z)`}
            >
                <Undo2 className="w-5 h-5" />
            </button>

            <button
                onClick={redo}
                className="p-2 rounded-md bg-stone-900/80 text-stone-400 hover:text-accent hover:bg-stone-800 border border-stone-800 backdrop-blur-md transition-colors"
                title={`${t('redo', 'Redo')} (Cmd+Shift+Z)`}
            >
                <Redo2 className="w-5 h-5" />
            </button>

            <div className="h-9 w-px bg-white/5 mx-1" />

            <button
                onClick={openProjector}
                className="p-2 bg-stone-900/80 text-stone-400 rounded-md hover:text-accent hover:bg-stone-800 border border-stone-800 backdrop-blur-md transition-colors"
                title={t('open_projector')}
            >
                <MonitorPlay className="w-5 h-5" />
            </button>

            <button
                onClick={handleToggleDesignPanel}
                className={cn(
                    "p-2 rounded-md border backdrop-blur-md transition-colors",
                    designPanelOpen && appMode === 'presentation'
                        ? "bg-accent/20 text-accent border-accent/50"
                        : "bg-stone-900/80 text-stone-400 hover:text-accent hover:bg-stone-800 border-stone-800"
                )}
                title={t('customization')}
            >
                <Palette className="w-5 h-5" />
            </button>

            {/* Emergency Modes Controls */}
            <div className="h-9 w-px bg-white/5 mx-1" />

            <button
                onClick={handleToggleBlackout}
                className={cn(
                    "p-2 rounded-md border backdrop-blur-md transition-all flex items-center justify-center relative group overflow-hidden",
                    activeOverride === 'blackout'
                        ? "bg-red-600 border-red-500 shadow-lg shadow-red-500/20"
                        : "bg-stone-900/80 text-stone-400 hover:text-white hover:bg-stone-800 border-stone-800"
                )}
                title={`${t('blackout', 'Black Out')} (B)`}
            >
                <Square className={cn(
                    "w-5 h-5 fill-current transition-transform", 
                    activeOverride === 'blackout' ? "scale-110 opacity-100 text-black" : "scale-90 opacity-10"
                )} />
                <div className={cn(
                    "absolute inset-0 flex items-center justify-center text-[11px] font-black uppercase tracking-tighter",
                    activeOverride === 'blackout' ? "text-white" : "text-stone-400 group-hover:text-white"
                )}>
                    {isCyrillic ? 'Ч' : 'B'}
                </div>
            </button>

            <button
                onClick={handleToggleWhiteout}
                className={cn(
                    "p-2 rounded-md border backdrop-blur-md transition-all flex items-center justify-center relative group overflow-hidden",
                    activeOverride === 'whiteout'
                        ? "bg-red-600 border-red-500 shadow-lg shadow-red-500/20"
                        : "bg-stone-900/80 text-stone-400 hover:text-white hover:bg-stone-800 border-stone-800"
                )}
                title={`${t('whiteout', 'White Out')} (W)`}
            >
                <Square className={cn(
                    "w-5 h-5 fill-current transition-transform", 
                    activeOverride === 'whiteout' ? "scale-110 opacity-100 text-white" : "scale-90 opacity-10"
                )} />
                <div className={cn(
                    "absolute inset-0 flex items-center justify-center text-[11px] font-black uppercase tracking-tighter",
                    activeOverride === 'whiteout' ? "text-black font-black" : "text-stone-400 group-hover:text-white"
                )}>
                    {isCyrillic ? 'Б' : 'W'}
                </div>
            </button>

            <button
                onClick={handleToggleLogo}
                className={cn(
                    "p-2 rounded-md border backdrop-blur-md transition-all flex items-center justify-center relative group overflow-hidden min-w-[38px] min-h-[38px]",
                    activeOverride === 'logo'
                        ? "bg-red-600 border-red-500 shadow-lg shadow-red-500/20"
                        : "bg-stone-900/80 text-stone-400 hover:text-white hover:bg-stone-800 border-stone-800"
                )}
                title={`${t('logo_mode', 'Show Logo')} (L)`}
            >
                {activeLogoUrl && activeLogoUrl !== '' ? (
                    <div className="w-5 h-5 rounded-sm overflow-hidden flex items-center justify-center">
                        <img src={activeLogoUrl} alt={activeLogoName || 'Logo'} className="w-full h-full object-contain" />
                    </div>
                ) : (
                    <>
                        <ImageIcon className={cn("w-5 h-5 transition-transform", activeOverride === 'logo' ? "scale-110 text-white" : "scale-90")} />
                        <div className={cn(
                            "absolute inset-0 flex items-center justify-center text-[10px] font-bold transition-opacity",
                            activeOverride === 'logo' ? "opacity-100 text-white" : "opacity-0 group-hover:opacity-100 bg-black/40"
                        )}>
                            L
                        </div>
                    </>
                )}
            </button>
        </div>
    );
};
