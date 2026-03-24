import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Command,
    Plus,
    MousePointer2,
    MonitorOff,
    Type,
    Presentation,
    Layers
} from 'lucide-react';
import { cn } from '@/core/utils/cn';

interface ShortcutItemProps {
    label: string;
    keys: string[];
    description?: string;
}

const MouseIcon: React.FC<{ button: 'left' | 'right' | 'middle', double?: boolean }> = ({ button, double }) => (
    <div className="relative inline-flex items-center group/mouse">
        <div className="w-5 h-7 border-2 border-white/20 rounded-lg flex flex-col overflow-hidden bg-stone-900/50 shadow-sm transition-colors group-hover/mouse:border-white/30">
            {/* Top row with 3 buttons */}
            <div className="h-3.5 flex border-b border-white/10">
                <div className={cn(
                    "w-1.5 border-r border-white/10 transition-colors",
                    button === 'left' ? "bg-accent" : "bg-transparent"
                )} />
                <div className={cn(
                    "flex-1 border-r border-white/10 flex items-center justify-center transition-colors",
                    button === 'middle' ? "bg-accent" : "bg-transparent"
                )}>
                    <div className="w-px h-2 bg-white/20 rounded-full" />
                </div>
                <div className={cn(
                    "w-1.5 transition-colors",
                    button === 'right' ? "bg-accent" : "bg-transparent"
                )} />
            </div>
            {/* Body */}
            <div className="flex-1 bg-stone-800/30" />
        </div>
        {double && (
            <div className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-accent rounded-full border-2 border-stone-950 flex items-center justify-center shadow-lg">
                <span className="text-[7px] font-black text-white italic">x2</span>
            </div>
        )}
    </div>
);

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (typeof children === 'string') {
        if (children.toLowerCase().includes('click')) {
            const isDouble = children.toLowerCase().includes('double');
            const isRight = children.toLowerCase().includes('right');
            const isMiddle = children.toLowerCase().includes('middle');
            const button = isRight ? 'right' : isMiddle ? 'middle' : 'left';

            return <MouseIcon button={button} double={isDouble} />;
        }
    }

    return (
        <kbd className="min-w-[24px] h-6 px-1.5 flex items-center justify-center bg-stone-900 border border-white/10 rounded-md text-[10px] font-bold text-stone-300 shadow-sm group-hover:border-white/20 transition-colors">
            {children}
        </kbd>
    );
};

