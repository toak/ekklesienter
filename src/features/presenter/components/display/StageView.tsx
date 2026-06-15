import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Verse, ISlide, PresenterSettings } from '@/core/types';
import { DEFAULT_SETTINGS } from '@/features/presenter/store/presenterStore';
import { db } from '@/core/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/core/utils/cn';
import SlideDisplay from './SlideDisplay';
import { usePresentationStore } from '../../store/presentationStore';
import { PresenterService } from '../../services/presenterService';
import { QRCodeSVG } from 'qrcode.react';

const StageView: React.FC = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<PresenterSettings>(DEFAULT_SETTINGS);
    const [slide, setSlide] = useState<ISlide | null>(null);
    const [verse, setVerse] = useState<Verse | null>(null);
    const [multiVerses, setMultiVerses] = useState<Verse[] | null>(null);
    const [isMultiVerseMode, setIsMultiVerseMode] = useState(false);
    const [appMode, setAppMode] = useState<'scripture' | 'presentation'>('scripture');
    const [secondTranslationId, setSecondTranslationId] = useState<string | null>(null);
    const [serverInfo, setServerInfo] = useState<{ ip: string, port: number, pin: string } | null>(null);

    const activePresentationId = usePresentationStore(s => s.activePresentationId);
    
    // Fetch parallel verse
    const parallelVerse = useLiveQuery(
        async () => {
            if (!verse || !secondTranslationId) return null;
            return await db.verses
                .where('[translationId+bookId+chapter]')
                .equals([secondTranslationId, verse.bookId, verse.chapter])
                .and(v => v.verseNumber === verse.verseNumber)
                .first();
        },
        [verse?.id, secondTranslationId]
    );

    // Fetch presentation to get prev/next slides
    const presentation = useLiveQuery(
        async () => {
            if (!activePresentationId) return null;
            return await db.presentationFiles.get(activePresentationId);
        },
        [activePresentationId]
    );

    let nextSlide: ISlide | null = null;
    let prevSlide: ISlide | null = null;

    if (presentation && slide) {
        const currentIndex = presentation.slides.findIndex(s => s.id === slide.id);
        if (currentIndex > 0) prevSlide = presentation.slides[currentIndex - 1];
        if (currentIndex < presentation.slides.length - 1) nextSlide = presentation.slides[currentIndex + 1];
    }

    useEffect(() => {
        document.body.classList.add('projector-mode'); // For consistent global styles if needed

        const handleCommand = (command: string, payload: any) => {
            switch (command) {
                case 'show-verse':
                    setVerse(payload.verse);
                    setMultiVerses(null);
                    setIsMultiVerseMode(false);
                    setSecondTranslationId(payload.secondTranslationId);
                    setSlide(null);
                    break;
                case 'show-multiverses':
                    setMultiVerses(payload.verses);
                    setIsMultiVerseMode(true);
                    setVerse(null);
                    setSecondTranslationId(payload.secondTranslationId);
                    setSlide(null);
                    break;
                case 'show-slide':
                    setSlide(payload.slide);
                    setVerse(null);
                    setMultiVerses(null);
                    setIsMultiVerseMode(false);
                    usePresentationStore.getState().setActivePresentation(payload.presentationId);
                    break;
                case 'set-app-mode':
                    setAppMode(payload);
                    break;
                case 'sync-state':
                case 'update-settings':
                    setSettings(payload);
                    break;
                case 'clear':
                    setVerse(null);
                    setSlide(null);
                    setMultiVerses(null);
                    setIsMultiVerseMode(false);
                    setSecondTranslationId(null);
                    break;
            }
        };

        const unsubscribe = PresenterService.subscribeToCommands(handleCommand);

        if (window.electron?.ipcRenderer?.remote) {
            window.electron.ipcRenderer.remote.getInfo().then((info: any) => {
                if (info?.success) {
                    setServerInfo({ ip: info.ip, port: info.port, pin: info.pin });
                }
            });
        }

        return () => {
            document.body.classList.remove('projector-mode');
            unsubscribe?.();
        };
    }, []);

    const stage = settings.stage ?? DEFAULT_SETTINGS.stage;
    const { layout, gap, cornerRadius, showRemoteQr } = stage;

    // A helper to render a slide in a miniaturized container without background overlaps
    const renderMiniSlide = (targetSlide: ISlide | null, label: string) => {
        if (!targetSlide) return (
            <div className="w-full h-full flex flex-col items-center justify-center text-stone-500 opacity-50 p-4">
                <span className="text-sm font-bold uppercase tracking-widest">{label}</span>
                <span className="text-xs mt-2">No Slide</span>
            </div>
        );

        return (
            <div className="relative w-full h-full overflow-hidden flex flex-col">
                <div className="absolute top-0 left-0 bg-stone-900/80 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 z-10 rounded-br-xl shadow-lg border-b border-r border-white/10">
                    {label}
                </div>
                <div className="flex-1 w-full h-full relative isolate pointer-events-none transform origin-top-left scale-[1]">
                    <SlideDisplay
                        isProjector={true}
                        selectedSlide={targetSlide}
                        settings={settings}
                        appMode={appMode}
                    />
                </div>
            </div>
        );
    };

    const renderCard = (card: typeof layout[0]) => {
        if (!card.visible) return null;

        const content = (() => {
            switch (card.id) {
                case 'current':
                    return (
                        <div className="relative w-full h-full overflow-hidden flex flex-col">
                            <div className="absolute top-0 left-0 bg-accent/80 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 z-10 rounded-br-xl shadow-lg">
                                {t('stage_current_slide', 'Current Slide')}
                            </div>
                            <div className="flex-1 w-full h-full relative isolate pointer-events-none">
                                <SlideDisplay
                                    isProjector={true}
                                    activeVerse={verse}
                                    selectedSlide={slide}
                                    parallelVerse={parallelVerse}
                                    multiVerses={multiVerses}
                                    isMultiVerseMode={isMultiVerseMode}
                                    appMode={appMode}
                                    settings={settings}
                                />
                            </div>
                        </div>
                    );
                case 'next':
                    return renderMiniSlide(nextSlide, t('stage_next_slide', 'Next Slide'));
                case 'prev':
                    return renderMiniSlide(prevSlide, t('stage_prev_slide', 'Previous Slide'));
                case 'sound':
                    // Just show basic info for now about active audio if any slide has it
                    const audioSettings = slide?.type === 'normal' ? (slide as any).audioSettings as any : null;
                    return (
                        <div className="w-full h-full flex flex-col items-center justify-center text-stone-300 p-6 bg-stone-900/50">
                            <span className="text-sm font-bold uppercase tracking-widest text-stone-500 mb-2">{t('stage_sound_card', 'Sound Card')}</span>
                            {audioSettings?.fileId ? (
                                <div className="text-center">
                                    <p className="text-xs text-accent uppercase tracking-widest">{t('audio_playing', 'Audio Attached')}</p>
                                </div>
                            ) : (
                                <span className="text-xs opacity-50">No Audio</span>
                            )}
                        </div>
                    );
                default:
                    return null;
            }
        })();

        return (
            <div 
                key={card.id}
                className="bg-black border border-white/10 overflow-hidden shadow-2xl flex relative"
                style={{
                    gridColumn: `span ${card.w}`,
                    gridRow: `span ${card.h}`,
                    borderRadius: `${cornerRadius}px`
                }}
            >
                {content}
            </div>
        );
    };

    return (
        <div className="w-screen h-screen overflow-hidden bg-stone-950 relative">
            <div 
                className="w-full h-full p-8 grid"
                style={{
                    gridTemplateColumns: 'repeat(12, 1fr)',
                    gridAutoRows: 'minmax(0, 1fr)',
                    gap: `${gap}px`,
                }}
            >
                {layout.map(renderCard)}
            </div>

            {/* QR Code Overlay */}
            <div className={cn(
                "absolute inset-0 z-100 bg-stone-950/90 backdrop-blur-xl flex flex-col items-center justify-center transition-all duration-700",
                showRemoteQr && serverInfo ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}>
                {serverInfo && (
                    <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center transform scale-125">
                        <QRCodeSVG 
                            value={`http://${serverInfo.ip}:${serverInfo.port}/remote.html`}
                            size={400}
                            bgColor="#ffffff"
                            fgColor="#000000"
                            level="H"
                        />
                        <div className="mt-12 text-center">
                            <p className="text-stone-500 uppercase tracking-[0.2em] font-bold text-sm mb-2">{t('connect_with_code', 'Connect Code')}</p>
                            <p className="text-6xl font-black tracking-widest text-stone-950">{serverInfo.pin}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StageView;
