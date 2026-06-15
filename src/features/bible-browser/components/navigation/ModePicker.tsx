import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Presentation } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { AppMode } from '@/core/types';

interface ModePickerProps {
    appMode: AppMode;
    onSetAppMode: (mode: AppMode) => void;
    onClose: () => void;
    triggerRect: DOMRect | null;
}

const ModePicker: React.FC<ModePickerProps> = React.memo(({
    appMode,
    onSetAppMode,
    onClose,
    triggerRect
}) => {
    const { t } = useTranslation();

    // Positioning logic
    const position = useMemo(() => {
        if (!triggerRect) return { top: '1rem', left: '1rem', width: '200px' };

        const spacing = 4;
        const windowHeight = window.innerHeight;
        const menuHeight = 100; // Approximate height for 2 items

        let top = triggerRect.bottom + spacing;
        let left = triggerRect.left;
        let width = Math.max(triggerRect.width, 192); // Minimum width 48 (w-48)

        // If it overlaps the bottom of the window, flip it to open upwards
        if (top + menuHeight > windowHeight) {
            return {
                bottom: windowHeight - triggerRect.top + spacing,
                left,
                width
            };
        }

        return { top, left, width };
    }, [triggerRect]);

    return createPortal(
        <div className="fixed inset-0 z-9999 pointer-events-none">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-transparent pointer-events-auto"
                onClick={onClose}
            />

            {/* Dropdown Content */}
            <div
                className="absolute bg-stone-900 border border-white/10 rounded-xl shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto flex flex-col"
                style={position}
            >
                <button
                    onClick={() => { onSetAppMode('scripture'); onClose(); }}
                    className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-colors text-left",
                        appMode === 'scripture' ? "bg-accent/10 text-accent font-bold" : "text-stone-400 hover:bg-white/5 hover:text-stone-200"
                    )}
                >
                    <BookOpen className="w-4 h-4" />
                    <span className="uppercase tracking-tight">{t('scripture')}</span>
                </button>
                <button
                    onClick={() => { onSetAppMode('presentation'); onClose(); }}
                    className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-colors text-left",
                        appMode === 'presentation' ? "bg-accent/10 text-accent font-bold" : "text-stone-400 hover:bg-white/5 hover:text-stone-200"
                    )}
                >
                    <Presentation className="w-4 h-4" />
                    <span className="uppercase tracking-tight">{t('presentation', 'Presentation')}</span>
                </button>
            </div>
        </div>,
        document.body
    );
});

ModePicker.displayName = 'ModePicker';

export default ModePicker;
