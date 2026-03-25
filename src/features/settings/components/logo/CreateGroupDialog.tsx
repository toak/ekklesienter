import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface CreateGroupDialogProps {
    onSubmit: (name: string) => void;
    onCancel: () => void;
}

export const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({ onSubmit, onCancel }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');

    return (
        <div className="flex items-center gap-3 p-4 bg-stone-800/60 rounded-2xl border border-accent/20 animate-in fade-in slide-in-from-top-2 duration-300">
            <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) onSubmit(name.trim());
                    if (e.key === 'Escape') onCancel();
                }}
                placeholder={t('group_name_placeholder', 'Collection name...')}
                className="flex-1 min-w-0 bg-transparent border-b border-white/10 focus:border-accent/50 text-sm text-white placeholder:text-stone-600 outline-none pb-1 transition-colors"
            />
            <button
                type="button"
                onClick={() => name.trim() && onSubmit(name.trim())}
                disabled={!name.trim()}
                className="px-4 py-1.5 bg-accent text-accent-foreground text-xs font-bold rounded-xl disabled:opacity-30 transition-opacity cursor-pointer"
            >
                {t('common:create', 'Create')}
            </button>
            <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
            >
                {t('common:cancel', 'Cancel')}
            </button>
        </div>
    );
};
