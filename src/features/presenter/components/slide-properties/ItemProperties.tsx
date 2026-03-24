import React, { useState, useRef, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { editingCanvasItemIdAtom, textCommandAtom, type TextCommand } from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import {
    Eye, Trash2, Plus, Move, Layers, Palette,
    Wand2, Link2, Unlink, Target, Sun, BoxSelect,
    MoveHorizontal, MoveVertical
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ICanvasItem, IStyleLayer } from '@/core/types';
import { ensureLayers } from '@/core/utils/styleMigration';
import { ScrubbableInput } from './ScrubbableInput';
import { InlineBackgroundPicker } from './InlineBackgroundPicker';
import { AlignmentTools, PropertySection } from './PropertySection';
import { CornerTL, CornerTR, CornerBL, CornerBR } from './helpers';
import { RotationDial } from '@/features/presenter/components/slide-editor/RotationDial';
import { TypographySection } from './TypographySection';

interface IItemPropertiesProps {
    selectedIds: string[];
    canvasItems: ICanvasItem[];
    updateCanvasItems: (ids: string[], updates: Partial<ICanvasItem>) => void;
    isPreview: boolean;
    t: (key: string, fallback?: string) => string;
}

export const ItemProperties: React.FC<IItemPropertiesProps> = ({
    selectedIds, canvasItems, updateCanvasItems, t
}) => {
    const baseItem = canvasItems.find(i => i.id === selectedIds[selectedIds.length - 1]);
    const { previewSlideId, updateCanvasItems: batchUpdateCanvasItems, takeSnapshot } = usePresentationStore();
    const [editingId] = useAtom(editingCanvasItemIdAtom);
    const setTextCommand = useSetAtom(textCommandAtom);

    // Safe fallback if item is deleted but selection hasn't updated yet
    if (!baseItem) return null;

    const getSelectionValue = <T,>(getter: (item: ICanvasItem) => T): T | 'mixed' => {
        if (selectedIds.length <= 1) return getter(baseItem);
        const firstItem = canvasItems.find(i => i.id === selectedIds[0]);
        if (!firstItem) return 'mixed';
        const firstValue = getter(firstItem);
        const allSame = selectedIds.every(id => {
            const item = canvasItems.find(i => i.id === id);
            return item && JSON.stringify(getter(item)) === JSON.stringify(firstValue);
        });
        return allSame ? firstValue : 'mixed';
    };

    const handleAlign = async (type: string) => {
        if (previewSlideId) await takeSnapshot(previewSlideId);
        const updates: Array<{ id: string; updates: Partial<ICanvasItem> }> = [];
        selectedIds.forEach(id => {
            const item = canvasItems.find(i => i.id === id);
            if (!item) return;
            const u: Partial<ICanvasItem> = {};
            switch (type) {
                case 'left': u.x = 0; break; case 'h-center': u.x = 50; break; case 'right': u.x = 100; break;
                case 'top': u.y = 0; break; case 'v-middle': u.y = 50; break; case 'bottom': u.y = 100; break;
            }
            updates.push({ id, updates: u });
        });
        if (updates.length > 0) batchUpdateCanvasItems(previewSlideId!, updates);
    };

    const handleDimensionChange = async (dim: 'width' | 'height', newVal: number) => {
        if (previewSlideId) await takeSnapshot(previewSlideId);
        const updates: Array<{ id: string; updates: Partial<ICanvasItem> }> = [];
        selectedIds.forEach(id => {
            const item = canvasItems.find(i => i.id === id);
            if (!item) return;
            const u: Partial<ICanvasItem> = { [dim]: newVal };
            if (item.lockAspectRatio && item[dim] > 0) {
                const other = dim === 'width' ? 'height' : 'width';
                u[other] = (newVal * item[other]) / item[dim];
            }
            updates.push({ id, updates: u });
        });
        if (updates.length > 0) batchUpdateCanvasItems(previewSlideId!, updates);
    };

    const handlePivotChange = async (newPX?: number, newPY?: number) => {
        if (previewSlideId) await takeSnapshot(previewSlideId);
        const updates: Array<{ id: string; updates: Partial<ICanvasItem> }> = [];
        selectedIds.forEach(id => {
            const item = canvasItems.find(i => i.id === id);
            if (!item) return;
            const px = item.pivotX ?? 50, py = item.pivotY ?? 50;
            const targetPX = newPX !== undefined ? newPX : px;
            const targetPY = newPY !== undefined ? newPY : py;
            const angleRad = ((item.rotation || 0) * Math.PI) / 180;
            const cos = Math.cos(angleRad), sin = Math.sin(angleRad);
            const dpxPct = targetPX - px, dpyPct = targetPY - py;
            const dpxW = (dpxPct / 100) * item.width, dpyW = (dpyPct / 100) * item.height;
            updates.push({ id, updates: { pivotX: targetPX, pivotY: targetPY, x: item.x + dpxW * cos - dpyW * sin, y: item.y + dpxW * sin + dpyW * cos } });
        });
        if (updates.length > 0) batchUpdateCanvasItems(previewSlideId!, updates);
    };

    const handleRadiusChange = async (key: 'borderRadius' | 'borderRadiusTL' | 'borderRadiusTR' | 'borderRadiusBL' | 'borderRadiusBR', value: number) => {
        if (previewSlideId) await takeSnapshot(previewSlideId);
        const updates: Array<{ id: string; updates: Partial<ICanvasItem> }> = [];
        selectedIds.forEach(id => {
            const item = canvasItems.find(i => i.id === id);
            if (!item) return;
            const u: Partial<ICanvasItem> = {};
            if (item.lockBorderRadius !== false) {
                u.borderRadius = value; u.borderRadiusTL = value; u.borderRadiusTR = value; u.borderRadiusBL = value; u.borderRadiusBR = value;
            } else {
                u[key] = value;
                if (key === 'borderRadius') { u.borderRadiusTL = value; u.borderRadiusTR = value; u.borderRadiusBL = value; u.borderRadiusBR = value; }
            }
            updates.push({ id, updates: u });
        });
        if (updates.length > 0) batchUpdateCanvasItems(previewSlideId!, updates);
    };

    return (
        <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
            {/* ═══ Layout Section ═══ */}
            <PropertySection title={t('layout')} icon={Move}>
                <div className="space-y-3">
                    <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                        <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-2 gap-2">
                                <ScrubbableInput label="X" name="X" value={getSelectionValue(i => i.x)} onChange={(v: number) => updateCanvasItems(selectedIds, { x: v })} />
                                <ScrubbableInput label="Y" name="Y" value={getSelectionValue(i => i.y)} onChange={(v: number) => updateCanvasItems(selectedIds, { y: v })} />
                            </div>
                            <div className="grid grid-cols-[1fr_24px_1fr] gap-2 items-center">
                                <ScrubbableInput label="W" name="W" value={getSelectionValue(i => i.width)} onChange={(v: number) => handleDimensionChange('width', v)} />
                                <button onClick={() => updateCanvasItems(selectedIds, { lockAspectRatio: !baseItem.lockAspectRatio })} className={cn("flex items-center justify-center p-1 rounded-md transition-all cursor-pointer hover:bg-white/5", baseItem.lockAspectRatio ? "text-accent" : "text-stone-600")} title={t('lock_aspect_ratio', 'Lock Aspect Ratio')}>
                                    {baseItem.lockAspectRatio ? <Link2 className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
                                </button>
                                <ScrubbableInput label="H" name="H" value={getSelectionValue(i => i.height)} onChange={(v: number) => handleDimensionChange('height', v)} />
                            </div>
                        </div>
                        <RotationDial label={t('angle')} value={getSelectionValue(i => i.rotation || 0)} onChange={(v: number) => updateCanvasItems(selectedIds, { rotation: v })} />
                    </div>
                    <div className="flex flex-col gap-2 p-2 bg-black/20 rounded-xl border border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                            <Target className="w-3 h-3 text-stone-500" />
                            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">{t('pivot_point', 'Pivot Point')}</span>
                        </div>
                        <div className="flex gap-4 items-center">
                            <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-md border border-white/5 w-fit">
                                {[{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 50 }, { x: 50, y: 50 }, { x: 100, y: 50 }, { x: 0, y: 100 }, { x: 50, y: 100 }, { x: 100, y: 100 }].map((p, i) => {
                                    const pv = getSelectionValue(item => ({ x: item.pivotX ?? 50, y: item.pivotY ?? 50 }));
                                    const isActive = pv !== 'mixed' && Math.abs(pv.x - p.x) < 0.1 && Math.abs(pv.y - p.y) < 0.1;
                                    return <button key={i} onClick={() => handlePivotChange(p.x, p.y)} className={cn("w-2.5 h-2.5 transition-all duration-200 cursor-pointer border-[1.5px] rounded-[1px]", isActive ? "bg-accent border-accent/40 shadow-[0_0_8px_var(--color-accent-glow)] scale-110" : "bg-stone-800 border-white/5 hover:border-white/20 hover:bg-stone-700/50")} />;
                                })}
                            </div>
                            <div className="grid grid-cols-2 gap-2 flex-1">
                                <ScrubbableInput label={<MoveHorizontal className="w-2.5 h-2.5 opacity-60" />} name="PX" value={getSelectionValue(item => item.pivotX ?? 50) as number | 'mixed'} onChange={(v: number) => handlePivotChange(v, undefined)} formatter={(v) => `${Math.round(v as number)}% `} />
                                <ScrubbableInput label={<MoveVertical className="w-2.5 h-2.5 opacity-60" />} name="PY" value={getSelectionValue(item => item.pivotY ?? 50) as number | 'mixed'} onChange={(v: number) => handlePivotChange(undefined, v)} formatter={(v) => `${Math.round(v as number)}% `} />
                            </div>
                        </div>
                    </div>
                    <AlignmentTools onAlign={handleAlign} />
                </div>
            </PropertySection>

            {/* ═══ Appearance Section ═══ */}
            <PropertySection title="Appearance" icon={Eye} defaultOpen={false}>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <ScrubbableInput label={<Sun className="w-3.5 h-3.5" />} name="Opacity" value={getSelectionValue(i => i.opacity ?? 1)} onChange={(v: number) => updateCanvasItems(selectedIds, { opacity: v })} step={0.05} min={0} max={1} formatter={(v) => Math.round(v * 100) / 100} />
                        <div className="flex items-center gap-1.5 min-w-0">
                            <ScrubbableInput label={<BoxSelect className="w-3.5 h-3.5" />} name="Radius" value={getSelectionValue(i => i.borderRadius ?? 0)} onChange={(v: number) => handleRadiusChange('borderRadius', v)} min={0} />
                            <button onClick={() => updateCanvasItems(selectedIds, { lockBorderRadius: baseItem.lockBorderRadius === false })} className={cn("flex items-center justify-center p-1 rounded-md transition-all cursor-pointer aspect-square shrink-0", baseItem.lockBorderRadius !== false ? "bg-accent/10 border-accent/30 text-accent font-bold" : "bg-black/40 border-white/5 text-stone-500")} title={baseItem.lockBorderRadius === false ? t('link') : t('unlink')}>
                                {baseItem.lockBorderRadius !== false ? <Link2 className="w-3.5 h-3.5" /> : <Unlink className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </div>
                    {baseItem.lockBorderRadius === false && (
                        <div className="grid grid-cols-4 gap-1.5 bg-black/20 p-2 rounded-xl border border-white/5">
                            <ScrubbableInput label={<CornerTL />} name="RadiusTL" value={getSelectionValue(i => i.borderRadiusTL ?? 0)} onChange={(v: number) => handleRadiusChange('borderRadiusTL', v)} min={0} />
                            <ScrubbableInput label={<CornerTR />} name="RadiusTR" value={getSelectionValue(i => i.borderRadiusTR ?? 0)} onChange={(v: number) => handleRadiusChange('borderRadiusTR', v)} min={0} />
                            <ScrubbableInput label={<CornerBL />} name="RadiusBL" value={getSelectionValue(i => i.borderRadiusBL ?? 0)} onChange={(v: number) => handleRadiusChange('borderRadiusBL', v)} min={0} />
                            <ScrubbableInput label={<CornerBR />} name="RadiusBR" value={getSelectionValue(i => i.borderRadiusBR ?? 0)} onChange={(v: number) => handleRadiusChange('borderRadiusBR', v)} min={0} />
                        </div>
                    )}
                    <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center gap-1.5 bg-black/40 px-3 py-2 rounded-xl border border-white/5 flex-1 select-none">
                            <Layers className="w-3 h-3 text-stone-500" />
                            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">{baseItem.zIndex + 1}</span>
                        </div>
                    </div>
                </div>
            </PropertySection>

            {/* ═══ Effects Section ═══ */}
            <PropertySection title="Effects" icon={Wand2} defaultOpen={false}>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-1 mb-1 group">
                            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">Drop Shadow</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {baseItem.dropShadow ? (
                                    <button onClick={() => updateCanvasItems(selectedIds, { dropShadow: undefined })} className="p-1 hover:bg-red-500/20 text-stone-500 hover:text-red-400 rounded-lg cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                                ) : (
                                    <button onClick={() => updateCanvasItems(selectedIds, { dropShadow: { x: 0, y: 10, blur: 20, color: 'rgba(0,0,0,0.5)' } })} className="p-1 hover:bg-white/10 rounded-lg text-stone-500 hover:text-stone-300 cursor-pointer"><Plus className="w-3 h-3" /></button>
                                )}
                            </div>
                        </div>
                        {baseItem.dropShadow && (
                            <div className="grid grid-cols-2 gap-2 p-2 bg-black/20 rounded-xl border border-white/5">
                                <ScrubbableInput label="X" name="ShadowX" value={getSelectionValue(i => i.dropShadow?.x ?? 0)} onChange={(v: number) => updateCanvasItems(selectedIds, { dropShadow: { ...baseItem.dropShadow!, x: v } })} />
                                <ScrubbableInput label="Y" name="ShadowY" value={getSelectionValue(i => i.dropShadow?.y ?? 10)} onChange={(v: number) => updateCanvasItems(selectedIds, { dropShadow: { ...baseItem.dropShadow!, y: v } })} />
                                <div className="col-span-2"><ScrubbableInput label="Blur" name="ShadowBlur" value={getSelectionValue(i => i.dropShadow?.blur ?? 20)} min={0} onChange={(v: number) => updateCanvasItems(selectedIds, { dropShadow: { ...baseItem.dropShadow!, blur: v } })} /></div>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-1 mb-1 group">
                            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">Background Blur</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {baseItem.backdropBlur !== undefined ? (
                                    <button onClick={() => updateCanvasItems(selectedIds, { backdropBlur: undefined })} className="p-1 hover:bg-red-500/20 text-stone-500 hover:text-red-400 rounded-lg cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                                ) : (
                                    <button onClick={() => updateCanvasItems(selectedIds, { backdropBlur: 20 })} className="p-1 hover:bg-white/10 rounded-lg text-stone-500 hover:text-stone-300 cursor-pointer"><Plus className="w-3 h-3" /></button>
                                )}
                            </div>
                        </div>
                        {baseItem.backdropBlur !== undefined && (
                            <div className="p-2 bg-black/20 rounded-xl border border-white/5">
                                <ScrubbableInput label="Blur" name="BackdropBlur" value={getSelectionValue(i => i.backdropBlur ?? 0)} min={0} onChange={(v: number) => updateCanvasItems(selectedIds, { backdropBlur: v })} />
                            </div>
                        )}
                    </div>
                </div>
            </PropertySection>

            {/* ═══ Style Section ═══ */}
            <PropertySection title={t('style')} icon={Palette}>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-1 mb-1">
                            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">Fill</span>
                            <button onClick={() => {
                                const newLayer: IStyleLayer = { id: crypto.randomUUID(), type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#1c1917', adjustments: { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, hue: 0, blur: 0 } };
                                selectedIds.forEach(id => {
                                    const item = canvasItems.find(i => i.id === id);
                                    if (!item) return;
                                    const currentFills = ensureLayers(item.type === 'text' ? item.text?.textFills : item.fills);
                                    if (item.type === 'text') { updateCanvasItems([id], { text: { ...item.text!, textFills: [...currentFills, newLayer], color: item.text?.color || '#ffffff' } }); }
                                    else { updateCanvasItems([id], { fills: [...currentFills, newLayer] }); }
                                });
                            }} onMouseDown={(e) => e.preventDefault()} className="p-1 hover:bg-white/10 rounded active:bg-white/20 cursor-pointer">
                                <Plus className="w-3 h-3 text-stone-500 hover:text-stone-300 transition-colors" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            {getSelectionValue(i => i.type) === 'text' ? (
                                <>
                                    <InlineBackgroundPicker value={baseItem.text?.textFills || []} onChange={(v) => {
                                        if (v && v.length === 0) {
                                            updateCanvasItems(selectedIds, { text: { ...baseItem.text!, textFills: [], color: '#ffffff' } });
                                            return;
                                        }
                                        if (editingId && selectedIds.includes(editingId) && v?.[0]?.type === 'color') {
                                            setTextCommand({ command: 'foreColor', value: v[0].color, timestamp: Date.now() });
                                        }
                                        updateCanvasItems(selectedIds, {
                                            text: {
                                                ...baseItem.text!,
                                                textFills: v || [],
                                                color: v?.[0]?.type === 'color' ? v[0].color : baseItem.text?.color || '#ffffff'
                                            }
                                        });
                                    }} />
                                    <InlineBackgroundPicker value={baseItem.fills || []} onChange={(v) => updateCanvasItems(selectedIds, { fills: v || [] })} onRemove={() => updateCanvasItems(selectedIds, { fills: [] })} />
                                </>
                            ) : (
                                <InlineBackgroundPicker value={baseItem.fills} onChange={(v) => updateCanvasItems(selectedIds, { fills: v || [] })} onRemove={() => updateCanvasItems(selectedIds, { fills: [] })} />
                            )}
                        </div>
                    </div>
                    <div className="h-px bg-white/5 mx-[-12px]" />
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">Stroke</span>
                            <button onClick={() => {
                                const newLayer: IStyleLayer = { id: crypto.randomUUID(), type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#ffffff', adjustments: { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, hue: 0, blur: 0 } };
                                updateCanvasItems(selectedIds, { strokes: [newLayer], borderWidth: 2 });
                            }} onMouseDown={(e) => e.preventDefault()} className="p-1 hover:bg-white/10 rounded active:bg-white/20 cursor-pointer">
                                <Plus className="w-3 h-3 text-stone-500 hover:text-stone-300 transition-colors" />
                            </button>
                        </div>
                        <div className="grid grid-cols-[60px_1fr] gap-2 items-start">
                            <ScrubbableInput label="W" name="BorderWidth" value={getSelectionValue(i => i.borderWidth ?? 0)} onChange={(v: number) => updateCanvasItems(selectedIds, { borderWidth: v })} min={0} className="h-8" onMouseDown={(e: React.MouseEvent) => e.preventDefault()} />
                            <InlineBackgroundPicker value={baseItem.strokes} onChange={(v) => updateCanvasItems(selectedIds, { strokes: v || [] })} onRemove={() => updateCanvasItems(selectedIds, { borderWidth: 0, strokes: [] })} />
                        </div>
                        <div className="space-y-1.5 mt-1">
                            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-0.5">
                                {(['inside', 'center', 'outside'] as const).map((align) => (
                                    <button key={align} onClick={() => updateCanvasItems(selectedIds, { strokeAlign: align })} onMouseDown={(e) => e.preventDefault()} className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer", getSelectionValue(i => i.strokeAlign || 'center') === align ? "bg-accent/10 text-accent shadow-[0_0_10px_rgba(234,179,8,0.1)] border border-accent/20" : "text-stone-500 hover:bg-white/2 hover:text-stone-300 border border-transparent")}>
                                        {t(`stroke_${align}`)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </PropertySection>

            {/* ═══ Typography Section (text items only) ═══ */}
            {getSelectionValue(i => i.type) === 'text' && (
                <TypographySection selectedIds={selectedIds} canvasItems={canvasItems} updateCanvasItems={updateCanvasItems} t={t} />
            )}
        </div>
    );
};
