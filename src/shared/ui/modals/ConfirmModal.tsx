import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/core/utils/cn';

interface ConfirmModalProps {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary';
    onSelection: (confirmed: boolean) => void;
}

const ConfirmModal: React.FC = () => {
    const { t } = useTranslation();
    const { closeModal, stack } = useModalStore();
    // Find the LAST instance of CONFIRM to correctly support nested modals
    const modalData = [...stack].reverse().find(m => m.id === ModalType.CONFIRM);
    const isOpen = !!modalData;
    const props = modalData?.props as ConfirmModalProps;


    if (!isOpen || !props) return null;

    const handleConfirm = () => {
        if (typeof props.onSelection === 'function') {
            props.onSelection(true);
        }
        closeModal(ModalType.CONFIRM);
    };

    const handleCancel = () => {
        if (typeof props.onSelection === 'function') {
            props.onSelection(false);
        }
        closeModal(ModalType.CONFIRM);
    };

    const zIndex = 10010 + stack.indexOf(modalData) * 10;

    return createPortal(
        <div 
            className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            style={{ zIndex }}
        >
            <div className="bg-stone-900 border border-white/10 rounded-2xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className={cn("w-4 h-4", props.variant === 'danger' ? "text-red-500" : "text-amber-500")} />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">{props.title}</h3>
                    </div>
                    <button
                        onClick={handleCancel}
                        className="text-stone-500 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-6 py-6">
                    <p className="text-sm text-stone-400 font-medium leading-relaxed">
                        {props.message}
                    </p>
                </div>

                <div className="px-6 py-4 bg-stone-950/50 border-t border-white/5 flex justify-end gap-2">
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 text-[10px] font-bold text-stone-500 hover:text-stone-300 uppercase tracking-widest transition-colors"
                    >
                        {props.cancelLabel || t('cancel', 'Cancel')}
                    </button>
                    <button
                        autoFocus
                        onClick={handleConfirm}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg",
                            props.variant === 'danger'
                                ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
                                : "bg-accent hover:bg-accent/80 text-white shadow-accent/20"
                        )}
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{props.confirmLabel || t('confirm', 'Confirm')}</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConfirmModal;
