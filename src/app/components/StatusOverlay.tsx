import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { OverrideType } from '@/core/store/uiAtoms';

interface StatusOverlayProps {
    activeOverride: OverrideType | null;
}

export const StatusOverlay: React.FC<StatusOverlayProps> = ({ activeOverride }) => {
    const { t } = useTranslation();
    const isSaving = usePresentationStore(state => state.isSaving);

    return (
        <div className="absolute top-4 left-[340px] z-50 flex items-center gap-2 pointer-events-none">

            {/* Saving Indicator */}
            {isSaving && (
                <div className="px-3 py-1.5 flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full backdrop-blur-md">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                    <span className="text-[10px] font-bold text-accent uppercase tracking-widest">
                        {t('saving', 'Saving...')}
                    </span>
                </div>
            )}
        </div>
    );
};
