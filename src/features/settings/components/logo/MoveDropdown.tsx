import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, Group } from 'lucide-react';
import { ILogoGroup } from '@/core/types';

export interface MoveDropdownProps {
    groups: ILogoGroup[];
    currentGroupId: string | undefined;
    onMove: (targetGroupId: string | null) => void;
    onClose: () => void;
}

export const MoveDropdown: React.FC<MoveDropdownProps> = ({ groups, currentGroupId, onMove, onClose }) => {
    const { t } = useTranslation();

    return (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-stone-900 border border-white/10 rounded-2xl shadow-xl p-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Ungrouped option */}
            {currentGroupId && (
                <button
                    type="button"
                    onClick={() => { onMove(null); onClose(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-stone-300 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                >
                    <ImageIcon className="w-3.5 h-3.5 text-stone-500" />
                    {t('ungrouped_logos', 'Ungrouped')}
                </button>
            )}
            {groups
                .filter(g => g.id !== currentGroupId)
                .map(g => (
                    <button
                        key={g.id}
                        type="button"
                        onClick={() => { onMove(g.id); onClose(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-stone-300 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                    >
                        <Group className="w-3.5 h-3.5 text-accent/60" />
                        {g.name}
                    </button>
                ))
            }
            {groups.filter(g => g.id !== currentGroupId).length === 0 && !currentGroupId && (
                <p className="px-3 py-2 text-[10px] text-stone-600 italic">
                    {t('no_groups_to_move', 'Create a collection first')}
                </p>
            )}
        </div>
    );
};
