import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ICanvasSlide } from '@/core/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { Type, Subtitles, AlignLeft, Layout, Settings2, Layers, Music, Plus } from 'lucide-react';
import { cn } from '@/core/utils/cn';

const VariableEditor: React.FC = () => {
    const { t } = useTranslation();
    const { activePresentationId, selectedPresentationId, previewSlideId, updateSlideVariable } = usePresentationStore();

    const presentation = useLiveQuery(
        () => selectedPresentationId ? db.presentationFiles.get(selectedPresentationId) : undefined,
        [selectedPresentationId]
    );

    const selectedSlide = useMemo(() =>
        presentation?.slides?.find(s => s.id === previewSlideId)
        , [presentation, previewSlideId]);

    // Don't show editor for Bible slides (managed via Bible modal)
    if (!selectedSlide || selectedSlide.blockId === 'bible' || selectedSlide.type !== 'normal') return null;
    
    const canvasSlide = selectedSlide as ICanvasSlide;
    const vars = canvasSlide.content?.variables || {};

    const handleUpdate = (name: string, value: string) => {
        updateSlideVariable(selectedSlide.id, name, value);
    };

    return (
        <div className="absolute top-6 right-6 w-80 bg-stone-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl flex flex-col z-40 animate-in fade-in slide-in-from-right-8 duration-500 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5 text-accent" />
                    {t('content_editor', 'Content Editor')}
                </h3>
            </div>

            {/* Editor Fields */}
            <div className="p-4 space-y-5">
                {/* Title Field */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest flex items-center gap-1.5 px-1">
                        <Type className="w-3 h-3" />
                        {t('slide_title', 'Title')}
                    </label>
                    <input
                        type="text"
                        value={vars.title || ''}
                        onChange={(e) => handleUpdate('title', e.target.value)}
                        placeholder={t('enter_title', 'Enter title...')}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder:text-stone-700 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all font-medium"
                    />
                </div>

                {/* Subtitle Field */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest flex items-center gap-1.5 px-1">
                        <Subtitles className="w-3 h-3" />
                        {t('slide_subtitle', 'Subtitle')}
                    </label>
                    <input
                        type="text"
                        value={vars.subtitle || ''}
                        onChange={(e) => handleUpdate('subtitle', e.target.value)}
                        placeholder={t('enter_subtitle', 'Enter subtitle...')}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder:text-stone-700 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all font-medium"
                    />
                </div>

                {/* Content Field */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest flex items-center gap-1.5 px-1">
                        <AlignLeft className="w-3 h-3" />
                        {t('slide_content', 'Content')}
                    </label>
                    <textarea
                        value={vars.content || ''}
                        onChange={(e) => handleUpdate('content', e.target.value)}
                        placeholder={t('enter_content', 'Enter slide content...')}
                        rows={3}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder:text-stone-700 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all font-medium resize-none no-scrollbar"
                    />
                </div>

                {/* Transition & Audio */}
                <div className="pt-4 border-t border-white/5 space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest flex items-center gap-1.5 px-1">
                            <Layers className="w-3 h-3" />
                            {t('transition', 'Transition')}
                        </label>
                        <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                            {['None', 'Fade', 'Scale'].map((type) => (
                                <button
                                    key={type}
                                    className={cn(
                                        "flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all",
                                        type === 'Fade' ? "bg-accent/20 text-accent shadow-sm" : "text-stone-600 hover:text-stone-400"
                                    )}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest flex items-center gap-1.5 px-1">
                            <Music className="w-3 h-3" />
                            {t('audio_track', 'Audio Track')}
                        </label>
                        <button className="w-full bg-stone-800/50 hover:bg-stone-800 border border-white/5 py-2 px-3 rounded-xl flex items-center justify-between text-xs text-stone-500 group transition-all">
                            <span className="truncate">{t('no_audio_attached', 'No audio attached')}</span>
                            <Plus className="w-3.5 h-3.5 text-stone-700 group-hover:text-accent transition-colors" />
                        </button>
                    </div>
                </div>

                {/* Meta Info */}
                <div className="pt-2 border-t border-white/5 mt-4">
                    <div className="flex items-center justify-between text-[10px] font-bold text-stone-700 uppercase">
                        <span className="flex items-center gap-1.5">
                            <Layout className="w-3 h-3" />
                            Template
                        </span>
                        <span className="text-stone-500">Default (Centered)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VariableEditor;
