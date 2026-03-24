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
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">{t('underline_style', 'Underline Style')}</span>
                            <div className="flex bg-black/40 p-1 rounded-lg border border-white/5 gap-0.5 min-w-[100px]">
                                {(['straight', 'wavy'] as const).map((val) => (
                                    <button
                                        key={val}
                                        onClick={() => {
                                            if (editingId && selectedIds.includes(editingId)) {
                                                setTextCommand({ command: 'underlineStyle', value: val, timestamp: Date.now() });
                                            }
                                            updateCanvasItems(selectedIds, { text: { ...txt, underlineStyle: val as never } });
                                        }}
                                        onMouseDown={(e) => e.preventDefault()}
                                        className={cn(
                                            "flex-1 py-1 rounded-[4px] text-[8px] font-bold transition-all uppercase tracking-tight cursor-pointer",
                                            (txt.underlineStyle || 'straight') === val ? "bg-accent text-white" : "text-stone-500 hover:text-stone-300"
                                        )}
                                        title={val}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">{t('skip_ink', 'Skip Ink')}</span>
                                <p className="text-[8px] text-stone-600 leading-tight max-w-[140px]">{t('skip_ink_desc', 'Skips underline under descenders (g, p, y)')}</p>
                            </div>
                            <button
                                onClick={() => {
                                    const next = txt.underlineSkipInk === 'none' ? 'ink' : 'none';
                                    updateCanvasItems(selectedIds, { text: { ...txt, underlineSkipInk: next } });
                                }}
                                onMouseDown={(e) => e.preventDefault()}
                                className={cn(
                                    "w-7 h-4 rounded-full transition-colors relative shrink-0 cursor-pointer",
                                    txt.underlineSkipInk === 'none' ? "bg-stone-700" : "bg-accent"
                                )}
                            >
                                <div className={cn("absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform", txt.underlineSkipInk !== 'none' && "translate-x-3")} />
                            </button>
                        </div>
                    </div>
                </div>
            </FloatingPopover>
        </>
    );
};
