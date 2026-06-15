import React from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { cn } from '../../core/utils/cn';

interface RemoteHeaderProps {
    isActive: boolean;
    onToggleProjector: () => void;
    onLogout: () => void;
}

export const RemoteHeader: React.FC<RemoteHeaderProps> = ({ isActive, onToggleProjector, onLogout }) => {
    const { t } = useTranslation();

    return (
        <div className="flex justify-between items-center mb-6 shrink-0">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onToggleProjector}
                    className={cn(
                        "font-black text-[10px] uppercase tracking-[0.3em] px-4 py-2 rounded-2xl border transition-all duration-500 cursor-pointer active:scale-95 select-none focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2 focus:ring-offset-stone-950",
                        isActive
                            ? "text-accent border-accent/40 bg-accent/10 opacity-100"
                            : "text-stone-500 border-white/5 bg-white/5 opacity-80"
                    )}
                >
                    {isActive ? t('remote.on_screen') : t('remote.preview')}
                </button>
            </div>
            <button
                type="button"
                onClick={onLogout}
                className="p-3 bg-stone-900/60 rounded-2xl border border-white/5 active:bg-stone-800 transition-all text-stone-500 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2 focus:ring-offset-stone-950"
            >
                <LogOut size={18} />
            </button>
        </div>
    );
};
