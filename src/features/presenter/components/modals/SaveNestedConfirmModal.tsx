import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { Save, Share2, AlertCircle } from 'lucide-react';

const SaveNestedConfirmModal: React.FC = () => {
    const { t } = useTranslation();
    const { closeModal, stack } = useModalStore();
    // Find the LAST instance to correctly support nested modals
    const modalData = [...stack].reverse().find(m => m.id === ModalType.SAVE_NESTED_CONFIRM);
    const isOpen = !!modalData;

    const { saveNestedChanges } = usePresentationStore();

    if (!isOpen) return null;

    const handleUpdateOriginal = async () => {
        await saveNestedChanges({ syncBack: true });
        closeModal(ModalType.SAVE_NESTED_CONFIRM);
    };

    const handleKeepLocal = async () => {
        await saveNestedChanges({ syncBack: false });
        closeModal(ModalType.SAVE_NESTED_CONFIRM);
    };

    return createPortal(
        <div className="fixed inset-0 z-10002 flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-stone-900 border border-white/10 rounded-[32px] w-full max-w-md flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
                <div className="px-6 py-8 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-accent/10 flex items-center justify-center border border-accent/20">
                        <AlertCircle className="w-8 h-8 text-accent" />
                    </div>

                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight uppercase">
                            {t('save_nested_title', 'Update Nested Presentations?')}
                        </h2>
                        <p className="text-stone-400 text-sm mt-2 font-medium">
                            {t('save_nested_desc', "You've edited nested presentations. Do you want to update the original library files or keep these changes only in this presentation?")}
                        </p>
                    </div>

                    <div className="w-full space-y-2 mt-4">
                        <button
                            onClick={handleUpdateOriginal}
                            className="w-full group flex items-center gap-4 p-4 rounded-2xl bg-accent/10 border border-accent/20 hover:bg-accent/20 hover:border-accent/40 transition-all text-left"
                        >
                            <div className="p-2 rounded-xl bg-accent/20 text-accent group-hover:scale-110 transition-transform">
                                <Save className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="block text-sm font-black text-white uppercase tracking-wider">
                                    {t('update_original', 'Update Original')}
                                </span>
                                <span className="text-[10px] text-accent/60 font-bold uppercase tracking-widest">
                                    {t('update_original_desc', 'Sync changes back to library')}
                                </span>
                            </div>
                        </button>

                        <button
                            onClick={handleKeepLocal}
                            className="w-full group flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left"
                        >
                            <div className="p-2 rounded-xl bg-stone-800 text-stone-400 group-hover:scale-110 transition-transform">
                                <Share2 className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="block text-sm font-black text-white uppercase tracking-wider">
                                    {t('keep_local_only', 'Only for this presentation')}
                                </span>
                                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                                    {t('keep_local_only_desc', 'Changes stay only in this workflow')}
                                </span>
                            </div>
                        </button>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-white/5 bg-stone-950/50 backdrop-blur-xl flex justify-end shrink-0">
                    <button
                        onClick={() => closeModal(ModalType.SAVE_NESTED_CONFIRM)}
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

export default SaveNestedConfirmModal;
