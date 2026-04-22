import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { AlertCircle, Trash2, ArrowRight } from 'lucide-react';

const AudioConflictModal: React.FC = () => {
    const { t } = useTranslation();
    const { closeModal, stack } = useModalStore();
    // Find the LAST instance to correctly support nested modals
    const modalData = [...stack].reverse().find(m => m.id === ModalType.AUDIO_CONFLICT);
    const isOpen = !!modalData;

    const { resolveAudioConflict } = usePresentationStore();

    if (!isOpen) return null;

    const { targetSlideId, fileId, fileName, overlappingScopes, actionType } = modalData.props;

    const handleReplace = async () => {
        await resolveAudioConflict('replace', { targetSlideId, fileId, fileName, overlappingScopes });
        closeModal(ModalType.AUDIO_CONFLICT);
    };

    const handleShift = async () => {
        await resolveAudioConflict('shift', { targetSlideId, fileId, fileName, overlappingScopes });
        closeModal(ModalType.AUDIO_CONFLICT);
    };

    return createPortal(
        <div className="fixed inset-0 z-10002 flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-stone-900 border border-white/10 rounded-[32px] w-full max-w-md flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
                <div className="px-6 py-8 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                        <AlertCircle className="w-8 h-8 text-amber-500" />
                    </div>

                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight uppercase">
                            {t('audio_conflict_title', 'Audio Overlap Detected')}
                        </h2>
                        <p className="text-stone-400 text-sm mt-2 font-medium">
                            {t('audio_conflict_desc', 'There is already an audio clip in this position. How would you like to proceed?')}
                        </p>
                    </div>

                    <div className="w-full space-y-2 mt-4">
                        <button
                            onClick={handleReplace}
                            className="w-full group flex items-center gap-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 transition-all text-left"
                        >
                            <div className="p-2 rounded-xl bg-red-500/20 text-red-500 group-hover:scale-110 transition-transform">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="block text-sm font-black text-white uppercase tracking-wider">
                                    {t('replace_existing', 'Replace Existing')}
                                </span>
                                <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest opacity-60">
                                    {t('replace_existing_desc', 'Delete overlapping clip(s)')}
                                </span>
                            </div>
                        </button>

                        <button
                            onClick={handleShift}
                            className="w-full group flex items-center gap-4 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/40 transition-all text-left"
                        >
                            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-500 group-hover:scale-110 transition-transform">
                                <ArrowRight className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="block text-sm font-black text-white uppercase tracking-wider">
                                    {t('place_and_move', 'Place and Move')}
                                </span>
                                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest opacity-60">
                                    {t('place_and_move_desc', 'Shift existing clips forward')}
                                </span>
                            </div>
                        </button>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-white/5 bg-stone-950/50 backdrop-blur-xl flex justify-end shrink-0">
                    <button
                        onClick={() => closeModal(ModalType.AUDIO_CONFLICT)}
                        className="px-6 py-2 bg-white/5 hover:bg-white/10 text-stone-400 font-bold rounded-xl transition-all border border-white/5 text-[10px] uppercase tracking-widest"
                    >
                        {t('cancel', 'Cancel')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AudioConflictModal;
