import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { CheckCircle2, X } from 'lucide-react';

interface PromptModalProps {
    title: string;
    defaultValue?: string;
    type?: 'text' | 'password';
    onSelection: (value: string | null) => void;
}

const PromptModal: React.FC = () => {
    const { t } = useTranslation();
    const { closeModal, stack } = useModalStore();
    // Find the LAST instance of PROMPT to correctly support nested modals
    const modalData = [...stack].reverse().find(m => m.id === ModalType.PROMPT);
    const isOpen = !!modalData;
    const props = modalData?.props as PromptModalProps;


    const [value, setValue] = useState(props?.defaultValue || '');

    // Reset local state when modal data changes
    React.useEffect(() => {
        if (props?.defaultValue !== undefined) {
            setValue(props.defaultValue);
        } else {
            setValue('');
        }
    }, [props?.defaultValue, isOpen]);

    if (!isOpen || !props) return null;

    const handleConfirm = () => {
        if (typeof props.onSelection === 'function') {
            props.onSelection(value);
        }
        closeModal(ModalType.PROMPT);
    };

    const handleCancel = () => {
        if (typeof props.onSelection === 'function') {
            props.onSelection(null);
        }
        closeModal(ModalType.PROMPT);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleConfirm();
        if (e.key === 'Escape') handleCancel();
    };

    const zIndex = 10010 + stack.indexOf(modalData) * 10;

    return createPortal(
        <div 
            className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            style={{ zIndex }}
        >
            <div
                className="bg-stone-900 border border-white/10 rounded-2xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
                onKeyDown={handleKeyDown}
            >
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">{props.title}</h3>
                    <button
                        onClick={handleCancel}
                        className="text-stone-500 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-6 py-6">
                    <input
                        autoFocus
                        type={props.type || 'text'}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-full bg-stone-950 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                        placeholder={t('type_here', 'Type here...')}
                    />
                </div>

                <div className="px-6 py-4 bg-stone-950/50 border-t border-white/5 flex justify-end gap-2">
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 text-[10px] font-bold text-stone-500 hover:text-stone-300 uppercase tracking-widest transition-colors"
                    >
                        {t('cancel', 'Cancel')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-accent/20"
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t('confirm', 'Confirm')}</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PromptModal;
