import React, { useEffect, useState } from 'react';
import { Verse, ISlide } from '@/core/types';
import { useTranslation } from 'react-i18next';
import SlideDisplay from '../display/SlideDisplay';
import { SlideBackground } from '../display/SlideBackground';
import { PresenterSettings } from '@/core/types';
import { DEFAULT_SETTINGS } from '@/features/presenter/store/presenterStore';
import { db } from '@/core/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/core/utils/cn';
import { ILogo } from '@/core/types';
import { useLogoUrl } from '@/core/hooks/useLogoUrl';
import { PRELOADED_LOGOS } from '@/core/data/logoData';
import { PresenterService } from '../../services/presenterService';

const ProjectorView: React.FC = () => {
    const { t } = useTranslation();
    const [verse, setVerse] = useState<Verse | null>(null);
    const [multiVerses, setMultiVerses] = useState<Verse[] | null>(null);
    const [isMultiVerseMode, setIsMultiVerseMode] = useState(false);
    const [slide, setSlide] = useState<ISlide | null>(null);
    const [appMode, setAppMode] = useState<'scripture' | 'presentation'>('scripture');
    const [secondTranslationId, setSecondTranslationId] = useState<string | null>(null);
    const [settings, setSettings] = useState<PresenterSettings>(DEFAULT_SETTINGS);

    // Live Overrides
    const [activeOverride, setActiveOverride] = useState<'blackout' | 'whiteout' | 'logo' | null>(null);
    const [activeLogo, setActiveLogo] = useState<ILogo | null>(null);
    const logoUrl = useLogoUrl(activeLogo);

    // Fetch parallel verse if second translation is active
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


    // 1. Lifecycle and IPC Initialization
    useEffect(() => {
        document.body.classList.add('projector-mode');

        const reportRatio = () => {
            if (window.electron?.ipcRenderer) {
                const ratio = window.innerWidth / window.innerHeight;
                window.electron.ipcRenderer.send('projector-ready', { ratio });
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!window.electron?.ipcRenderer) return;

            // List of codes to relay to the main window (layout independent)
            const codesToRelay = [
                'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp',
                'Space', 'Enter', 'Escape',
                'KeyB', 'KeyW', 'KeyL', 'KeyF', 'KeyH', 'KeyZ', 'KeyY', 'KeyC'
            ];

            if (codesToRelay.includes(e.code) || e.ctrlKey || e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                window.electron.ipcRenderer.send('relay-keydown', {
                    key: e.key,
                    code: e.code,
                    ctrlKey: e.ctrlKey,
                    metaKey: e.metaKey,
                    shiftKey: e.shiftKey,
                    altKey: e.altKey
                });
            }
        };

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
                    break;
                case 'set-app-mode':
                    setAppMode(payload);
                    break;
                case 'set-override':
                    setActiveOverride(payload.type);
                    if (payload.logo) {
                        setActiveLogo(payload.logo);
                    } else if (payload.url) {
                        setActiveLogo({ id: 'legacy', name: 'Legacy', url: payload.url });
                    } else if (!payload.type) {
                        setActiveLogo(null);
                    }
                    break;
                case 'update-theme':
                    document.documentElement.setAttribute('data-theme', payload);
                    break;
                case 'update-settings':
                    if (payload.logo?.activeLogoId) {
                        const allLogos = [
                            ...(payload.logo.customLogos || []),
                            ...(payload.logo.customGroups?.flatMap((g: any) => g.logos) || []),
                            ...(payload.logo.logoGroups?.flatMap((g: any) => g.logos) || []),
                            ...PRELOADED_LOGOS.flatMap(g => g.logos)
                        ];
                        const active = allLogos.find((l: any) => l.id === payload.logo.activeLogoId);
                        if (active) {
                            setActiveLogo(active);
                        }
                    }
                    setSettings(payload);
                    break;
                case 'clear':
                    setVerse(null);
                    setSlide(null);
                    setMultiVerses(null);
                    setIsMultiVerseMode(false);
                    setSecondTranslationId(null);
                    setActiveOverride(null);
                    setActiveLogo(null);
                    break;
            }
        };

        reportRatio();
        window.addEventListener('resize', reportRatio);
        window.addEventListener('keydown', handleKeyDown, true);

        const unsubscribe = PresenterService.subscribeToCommands(handleCommand);

        return () => {
            document.body.classList.remove('projector-mode');
            window.removeEventListener('resize', reportRatio);
            window.removeEventListener('keydown', handleKeyDown, true);
            unsubscribe?.();
        };
    }, []);

    return (
        <div className="w-screen h-screen overflow-hidden bg-black relative">
            <div className={cn(
                "w-full h-full transition-opacity duration-500",
                activeOverride ? "opacity-0" : "opacity-100"
            )}>
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

            {/* Blackout Overlay */}
            <div className={cn(
                "absolute inset-0 z-100 transition-opacity duration-700 pointer-events-none",
                activeOverride === 'blackout' ? "opacity-100" : "opacity-0"
            )}>
                <SlideBackground background={settings.overrides.blackout.background} />
            </div>

            {/* Whiteout Overlay */}
            <div className={cn(
                "absolute inset-0 z-101 transition-opacity duration-700 pointer-events-none",
                activeOverride === 'whiteout' ? "opacity-100" : "opacity-0"
            )}>
                <SlideBackground background={settings.overrides.whiteout.background} />
            </div>

            {/* Logo Overlay */}
            <div className={cn(
                "absolute inset-0 z-102 transition-opacity duration-700 pointer-events-none flex items-center justify-center p-24",
                activeOverride === 'logo' ? "opacity-100" : "opacity-0"
            )}>
                <SlideBackground background={settings.overrides.logo.background} />
                <div className="relative z-10 w-full h-full flex items-center justify-center font-serif">
                    {logoUrl ? (
                        <img src={logoUrl} alt="Church Logo" className="max-w-[70%] max-h-[70%] object-contain" />
                    ) : (
                        <div className="text-stone-700 flex flex-col items-center gap-6">
                            <div className="w-32 h-32 rounded-full border-4 border-stone-800 flex items-center justify-center opacity-20">
                                <span className="text-4xl font-black">E</span>
                            </div>
                            <h1 className="text-2xl font-black uppercase tracking-[0.3em] opacity-20">Ekklesienter</h1>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectorView;
