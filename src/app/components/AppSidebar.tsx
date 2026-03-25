import React from 'react';
import NavigationPanel from '@/features/bible-browser/components/NavigationPanel';
import VerseList from '@/features/bible-browser/components/VerseList';
import PresentationLibrary from '@/features/presenter/components/library/PresentationLibrary';
import { useResizable } from '@/core/hooks/useResizable';

interface AppSidebarProps {
    appMode: 'scripture' | 'presentation';
    onOpenSettings: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ appMode, onOpenSettings }) => {
    // Resizable navigation panel width - independent per mode
    const navPanel = useResizable(`nav-panel-width-${appMode}`, 200, 150, 350, 'horizontal');
    // Resizable side panel width - independent per mode
    const sidePanel = useResizable(`side-panel-width-${appMode}`, 280, 200, 500, 'horizontal');

    return (
        <>
            {/* Column 1: Navigation / Core App Context */}
            <div style={{ width: navPanel.size }} className="h-full shrink-0">
                <NavigationPanel onOpenSettings={onOpenSettings} />
            </div>

            {/* Resize Handle */}
            <div
                onMouseDown={navPanel.handleMouseDown}
                className="w-1 bg-stone-800 hover:bg-accent transition-colors cursor-col-resize shrink-0"
            />

            {/* Column 2: Specific Panel (Library or Verse List) */}
            <div style={{ width: sidePanel.size }} className="h-full shrink-0">
                {appMode === 'scripture' ? (
                    <VerseList />
                ) : (
                    <PresentationLibrary />
                )}
            </div>

            {/* Resize Handle */}
            <div
                onMouseDown={sidePanel.handleMouseDown}
                className="w-1 bg-stone-800 hover:bg-accent transition-colors cursor-col-resize shrink-0"
            />
        </>
    );
};
