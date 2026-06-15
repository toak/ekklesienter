import React, { useState, useRef, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import {
    Type, Bold, Italic, Underline, Strikethrough,
    AlignLeft as AlignLeftIcon, AlignCenter as AlignCenterIcon, AlignRight, AlignRight as AlignRightIcon, AlignJustify,
    AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
    ChevronDown, MoveHorizontal, MoveVertical, BoxSelect
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ICanvasItem } from '@/core/types';
import { editingCanvasItemIdAtom, textCommandAtom, fontPreviewFamilyAtom, type TextCommand } from '@/core/store/uiAtoms';
import { stripInlineStyles } from '@/core/utils/stripInlineStyles';
import { getSystemFontData, normalizeFontStyle, getWeightName, findBestMatchStyle } from '@/core/services/fontService';
import { AVAILABLE_FONTS } from '@/core/data/fonts';
import { FontLibrary } from '../fonts/FontLibrary';
import { FontWeightPicker } from '../fonts/FontWeightPicker';
import { FloatingPopover } from '@/components/FloatingPopover';
import { ScrubbableInput } from '../slide-properties/ScrubbableInput';
import { PropertySection } from '../slide-properties/PropertySection';
import { AdvancedTextSettings } from '../slide-properties/AdvancedTextSettings';
import { normalizeHtml } from '@/features/presenter/utils/normalizeContentEditableHtml';
import { CanvasService } from '@/features/presenter/services/CanvasService';

interface ITypographySectionProps {
    selectedIds: string[];
    canvasItems: ICanvasItem[];
    updateCanvasItems: (ids: string[], updates: Partial<ICanvasItem>) => void;
    onBatchUpdate: (updates: Array<{ id: string; updates: Partial<ICanvasItem> }>) => void;
    isPreview: boolean;
    t: (key: string, fallback?: string) => string;
}

export const TypographySection: React.FC<ITypographySectionProps> = ({
    selectedIds,
    canvasItems,
    updateCanvasItems,
    onBatchUpdate,
    isPreview,
    t
}) => {
    const baseItem = canvasItems.find(i => i.id === selectedIds[selectedIds.length - 1])!;
    const [editingId] = useAtom(editingCanvasItemIdAtom);
    const setTextCommand = useSetAtom(textCommandAtom);
    const setFontPreview = useSetAtom(fontPreviewFamilyAtom);

    const [isFontPopoverOpen, setIsFontPopoverOpen] = useState(false);
    const [isWeightPopoverOpen, setIsWeightPopoverOpen] = useState(false);
    const fontAnchorRef = useRef<HTMLButtonElement>(null);
    const weightAnchorRef = useRef<HTMLButtonElement>(null);

    const getSelectionValue = <T,>(getter: (item: ICanvasItem) => T): T | 'mixed' => 
        CanvasService.getSelectionState(selectedIds, canvasItems, getter);

    const [availableStyles, setAvailableStyles] = useState<{ name: string; value: string }[]>([]);
    const currentFamily = getSelectionValue(i => i.text?.fontFamily || 'Inter') as string;

    useEffect(() => {
        const fetchStyles = async () => {
            const isBundled = AVAILABLE_FONTS.some(f => f.name === currentFamily);
            if (isBundled) {
                const def = AVAILABLE_FONTS.find(f => f.name === currentFamily);
                setAvailableStyles(def?.weights || []);
            } else {
                const allData = await getSystemFontData();
                const familyData = allData.filter(f => f.family === currentFamily);
                if (familyData.length > 0) {
                    const styles = familyData.map(f => ({ name: getWeightName(f.style, t), value: f.style }));
                    const seen = new Set();
                    setAvailableStyles(styles.filter(s => !seen.has(s.value) && seen.add(s.value)));
                } else { setAvailableStyles([]); }
            }
        };
        fetchStyles();
    }, [currentFamily]);

    const applyTextFormat = (command: TextCommand['command'], updateFn: (item: ICanvasItem) => Partial<ICanvasItem>) => {
        if (editingId && selectedIds.includes(editingId)) {
            setTextCommand({ command, timestamp: Date.now() });
        } else {
            selectedIds.forEach(id => {
                const item = canvasItems.find(i => i.id === id);
                if (item?.text?.content) updateCanvasItems([id], updateFn(item));
            });
        }
    };

    return (
        <PropertySection title={t('typography')} icon={Type}>
            <div className="space-y-4">
                <div className="flex flex-col gap-2 bg-black/20 p-3 rounded-xl border border-white/5 select-none hover:bg-black/30 transition-colors group">
                    <button
                        type="button"
                        ref={fontAnchorRef}
                        onClick={() => setIsFontPopoverOpen(true)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="w-full flex items-center justify-between opacity-50 group-hover:opacity-100 transition-opacity cursor-pointer bg-transparent border-0 p-0 font-normal text-left outline-hidden"
                    >
                        <span className="text-[9px] text-stone-500 font-black uppercase tracking-[0.2em]">{getSelectionValue(i => i.text?.fontFamily || 'Inter')}</span>
                        <ChevronDown className="w-3 h-3 text-stone-600" />
                    </button>
                    <FloatingPopover isOpen={isFontPopoverOpen} onClose={() => setIsFontPopoverOpen(false)} anchorRef={fontAnchorRef} title={t('font_library')} width={280}>
                        <FontLibrary value={getSelectionValue(i => i.text?.fontFamily || 'Inter') as string} onSelect={(family) => {
                            if (editingId && selectedIds.includes(editingId)) {
                                setTextCommand({ command: 'fontName', value: family, timestamp: Date.now() });
                            } else {
                                selectedIds.forEach(id => {
                                    const item = canvasItems.find(i => i.id === id);
                                    if (item?.text?.content) {
                                        const cleaned = stripInlineStyles(item.text.content, ['fontFamily']);
                                        updateCanvasItems([id], { text: { content: cleaned, fontFamily: family, fontWeight: '400', isBold: false } } as never);
                                    }
                                });
                            }
                            // Clear preview on select
                            setFontPreview(null);
                            setIsFontPopoverOpen(false);
                        }} showTitle={false} />
                    </FloatingPopover>
                    <div className="h-px bg-white/5" />
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            ref={weightAnchorRef}
                            onClick={() => setIsWeightPopoverOpen(true)}
                            onMouseDown={(e) => e.preventDefault()}
                            className="flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0 font-normal text-left outline-hidden"
                        >
                            <span className="text-[10px] text-stone-300 font-bold tracking-tight">{getWeightName(getSelectionValue(i => i.text?.fontWeight || '400') as string, t)}</span>
                            <ChevronDown className="w-2.5 h-2.5 text-stone-600" />
                        </button>
                        <FloatingPopover isOpen={isWeightPopoverOpen} onClose={() => setIsWeightPopoverOpen(false)} anchorRef={weightAnchorRef} title={t('font_weight')} width={200}>
                            <FontWeightPicker family={getSelectionValue(i => i.text?.fontFamily || 'Inter') as string} value={getSelectionValue(i => i.text?.fontWeight || 'Bold') as string} onSelect={(weight) => {
                                const parsed = normalizeFontStyle(weight);
                                if (editingId && selectedIds.includes(editingId)) { setTextCommand({ command: 'fontWeight', value: weight, timestamp: Date.now() }); }
                                else { selectedIds.forEach(id => { const item = canvasItems.find(i => i.id === id); if (item?.text?.content) { const cleaned = stripInlineStyles(item.text.content, ['fontWeight']); updateCanvasItems([id], { text: { content: cleaned, fontWeight: weight, isBold: parseInt(parsed.weight) >= 600, isItalic: parsed.isItalic } } as never); } }); }
                                setIsWeightPopoverOpen(false);
                            }} />
                        </FloatingPopover>
                    </div>
                    <div className="flex flex-col gap-2 bg-black/40 p-2 rounded-xl border border-white/5">
                        <div className="flex items-center gap-1">
                            {[{ cmd: 'bold' as const, icon: Bold, getter: (i: ICanvasItem) => i.text?.isBold || normalizeFontStyle(i.text?.fontWeight as string || '400').weight === '700' },
                            { cmd: 'italic' as const, icon: Italic, getter: (i: ICanvasItem) => i.text?.isItalic || false },
                            { cmd: 'underline' as const, icon: Underline, getter: (i: ICanvasItem) => i.text?.isUnderline || false },
                            { cmd: 'strikethrough' as const, icon: Strikethrough, getter: (i: ICanvasItem) => i.text?.isStrikethrough || false }].map(({ cmd, icon: Icon, getter }) => (
                                <button key={cmd} onClick={() => applyTextFormat(cmd, (item) => {
                                    const cleaned = stripInlineStyles(item.text!.content, [cmd === 'bold' ? 'fontWeight' : cmd === 'italic' ? 'fontStyle' : 'textDecoration']);
                                    if (cmd === 'bold') { const cur = getter(item) === true; const best = findBestMatchStyle(availableStyles, { bold: !cur, italic: (getSelectionValue(i => i.text?.isItalic || false) === true) }); return { text: { content: cleaned, isBold: !cur, fontWeight: best?.value || (!cur ? '700' : '400') } } as never; }
                                    if (cmd === 'italic') { const cur = getter(item) === true; const best = findBestMatchStyle(availableStyles, { bold: (getSelectionValue(i => i.text?.isBold || false) === true), italic: !cur }); return { text: { content: cleaned, isItalic: !cur, fontWeight: best?.value || ((getSelectionValue(i => i.text?.isBold || false) === true) ? '700' : '400') } } as never; }
                                    return { text: { content: cleaned, [`is${cmd.charAt(0).toUpperCase() + cmd.slice(1)}`]: !(getter(item) === true) } } as never;
                                })} onMouseDown={(e) => e.preventDefault()} className={cn("flex-1 py-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer hover:bg-white/5", getSelectionValue(getter) === true ? "bg-accent/10 text-accent shadow-[0_0_10px_rgba(234,179,8,0.1)] border border-accent/20" : "text-stone-500")} title={t(cmd)}>
                                    <Icon className="w-3.5 h-3.5" />
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1 border-t border-white/5 pt-2 mt-1">
                            <div className="flex-1 flex gap-0.5 bg-black/20 p-0.5 rounded-lg">
                                {([{ val: 'none', label: 'Aa' }, { val: 'uppercase', label: 'AA' }, { val: 'lowercase', label: 'aa' }, { val: 'titlecase', label: 'Aa' }] as const).map(({ val, label }) => (
                                    <button key={val} onClick={() => { if (editingId && selectedIds.includes(editingId)) setTextCommand({ command: 'textCase', value: val, timestamp: Date.now() }); else selectedIds.forEach(id => { const item = canvasItems.find(i => i.id === id); if (item?.text?.content) { const cleaned = stripInlineStyles(item.text.content, ['textTransform']); updateCanvasItems([id], { text: { content: cleaned, textCase: val as never } } as never); } }); }} onMouseDown={(e) => e.preventDefault()} className={cn("flex-1 py-1 rounded-md text-[8px] font-bold transition-all cursor-pointer", getSelectionValue(i => i.text?.textCase || 'none') === val ? "bg-accent/10 text-accent" : "text-stone-600 hover:text-stone-400")} title={t(val)}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <AdvancedTextSettings selectedIds={selectedIds} canvasItems={canvasItems} updateCanvasItems={updateCanvasItems} t={t} />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <ScrubbableInput label={t('font_size')} name="FontSize" value={getSelectionValue(i => i.text?.fontSize || 32) as number | 'mixed'} onChange={(v) => { if (editingId && selectedIds.includes(editingId)) setTextCommand({ command: 'fontSize', value: `${v}px`, timestamp: Date.now() }); else selectedIds.forEach(id => { const item = canvasItems.find(i => i.id === id); if (item?.text?.content) { const cleaned = stripInlineStyles(item.text.content, ['fontSize']); updateCanvasItems([id], { text: { content: cleaned, fontSize: v } } as never); } }); }} min={8} max={500} onMouseDown={(e: React.MouseEvent) => e.preventDefault()} />
                    <ScrubbableInput label={t('line_height')} name="LineHeight" value={getSelectionValue(i => typeof i.text?.lineHeight === 'number' ? i.text.lineHeight : parseFloat(i.text?.lineHeight as string) || 1.3) as number | 'mixed'} onChange={(v) => { if (editingId && selectedIds.includes(editingId)) setTextCommand({ command: 'lineHeight', value: `${v}`, timestamp: Date.now() }); updateCanvasItems(selectedIds, { text: { lineHeight: v } } as never); }} step={0.1} min={0.5} max={5} onMouseDown={(e: React.MouseEvent) => e.preventDefault()} />
                    <ScrubbableInput label={t('letter_spacing')} name="LetterSpacing" value={getSelectionValue(i => typeof i.text?.letterSpacing === 'number' ? i.text.letterSpacing : parseFloat(i.text?.letterSpacing as string) || 0) as number | 'mixed'} onChange={(v) => { if (editingId && selectedIds.includes(editingId)) setTextCommand({ command: 'letterSpacing', value: `${v}px`, timestamp: Date.now() }); updateCanvasItems(selectedIds, { text: { letterSpacing: v } } as never); }} step={0.5} min={-10} max={50} onMouseDown={(e: React.MouseEvent) => e.preventDefault()} />
                    <ScrubbableInput label={t('paragraph_spacing')} name="ParagraphSpacing" value={getSelectionValue(i => i.text?.paragraphSpacing || 0) as number | 'mixed'} onChange={(v) => { if (editingId && selectedIds.includes(editingId)) setTextCommand({ command: 'paragraphSpacing', value: `${v}px`, timestamp: Date.now() }); updateCanvasItems(selectedIds, { text: { paragraphSpacing: v } } as never); }} min={0} max={100} onMouseDown={(e: React.MouseEvent) => e.preventDefault()} />
                </div>
                <div className="h-px bg-white/5 mx-[-12px]" />
                <div className="space-y-2">
                    <span className="text-[9px] font-bold text-stone-600 uppercase tracking-widest px-1">{t('alignment')}</span>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-0.5">
                            {(['left', 'center', 'right', 'justify'] as const).map((align) => (
                                <button key={align} onClick={() => updateCanvasItems(selectedIds, { text: { alignHorizontal: align as never } } as never)} onMouseDown={(e) => e.preventDefault()} className={cn("flex-1 py-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer", getSelectionValue(i => i.text?.alignHorizontal || 'center') === align ? "bg-accent/10 text-accent shadow-[0_0_10px_rgba(234,179,8,0.1)] border border-accent/20" : "text-stone-500 hover:bg-white/2 hover:text-stone-300 border border-transparent")}>
                                    {align === 'left' && <AlignLeftIcon className="w-3.5 h-3.5" />}
                                    {align === 'center' && <AlignCenterIcon className="w-3.5 h-3.5" />}
                                    {align === 'right' && <AlignRightIcon className="w-3.5 h-3.5" />}
                                    {align === 'justify' && <AlignJustify className="w-3.5 h-3.5" />}
                                </button>
                            ))}
                        </div>
                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-0.5">
                            {(['top', 'middle', 'bottom'] as const).map((align) => (
                                <button key={align} onClick={() => updateCanvasItems(selectedIds, { text: { alignVertical: align as never } } as never)} onMouseDown={(e) => e.preventDefault()} className={cn("flex-1 py-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer", getSelectionValue(i => i.text?.alignVertical || 'middle') === align ? "bg-accent/10 text-accent shadow-[0_0_10px_rgba(234,179,8,0.1)] border border-accent/20" : "text-stone-500 hover:bg-white/2 hover:text-stone-300 border border-transparent")}>
                                    {align === 'top' && <AlignVerticalJustifyStart className="w-3.5 h-3.5" />}
                                    {align === 'middle' && <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />}
                                    {align === 'bottom' && <AlignVerticalJustifyEnd className="w-3.5 h-3.5" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <span className="text-[9px] font-bold text-stone-600 uppercase tracking-widest px-1">{t('behavior')}</span>
                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-0.5">
                        {([{ mode: 'auto-width', icon: MoveHorizontal, short: t('auto_width') }, { mode: 'auto-height', icon: MoveVertical, short: t('auto_height') }, { mode: 'fixed', icon: BoxSelect, short: t('fixed_size') }] as const).map(({ mode, icon: Icon, short }) => (
                            <button key={mode} onClick={() => updateCanvasItems(selectedIds, { text: { resizingMode: mode } } as never)} onMouseDown={(e) => e.preventDefault()} className={cn("flex-1 py-1.5 rounded-lg flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group/mode", getSelectionValue(i => i.text?.resizingMode || 'auto-height') === mode ? "bg-accent/10 text-accent border border-accent/20" : "text-stone-500 hover:bg-white/2 hover:text-stone-300 border border-transparent")} title={short}>
                                <Icon className="w-3.5 h-3.5" />
                                <span className="text-[7px] font-black uppercase tracking-tighter text-center leading-tight hidden group-hover/mode:block">{short}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </PropertySection>
    );
};