const ShortcutItem: React.FC<ShortcutItemProps> = ({ label, keys, description }) => {
    // Split keys into groups separated by '/' (OR)
    const groups: string[][] = [];
    let currentGroup: string[] = [];

    keys.forEach(key => {
        if (key === '/') {
            if (currentGroup.length > 0) groups.push(currentGroup);
            currentGroup = [];
        } else {
            currentGroup.push(key);
        }
    });
    if (currentGroup.length > 0) groups.push(currentGroup);

    return (
        <div className="flex items-start justify-between p-3 rounded-xl hover:bg-white/5 transition-all group border border-transparent hover:border-white/5 gap-4">
            <div className="flex flex-col gap-0.5 flex-1 py-0.5">
                <span className="text-sm font-semibold text-stone-200 leading-tight">{label}</span>
                {description && <span className="text-[10px] text-stone-500 font-medium uppercase tracking-wider leading-relaxed">{description}</span>}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end pt-0.5">
                {groups.map((group, groupIdx) => (
                    <React.Fragment key={groupIdx}>
                        {/* Group of keys (combination) - never split */}
                        <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                            {group.map((key, keyIdx) => (
                                <React.Fragment key={keyIdx}>
                                    <Kbd>{key}</Kbd>
                                    {keyIdx < group.length - 1 && (
                                        <span className="text-stone-600 text-[10px] font-bold">+</span>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                        {groupIdx < groups.length - 1 && (
                            <div className="w-full sm:w-auto flex justify-end group/sep">
                                <span className="text-stone-600/50 text-[10px] font-bold px-0.5 select-none self-center">/</span>
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

const CategoryHeader: React.FC<{ title: string; icon: any }> = ({ title, icon: Icon }) => (
    <div className="flex items-center gap-3 px-3 mb-2 mt-6 first:mt-0">
        <div className="p-2 rounded-lg bg-accent/10 border border-accent/20">
            <Icon className="w-4 h-4 text-accent" />
        </div>
        <h3 className="text-xs font-black text-stone-500 uppercase tracking-[0.2em]">{title}</h3>
    </div>
);

const ShortcutsSettings: React.FC = () => {
    const { t } = useTranslation();
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? '⌘' : 'Ctrl';

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Navigation & Playback */}
            <CategoryHeader title={t('shortcuts_navigation', 'Navigation & Playback')} icon={MousePointer2} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ShortcutItem label={t('next_slide', 'Next Slide')} keys={['→', '/', '↓', '/', 'Space']} />
                <ShortcutItem label={t('prev_slide', 'Previous Slide')} keys={['←', '/', '↑']} />
                <ShortcutItem label={t('go_live', 'Go Live / Project')} keys={['Enter']} description={t('context_aware', 'Context Aware')} />
                <ShortcutItem label={t('close_projector', 'Close Projector')} keys={['Esc']} />
                <ShortcutItem label={t('search', 'Search')} keys={[mod, 'F']} />
                <ShortcutItem label={t('history', 'History')} keys={[mod, 'H']} />
                <ShortcutItem label={t('sync_live', 'Sync Preview to Live')} keys={['H']} />
            </div>

            {/* Live Overrides */}
            <CategoryHeader title={t('shortcuts_overrides', 'Live Overrides')} icon={MonitorOff} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ShortcutItem label={t('blackout', 'Blackout')} keys={['B']} />
                <ShortcutItem label={t('whiteout', 'Whiteout')} keys={['W']} />
                <ShortcutItem label={t('logo_mode', 'Logo Mode')} keys={['L']} />
            </div>

            {/* Slide Management */}
            <CategoryHeader title={t('shortcuts_management', 'Slide Management')} icon={Presentation} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ShortcutItem label={t('save', 'Save')} keys={[mod, 'S']} />
                <ShortcutItem label={t('undo', 'Undo')} keys={[mod, 'Z']} />
                <ShortcutItem label={t('redo', 'Redo')} keys={[mod, 'Shift', 'Z', '/', mod, 'Y']} />
                <ShortcutItem label={t('duplicate', 'Duplicate Slide')} keys={[mod, 'D']} />
                <ShortcutItem label={t('move_back', 'Move Back')} keys={[mod, '[']} />
                <ShortcutItem label={t('move_forth', 'Move Forth')} keys={[mod, ']']} />
                <ShortcutItem label={t('delete', 'Delete')} keys={['Del', '/', '⌫']} description={t('timeline_hover', 'Timeline Hovered')} />
            </div>

            {/* Timeline */}
            <CategoryHeader title={t('shortcuts_timeline', 'Timeline')} icon={Layers} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ShortcutItem label={t('select_individual', 'Select Individual Slide')} keys={[mod, 'Click']} />
                <ShortcutItem label={t('select_range', 'Select Range of Slides')} keys={['Shift', 'Click']} />
                <ShortcutItem label={t('select_all_slides', 'Select All Slides')} keys={[mod, 'A']} />
                <ShortcutItem label={t('deselect_all', 'Deselect All')} keys={['Alt / ⌥', 'D']} description={t('timeline_hover', 'Timeline Hovered')} />
                <ShortcutItem label={t('insert_before', 'Insert Before Selected')} keys={[mod, 'Click on +']} description={t('insert_before_desc', 'Hold while clicking add buttons')} />
            </div>

            {/* Canvas Editor */}
            <CategoryHeader title={t('shortcuts_canvas', 'Canvas Editor')} icon={MousePointer2} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ShortcutItem label={t('delete_element', 'Delete Element')} keys={['Del', '/', '⌫']} />
                <ShortcutItem label={t('exit_editing', 'Exit Editing')} keys={['Esc']} />
                <ShortcutItem label={t('multi_select', 'Multi-select')} keys={['Shift', 'Click', '/', mod, 'Click']} />
                <ShortcutItem label={t('direct_edit', 'Direct Edit')} keys={['Double Click']} />
            </div>

            {/* Media Pool */}
            <CategoryHeader title={t('media_pool.title', 'Media Pool')} icon={Plus} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ShortcutItem label={t('select_individual', 'Select Individual')} keys={['Click']} />
                <ShortcutItem label={t('multi_select_toggle', 'Toggle Multi-select')} keys={[mod, 'Click']} />
                <ShortcutItem label={t('select_range', 'Select Range')} keys={['Shift', 'Click']} />
                <ShortcutItem label={t('delete_selected', 'Delete Selected')} keys={['Del', '/', '⌫']} />
            </div>

            {/* Text Editor */}
            <CategoryHeader title={t('shortcuts_text_editor', 'Text Editor')} icon={Type} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ShortcutItem label={t('paste_format', 'Paste with formatting')} keys={[mod, 'V']} />
                <ShortcutItem label={t('paste_plain', 'Paste plain text')} keys={[mod, 'Shift', 'V']} />
                <ShortcutItem label={t('clear_format', 'Clear Formatting completely')} keys={[mod, 'Alt / ⌥', 'Shift', 'C']} />
                <ShortcutItem label={t('bold', 'Bold')} keys={[mod, 'B']} />
                <ShortcutItem label={t('italic', 'Italic')} keys={[mod, 'I']} />
                <ShortcutItem label={t('underline', 'Underline')} keys={[mod, 'U']} />
            </div>

            {/* Scripture */}
            <CategoryHeader title={t('shortcuts_scripture', 'Scripture Mode')} icon={Type} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ShortcutItem label={t('copy_verse', 'Copy Verse Text')} keys={[mod, 'Shift', 'C']} />
            </div>

            <div className="mt-12 p-6 rounded-2xl bg-accent/5 border border-accent/10 flex items-start gap-4">
                <div className="p-3 rounded-xl bg-accent/20">
                    <Command className="w-5 h-5 text-accent" />
                </div>
                <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">{t('shortcuts_savvy', 'Keyboard Savvy')}</h4>
                    <p className="text-xs text-stone-400 leading-relaxed max-w-lg">
                        {t('shortcuts_tip_desc', 'Use these shortcuts to manage your presentation with agility. Most shortcuts are contextual and work based on which panel you are currently interacting with.')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ShortcutsSettings;
