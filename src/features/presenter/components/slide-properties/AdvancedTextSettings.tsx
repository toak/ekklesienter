import React, { useState, useRef } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { MoreHorizontal, Minus, List, ListOrdered } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ICanvasItem } from '@/core/types';
import { editingCanvasItemIdAtom, textCommandAtom } from '@/core/store/uiAtoms';
import { FloatingPopover } from '@/components/FloatingPopover';

interface IAdvancedTextSettingsProps {
    selectedIds: string[];
    canvasItems: ICanvasItem[];
    updateCanvasItems: (ids: string[], updates: Partial<ICanvasItem>) => void;
    t: (key: string, fallback?: string) => string;
}

/**
 * Advanced text formatting popover for lists, text casing, and underline styles.
 */
export const AdvancedTextSettings: React.FC<IAdvancedTextSettingsProps> = ({
    selectedIds, canvasItems, updateCanvasItems, t
}) => {
    const [editingId] = useAtom(editingCanvasItemIdAtom);
    const setTextCommand = useSetAtom(textCommandAtom);
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const baseItem = canvasItems.find(i => i.id === (selectedIds[0] || ''));
    if (!baseItem || !baseItem.text) return null;
    const txt = baseItem.text;

    return (
        <>
            <button
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                onMouseDown={(e) => e.preventDefault()}
                className={cn(
                    "p-2 rounded-lg transition-all ml-auto cursor-pointer",
                    isOpen ? "bg-accent/20 text-accent" : "text-stone-500 hover:text-stone-300 hover:bg-white/5 active:bg-white/10"
                )}
                title={t('advanced_settings', 'Advanced Settings')}
            >
                <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            <FloatingPopover
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                anchorRef={triggerRef}
                title={t('advanced_text', 'Advanced Text')}
                width={260}
            >
                <div className="space-y-4 p-1">
                    <div className="space-y-2">
                        <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">{t('list', 'List')}</span>
                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-0.5">
                            {(['none', 'disc', 'decimal'] as const).map((l) => (
                                <button
                                    key={l}
                                    onClick={() => {
                                        if (editingId && selectedIds.includes(editingId)) {
                                            setTextCommand({ command: 'listType', value: l, timestamp: Date.now() });
                                        }
                                        updateCanvasItems(selectedIds, { text: { ...txt, listType: l } });
                                    }}
                                    onMouseDown={(e) => e.preventDefault()}
                                    className={cn(
                                        "flex-1 py-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer",
                                        (txt.listType || 'none') === l ? "bg-accent/10 text-accent" : "text-stone-500 hover:text-stone-300"
                                    )}
                                    title={l}
                                >
                                    {l === 'none' ? <Minus className="w-3.5 h-3.5" /> : l === 'disc' ? <List className="w-3.5 h-3.5" /> : <ListOrdered className="w-3.5 h-3.5" />}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">{t('case', 'Case')}</span>
                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-0.5">
                            {([{ val: 'none', label: '---' }, { val: 'uppercase', label: 'UPPER' }, { val: 'lowercase', label: 'lower' }, { val: 'titlecase', label: 'Title' }] as const).map(({ val, label }) => (
                                <button
                                    key={val}
                                    onClick={() => {
                                        if (editingId && selectedIds.includes(editingId)) {
                                            setTextCommand({ command: 'textCase', value: val, timestamp: Date.now() });
                                        }
                                        updateCanvasItems(selectedIds, { text: { ...txt, textCase: val as never } });
                                    }}
                                    onMouseDown={(e) => e.preventDefault()}
                                    className={cn(
                                        "flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer",
                                        (txt.textCase || 'none') === val ? "bg-accent/10 text-accent" : "text-stone-500 hover:text-stone-300"
                                    )}
                                    title={val}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </FloatingPopover>
        </>
    );
};
