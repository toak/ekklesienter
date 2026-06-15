import React from 'react';
import SettingsModal from '@/features/settings/components/SettingsModal';
import QuickSearchModal from '@/features/search/components/QuickSearchModal';
import CustomizationPanel from '@/features/presenter/components/slide-properties/CustomizationPanel';
import BibleSelectionModal from '@/features/presenter/components/modals/BibleSelectionModal';
import TemplatePickerModal from '@/features/presenter/components/modals/TemplatePickerModal';
import AudioPickerModal from '@/features/presenter/components/modals/AudioPickerModal';
import AudioConflictModal from '@/features/presenter/components/modals/AudioConflictModal';
import SaveNestedConfirmModal from '@/features/presenter/components/modals/SaveNestedConfirmModal';
import PresentationImportModal from '@/features/presenter/components/modals/PresentationImportModal';
import PresentationPickerModal from '@/features/presenter/components/modals/PresentationPickerModal';
import { BackgroundCropModal } from '@/features/presenter/components/slide-properties/BackgroundCropModal';

interface AppModalsProps {
    settingsOpen: boolean;
    setSettingsOpen: (open: boolean) => void;
    searchOpen: boolean;
    setSearchOpen: (open: boolean) => void;
}

/**
 * Registry component for global app modals.
 * Some modals are controlled by local state, others via global ModalStore.
 */
export const AppModals: React.FC<AppModalsProps> = ({
    settingsOpen,
    setSettingsOpen,
    searchOpen,
    setSearchOpen
}) => {
    return (
        <>
            {/* Context/Feature Modals (controlled via ModalStore internally or directly) */}
            <CustomizationPanel />
            <BibleSelectionModal />
            <TemplatePickerModal />
            <AudioPickerModal />
            <AudioConflictModal />
            <SaveNestedConfirmModal />
            <PresentationImportModal />
            <PresentationPickerModal />
            <BackgroundCropModal />

            {/* Global Overlays (controlled via local App state) */}
            <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
            <QuickSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        </>
    );
};
