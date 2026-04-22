import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoadingStore } from '../store/loadingStore';
import logoUrl from '@/assets/app-logo/logo.png';

export const LoadingScreen: React.FC = () => {
    const { t } = useTranslation();
    const { phase, progress, isLoaded } = useLoadingStore();
    const [shouldRender, setShouldRender] = useState(true);
    const [opacity, setOpacity] = useState(1);

    useEffect(() => {
        if (isLoaded) {
            // Smooth exit transition
            const timer = setTimeout(() => {
                setOpacity(0);
                setTimeout(() => setShouldRender(false), 500);
            }, 500); // Hold the "Ready" state for a moment
            return () => clearTimeout(timer);
        }
    }, [isLoaded]);

    if (!shouldRender) return null;

    return (
        <div 
            className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-stone-950 transition-opacity duration-500 ease-out"
            style={{ opacity }}
        >
            {/* Background Atmosphere */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 blur-[120px] rounded-full animate-pulse" />
            </div>

            <div className="relative flex flex-col items-center gap-12 max-w-sm w-full px-8">
                {/* Logo with breath animation */}
                <div className="relative w-48 h-48 flex items-center justify-center">
                    <img 
                        src={logoUrl} 
                        alt="Ekklesienter" 
                        className="w-full h-full object-contain animate-[pulse_3s_ease-in-out_infinite] brightness-110 drop-shadow-[0_0_30px_rgba(var(--accent),0.2)]"
                    />
                </div>

                {/* Status Column */}
                <div className="flex flex-col items-center gap-4 w-full text-center">
                    <h2 className="text-stone-400 font-medium tracking-[0.2em] uppercase text-[10px] animate-pulse">
                        {t(`loading_status.${phase}` as any, t('loading'))}
                    </h2>

                    {/* Minimalist Progress Bar */}
                    <div className="h-[2px] w-48 bg-stone-800/50 rounded-full overflow-hidden relative">
                        <div 
                            className="absolute inset-y-0 left-0 bg-accent transition-all duration-700 ease-out shadow-[0_0_10px_rgba(var(--accent),0.5)]"
                            style={{ width: `${Math.max(5, progress)}%` }}
                        />
                        {/* Shimmer Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-12 text-stone-600 text-[10px] font-medium tracking-widest uppercase opacity-40">
                Premium Worship Experience
            </div>

            <style>{`
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};
