import React from 'react';
import { Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../core/utils/cn';

interface RemoteLoginProps {
    pin: string;
    setPin: (pin: string) => void;
    onConnect: (pin: string) => void;
    authError?: string;
}

export const RemoteLogin: React.FC<RemoteLoginProps> = ({ pin, setPin, onConnect, authError }) => {
    const { t } = useTranslation();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.length === 4) onConnect(pin);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-dvh p-6 bg-stone-950 text-white selection:bg-accent/30 overflow-hidden touch-none">
            <div className="w-full max-w-sm p-10 bg-stone-900/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 shadow-2xl animate-in fade-in zoom-in-95 duration-700 relative z-10">
                <div className="flex justify-center mb-8 relative">
                    <div className="p-5 bg-stone-950/50 rounded-3xl border border-white/5">
                        <Smartphone size={42} strokeWidth={1.5} className="text-accent" />
                    </div>
                </div>

                <div className="text-center mb-10 overflow-hidden">
                    <h1 className="text-xl font-black uppercase tracking-[0.15em] mb-2 whitespace-nowrap overflow-hidden text-ellipsis w-full">
                        {t('remote.title')}
                    </h1>
                    <p className="text-stone-500 text-sm font-medium leading-relaxed">{t('remote.pin_instruction')}</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                    <div className="flex justify-between gap-3 relative group">
                        {[0, 1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className={cn(
                                    "w-14 h-20 rounded-2xl border-2 flex items-center justify-center text-3xl font-black transition-all duration-300",
                                    pin[i]
                                        ? "border-accent/40 bg-stone-950/60 text-white shadow-[0_0_20px_rgba(0,0,0,0.4)]"
                                        : "border-white/5 bg-stone-950/20 text-stone-700",
                                    pin.length === i && "border-accent/60 bg-stone-900/40 scale-105"
                                )}
                            >
                                {pin[i] || '•'}
                            </div>
                        ))}
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            value={pin}
                            autoFocus
                            onFocus={(e) => {
                                setTimeout(() => {
                                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }, 300);
                            }}
                            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                            className="absolute inset-0 opacity-0 cursor-pointer caret-transparent"
                        />
                    </div>

                    {authError && (
                        <div className="bg-red-500/10 border border-red-500/20 py-3 rounded-xl animate-in slide-in-from-top-2 duration-300">
                            <p className="text-red-400 text-xs font-bold text-center uppercase tracking-widest">{authError}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={pin.length !== 4}
                        className={cn(
                            "w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm transition-all duration-500 active:scale-[0.97] flex items-center justify-center gap-3",
                            pin.length === 4
                                ? "bg-accent text-accent-foreground shadow-lg shadow-accent/10"
                                : "bg-stone-800 text-stone-600 opacity-50 grayscale"
                        )}
                    >
                        {t('remote.connect_device')}
                    </button>
                </form>
            </div>

            <p className="mt-12 text-[10px] font-black uppercase tracking-[0.3em] text-stone-700">
                Ekklesienter <span className="text-stone-800">v{import.meta.env.VITE_APP_VERSION || '2.2.2'}</span>
            </p>
        </div>
    );
};
