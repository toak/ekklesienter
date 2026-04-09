import React from 'react';
import { Layers, Plus, BookOpen, Timer, Unlink2, Film } from 'lucide-react';
import { TFunction } from 'i18next';
import { ModalType } from '@/core/store/modalStore';

interface TimelineToolbarProps {
    t: TFunction;
    slideCount: number;
    isDetached: boolean;
    handleAddSlide: (blockId: string, e?: React.MouseEvent) => void;
    handleAddTimer: (e?: React.MouseEvent) => void;
    handleAddVideo: (e?: React.MouseEvent) => void;
    openModal: (type: ModalType, props?: any) => void;
}

export const TimelineToolbar: React.FC<TimelineToolbarProps> = ({
    t,
    slideCount,
    isDetached,
    handleAddSlide,
    handleAddTimer,
    handleAddVideo,
    openModal
}) => {
    return (
        <div className="px-4 h-14 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Layers className="w-3 h-3" />
                    {t('timeline', 'Timeline')}
                </span>
                <div className="h-4 w-px bg-white/5" />
                <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">
                    {slideCount} {t('slides', 'Slides')}
                </span>

                {/* Detached Mode Warning */}
                {isDetached && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/15 border border-red-500/30 rounded-lg animate-in fade-in zoom-in-90 duration-300">
                        <Unlink2 className="w-3 h-3 text-red-400" />
                        <span className="text-[9px] font-black text-red-400 uppercase tracking-wider">
                            {t('detached_mode', 'Detached')}
                        </span>
                    </div>
                )}
            </div>

            {/* Quick Add Toolbar */}
            <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5 mr-2 my-2">
                <button
                    onClick={(e) => handleAddSlide('default', e)}
                    className="p-1.5 text-accent hover:bg-accent/10 rounded-lg transition-all group relative border border-accent/20"
                    title={t('add_blank_slide', 'Add Blank Slide')}
                >
                    <Plus className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button
                    onClick={() => openModal(ModalType.PRESENTATION_PICKER)}
                    className="p-1.5 text-stone-500 hover:text-accent hover:bg-accent/10 rounded-lg transition-all group relative"
                    title={t('add_nested_presentation', 'Add Nested Presentation')}
                >
                    <Layers className="w-4 h-4" />
                    <div className="absolute -top-1 -right-1">
                        <Plus className="w-2.5 h-2.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </button>
                <button
                    onClick={(e) => handleAddSlide('bible', e)}
                    className="p-1.5 text-stone-500 hover:text-accent hover:bg-accent/10 rounded-lg transition-all group relative"
                    title={t('add_bible_verse', 'Add Bible Verse')}
                >
                    <BookOpen className="w-4 h-4" />
                    <div className="absolute -top-1 -right-1">
                        <Plus className="w-2.5 h-2.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </button>
                <button
                    onClick={(e) => handleAddTimer(e)}
                    className="p-1.5 text-stone-500 hover:text-orange-400 hover:bg-orange-400/10 rounded-lg transition-all group relative"
                    title={t('add_timer_slide', 'Add Timer Slide')}
                >
                    <Timer className="w-4 h-4" />
                    <div className="absolute -top-1 -right-1">
                        <Plus className="w-2.5 h-2.5 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </button>
                <button
                    onClick={(e) => handleAddVideo(e)}
                    className="p-1.5 text-stone-500 hover:text-accent hover:bg-accent/10 rounded-lg transition-all group relative"
                    title={t('add_video_slide', 'Add Video Slide')}
                >
                    <Film className="w-4 h-4" />
                    <div className="absolute -top-1 -right-1">
                        <Plus className="w-2.5 h-2.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </button>
            </div>
        </div>
    );
};
