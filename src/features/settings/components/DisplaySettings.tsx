import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Cpu, ScreenShare } from 'lucide-react';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { cn } from '@/core/utils/cn';
import { IpcService } from '@/core/services/IpcService';

interface IDisplayInfo {
    id: number;
    label: string;
    bounds: { x: number; y: number; width: number; height: number };
    size: { width: number; height: number };
    scaleFactor: number;
}

const DisplaySettings: React.FC = () => {
    const { t } = useTranslation();
    const { settings, updateDisplay } = usePresenterStore();
    const [displays, setDisplays] = useState<IDisplayInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDisplays = async () => {
            if (IpcService.isElectron()) {
                try {
                    const data = await IpcService.invoke<IDisplayInfo[]>('get-displays');
                    setDisplays(data);

                    // If auto-defining, calculate current aspect ratio
                    if (settings.display.autoDefine && data.length > 0) {
                        const externalDisplay = data.find((d: any) => d.bounds.x !== 0 || d.bounds.y !== 0);
                        const display = externalDisplay || data[0];
                        const ratio = display.size.width / display.size.height;
                        if (settings.display.aspectRatio !== ratio) {
                            updateDisplay({ aspectRatio: ratio });
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch displays:', error);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        fetchDisplays();
    }, [settings.display.autoDefine]);

    const toggleAutoDefine = () => {
        updateDisplay({ autoDefine: !settings.display.autoDefine });
    };

    const setPresenterDisplay = (id: number) => {
        if (settings.display.autoDefine) return;
        const currentId = settings.display.presenterDisplayId;
        const display = displays.find(d => d.id === id);
        const ratio = display ? display.size.width / display.size.height : 16 / 9;

        updateDisplay({
            presenterDisplayId: currentId === id ? undefined : id,
            aspectRatio: currentId === id ? 16 / 9 : ratio
        });
    };

    const setPreviewDisplay = (id: number) => {
        if (settings.display.autoDefine) return;
        const currentId = settings.display.previewDisplayId;
        updateDisplay({ previewDisplayId: currentId === id ? undefined : id });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Auto Detection Toggle */}
            <div className="bg-stone-900/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl rounded-full translate-x-10 -translate-y-10" />

                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-stone-800 rounded-xl">
                            <Cpu className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white tracking-tight">{t('auto_define_displays')}</h3>
                            <p className="text-xs text-stone-500 font-medium">{t('auto_define_desc')}</p>
                        </div>
                    </div>

                    <button
                        onClick={toggleAutoDefine}
                        className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                            settings.display.autoDefine ? "bg-accent" : "bg-stone-800"
                        )}
                    >
                        <span
                            className={cn(
                                "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                                settings.display.autoDefine ? "translate-x-5" : "translate-x-0"
                            )}
                        />
                    </button>
                </div>
            </div>

            {/* Display List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isLoading ? (
                    // Skeleton
                    Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="h-48 bg-stone-900/40 border border-white/5 rounded-3xl animate-pulse" />
                    ))
                ) : (
                    displays.map((display) => {
                        const isPresenter = settings.display.presenterDisplayId === display.id;
                        const isPreview = settings.display.previewDisplayId === display.id;
                        const isMain = display.bounds.x === 0 && display.bounds.y === 0;

                        return (
                            <div
                                key={display.id}
                                className={cn(
                                    "bg-stone-900/40 border transition-all duration-300 rounded-3xl p-6 relative overflow-hidden group",
                                    (isPresenter || isPreview) ? "border-accent/30 bg-accent/5" : "border-white/5"
                                )}
                            >
                                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-accent/5 blur-2xl rounded-full group-hover:bg-accent/10 transition-colors" />

                                <div className="flex items-start justify-between mb-6 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-stone-800 rounded-xl">
                                            <Monitor className="w-5 h-5 text-accent" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-white wrap-break-word">
                                                {display.label || `${t('display')} ${display.id}`}
                                            </h4>
                                            <p className="text-[10px] text-stone-500 font-medium">
                                                {isMain ? t('display_card_main') : t('display_card_external')}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-mono text-stone-600 bg-stone-950/50 px-2 py-1 rounded-md">
                                        {display.size.width}x{display.size.height}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-2 relative z-10">
                                    <button
                                        disabled={settings.display.autoDefine}
                                        onClick={() => setPresenterDisplay(display.id)}
                                        className={cn(
                                            "flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                            isPresenter
                                                ? "bg-accent text-accent-foreground border-accent shadow-[0_0_15px_var(--accent-glow)]"
                                                : "bg-stone-950/50 border-white/5 text-stone-500 hover:text-stone-300 hover:bg-stone-800/40 disabled:opacity-30 disabled:cursor-not-allowed"
                                        )}
                                    >
                                        <ScreenShare className="w-3 h-3" />
                                        {t('presenter_display')}
                                    </button>

                                    <button
                                        disabled={settings.display.autoDefine}
                                        onClick={() => setPreviewDisplay(display.id)}
                                        className={cn(
                                            "flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                            isPreview
                                                ? "bg-stone-200 text-stone-950 border-white shadow-xl"
                                                : "bg-stone-950/50 border-white/5 text-stone-500 hover:text-stone-300 hover:bg-stone-800/40 disabled:opacity-30 disabled:cursor-not-allowed"
                                        )}
                                    >
                                        <Monitor className="w-3 h-3" />
                                        {t('preview_display')}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {settings.display.autoDefine && (
                <div className="p-4 bg-accent/5 border border-accent/10 rounded-2xl animate-in zoom-in-95 duration-500">
                    <p className="text-[10px] text-accent/80 font-medium leading-relaxed italic text-center">
                        {t('auto_define_active_notice', 'Automatic detection is active. The secondary monitor will be used for presentation by default.')}
                    </p>
                </div>
            )}
        </div>
    );
};

export default DisplaySettings;
