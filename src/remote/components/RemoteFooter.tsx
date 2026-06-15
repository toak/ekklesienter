import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, BookOpen } from 'lucide-react';

interface RemoteFooterProps {
    mode: 'slides' | 'bible' | 'timeline';
    setMode: (mode: 'slides' | 'bible' | 'timeline') => void;
}

export const RemoteFooter: React.FC<RemoteFooterProps> = ({ mode, setMode }) => {
    const { t } = useTranslation();

    return (
        <div className="shrink-0 flex items-center gap-2 p-2 bg-stone-900/60 rounded-full border border-white/5 mt-auto backdrop-blur-2xl shadow-2xl relative z-20 mb-2 pb-safe">
            <button
                onClick={() => setMode('slides')}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full transition-all ${mode === 'slides' || mode === 'timeline' ? 'bg-accent text-accent-foreground shadow-xl' : 'text-stone-500 hover:text-stone-300'}`}
            >
                <span className="shrink-0"><Layers size={18} fill={mode === 'slides' || mode === 'timeline' ? 'currentColor' : 'none'} /></span>
                <span className="text-[11px] font-bold uppercase tracking-widest">{t('remote.slides')}</span>
            </button>
            <button
                onClick={() => setMode('bible')}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full transition-all ${mode === 'bible' ? 'bg-accent text-accent-foreground shadow-xl' : 'text-stone-500 hover:text-stone-300'}`}
            >
                <span className="shrink-0"><BookOpen size={18} fill={mode === 'bible' ? 'currentColor' : 'none'} /></span>
                <span className="text-[11px] font-bold uppercase tracking-widest">{t('remote.bible')}</span>
            </button>
        </div>
    );
};
