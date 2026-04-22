import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  selectedCanvasItemIdsAtom,
  canvasToolAtom,
  slideEditorDragActiveAtom,
  slidePreviewHoveredAtom,
  canvasZoomAtom,
  slideDesignPanelOpenAtom,
  canvasOffsetAtom,
  editorToolbarVisibleAtom,
} from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { cn } from '@/core/utils/cn';
import {
  MousePointer2, Hand, Type, ImageIcon, Video,
  Square, Minus, Circle, Triangle, Star, Hexagon as Diamond,
  ChevronDown, ChevronUp, Trash2, Copy, Clipboard, ZoomIn, ZoomOut,
  PanelBottomClose, PanelBottomOpen,
} from 'lucide-react';
import { createCanvasItem, SHAPE_OPTIONS } from '../slide-properties/helpers';
import { ICanvasItem, ICanvasSlide } from '@/core/types';

// ─── Tooltip ───────────────────────────────────────────────────────────────
const Tooltip: React.FC<{ label: string; shortcut?: string; children: React.ReactNode }> = ({
  label, shortcut, children
}) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => { timerRef.current = setTimeout(() => setVisible(true), 500); };
  const hide = () => { clearTimeout(timerRef.current); setVisible(false); };

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {visible && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center gap-2 bg-stone-950/90 backdrop-blur-md border border-white/10 rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
            <span className="text-[11px] font-medium text-stone-200">{label}</span>
            {shortcut && (
              <span className="text-[10px] font-mono text-stone-500 bg-white/5 px-1.5 py-0.5 rounded-md border border-white/10">
                {shortcut}
              </span>
            )}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-stone-900/90" />
        </div>
      )}
    </div>
  );
};

// ─── Divider ───────────────────────────────────────────────────────────────
const Divider: React.FC = () => (
  <div className="w-px h-5 bg-white/10 shrink-0 mx-1" />
);

// ─── Tool Button ───────────────────────────────────────────────────────────
interface IToolButtonProps {
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}

const ToolButton: React.FC<IToolButtonProps> = ({
  icon: Icon, label, shortcut, active, disabled, danger, onClick
}) => (
  <Tooltip label={label} shortcut={shortcut}>
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 shrink-0 cursor-pointer",
        "disabled:opacity-20 disabled:pointer-events-none",
        active
          ? "bg-accent/20 text-accent ring-1 ring-accent/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
          : danger
            ? "text-stone-500 hover:text-red-400 hover:bg-red-500/10 active:scale-90"
            : "text-stone-400 hover:text-stone-100 hover:bg-white/5 active:scale-90"
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  </Tooltip>
);

// ─── Shapes Dropdown ───────────────────────────────────────────────────────
const SHAPES = [
  { type: 'rect', icon: Square, label: 'Rectangle', shortcut: 'R' },
  { type: 'circle', icon: Circle, label: 'Circle', shortcut: 'O' },
  { type: 'triangle', icon: Triangle, label: 'Triangle' },
  { type: 'star', icon: Star, label: 'Star' },
  { type: 'diamond', icon: Diamond, label: 'Diamond' },
];

const ShapesDropdown: React.FC<{ onSelect: (type: string) => void }> = ({ onSelect }) => {
  const [open, setOpen] = useState(false);
  const [activeShape, setActiveShape] = useState(SHAPES[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (shape: typeof SHAPES[0]) => {
    setActiveShape(shape);
    onSelect(shape.type);
    setOpen(false);
  };

  const Icon = activeShape.icon;

  return (
    <div ref={ref} className="relative flex items-center shrink-0">
      <Tooltip label={activeShape.label} shortcut={activeShape.shortcut}>
        <button
          onClick={() => onSelect(activeShape.type)}
          className="flex items-center justify-center w-9 h-9 rounded-l-xl text-stone-400 hover:text-stone-100 hover:bg-white/5 transition-all active:scale-90 cursor-pointer"
        >
          <Icon className="w-4 h-4" />
        </button>
      </Tooltip>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center justify-center w-4 h-9 rounded-r-xl text-stone-500 hover:text-stone-300 hover:bg-white/5 transition-all cursor-pointer -ml-0.5",
          open && "bg-white/5 text-stone-200"
        )}
      >
        <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-3 left-0 z-50 animate-in fade-in zoom-in-95 duration-200 origin-bottom-left">
          <div className="bg-stone-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl flex flex-col gap-1 min-w-[160px]">
            {SHAPES.map(shape => {
              const ShapeIcon = shape.icon;
              const isActive = activeShape.type === shape.type;
              return (
                <button
                  key={shape.type}
                  onClick={() => handleSelect(shape)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group",
                    isActive
                      ? "bg-accent/15 text-accent"
                      : "text-stone-400 hover:text-stone-100 hover:bg-white/5"
                  )}
                >
                  <ShapeIcon className={cn("w-4 h-4 shrink-0 transition-transform group-hover:scale-110", isActive && "scale-110")} />
                  <span className="text-xs font-semibold flex-1">{shape.label}</span>
                  {shape.shortcut && (
                    <span className="text-[10px] font-mono text-stone-600 group-hover:text-stone-400">{shape.shortcut}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Toolbar ──────────────────────────────────────────────────────────
export const SlideEditorToolbar: React.FC = () => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useAtom(selectedCanvasItemIdsAtom);
  const [canvasTool, setCanvasTool] = useAtom(canvasToolAtom);
  const [zoom, setZoom] = useAtom(canvasZoomAtom);
  const setOffset = useSetAtom(canvasOffsetAtom);
  const isHovered = useAtomValue(slidePreviewHoveredAtom);
  const designPanelOpen = useAtomValue(slideDesignPanelOpenAtom);

  const {
    previewSlideId,
    addCanvasItem,
    removeCanvasItem,
    takeSnapshot,
    activePresentation,
    selectedPresentation,
  } = usePresentationStore();

  const presentation = selectedPresentation || activePresentation;
  const hasSelection = selectedIds.length > 0;

  // ─── Clipboard state ───
  const [clipboard, setClipboard] = useState<ICanvasItem[]>([]);
  const canPaste = clipboard.length > 0;

  const onZoomFit = useCallback(() => {
    setZoom(1.0);
    setOffset({ x: 0, y: 0 });
  }, [setZoom, setOffset]);

  const addElement = useCallback((type: string, shapeType?: string) => {
    if (!previewSlideId) return;
    const item = createCanvasItem(type as any);
    if (shapeType && item.shape) item.shape.shapeType = shapeType as any;
    // Center on slide (percentage)
    item.x = 50;
    item.y = 50;
    addCanvasItem(previewSlideId, item);
    setSelectedIds([item.id]);
  }, [previewSlideId, addCanvasItem, setSelectedIds]);

  const deleteSelected = useCallback(async () => {
    if (!previewSlideId || !hasSelection) return;
    await takeSnapshot(previewSlideId);
    selectedIds.forEach(id => removeCanvasItem(previewSlideId, id));
    setSelectedIds([]);
  }, [previewSlideId, hasSelection, selectedIds, removeCanvasItem, setSelectedIds, takeSnapshot]);

  const copySelected = useCallback(() => {
    if (!hasSelection) return;
    const slide = presentation?.slides?.find(s => s.id === previewSlideId) as ICanvasSlide;
    const items = slide?.content?.canvasItems || [];
    const toCopy = items.filter(i => selectedIds.includes(i.id));
    setClipboard(toCopy);
  }, [hasSelection, presentation, previewSlideId, selectedIds]);

  const pasteItems = useCallback(async () => {
    if (!previewSlideId || clipboard.length === 0) return;
    await takeSnapshot(previewSlideId);
    const newIds: string[] = [];
    clipboard.forEach(item => {
      const newItem: ICanvasItem = {
        ...item,
        id: crypto.randomUUID(),
        x: (item.x || 50) + 2,
        y: (item.y || 50) + 2,
        zIndex: 100, // Will be resolved by store
      };
      addCanvasItem(previewSlideId, newItem);
      newIds.push(newItem.id);
    });
    setSelectedIds(newIds);
  }, [previewSlideId, clipboard, addCanvasItem, setSelectedIds, takeSnapshot]);

  const isSelect = canvasTool === 'select';
  const isHand = canvasTool === 'pan';

  const liveSlideId = usePresentationStore(s => s.liveSlideId);
  const liveSlide = (selectedPresentation || activePresentation)?.slides.find(s => s.id === liveSlideId);
  
  // The SlideTimeline is always 300px tall (252 + 48). 
  // We use bottom-[316px] to give exactly a 16px gap above it.
  const bottomOffset = "bottom-[316px]";

  const [toolbarVisible, setToolbarVisible] = useAtom(editorToolbarVisibleAtom);

  // When hidden, show only a small pill to re-open
  if (!toolbarVisible) {
    return (
      <div 
        className={cn(
          "absolute left-1/2 -translate-x-1/2 z-100",
          bottomOffset,
          designPanelOpen ? "-ml-40" : "ml-0"
        )}
      >
        <Tooltip label={t('show_toolbar', 'Show Toolbar')}>
          <button
            onClick={() => setToolbarVisible(true)}
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-full cursor-pointer",
              "bg-stone-900/40 backdrop-blur-xl border border-white/10",
              "hover:bg-stone-900/70 hover:border-white/20 shadow-lg",
              "opacity-60 hover:opacity-100 transition-all duration-300 active:scale-90",
              "animate-in fade-in zoom-in-75 duration-300"
            )}
            aria-label={t('show_toolbar', 'Show Toolbar')}
          >
            <ChevronUp className="w-4 h-4 text-stone-300" />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "absolute left-1/2 -translate-x-1/2 z-100 transition-all duration-300 ease-in-out",
        bottomOffset,
        designPanelOpen ? "-ml-40" : "ml-0"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 h-14 rounded-2xl shadow-2xl transition-all duration-300",
          "bg-stone-900/40 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5",
          "hover:bg-stone-900/60 hover:border-white/20",
          "animate-in fade-in zoom-in-95 duration-300"
        )}
      >
        {/* Navigation Tools */}
        <div className="flex items-center gap-1 px-1 my-2">
          <ToolButton
            icon={MousePointer2}
            label={t('select_tool', 'Select')}
            shortcut="V"
            active={isSelect}
            onClick={() => setCanvasTool('select')}
          />
          <ToolButton
            icon={Hand}
            label={t('hand_tool', 'Hand (Pan)')}
            shortcut="H"
            active={isHand}
            onClick={() => setCanvasTool('pan')}
          />
        </div>

        <Divider />

        {/* Creation Tools */}
        <div className="flex items-center gap-1 px-1 my-2">
          <ToolButton
            icon={Type}
            label={t('add_text', 'Text')}
            shortcut="T"
            disabled={!previewSlideId}
            onClick={() => addElement('text')}
          />
          <ToolButton
            icon={ImageIcon}
            label={t('add_image', 'Image')}
            disabled={!previewSlideId}
            onClick={() => addElement('image')}
          />
          <ToolButton
            icon={Video}
            label={t('add_video', 'Video')}
            disabled={!previewSlideId}
            onClick={() => addElement('video')}
          />
          
          <div className="h-4 w-px bg-white/5 mx-1" />
          
          <ShapesDropdown onSelect={(shapeType) => addElement('shape', shapeType)} />

          <ToolButton
            icon={Minus}
            label={t('add_line', 'Line')}
            shortcut="L"
            disabled={!previewSlideId}
            onClick={() => addElement('stroke')}
          />
        </div>

        <Divider />

        {/* Actions & Zoom */}
        <div className="flex items-center gap-1 px-1 my-2">
          <div className={cn(
            "flex items-center gap-1 transition-all duration-300 overflow-hidden",
            hasSelection ? "max-w-[150px] opacity-100" : "max-w-0 opacity-0"
          )}>
            <ToolButton
              icon={Copy}
              label={t('copy', 'Copy')}
              shortcut="⌘C"
              onClick={copySelected}
            />
            <ToolButton
              icon={Clipboard}
              label={t('paste', 'Paste')}
              shortcut="⌘V"
              disabled={!canPaste}
              onClick={pasteItems}
            />
            <ToolButton
              icon={Trash2}
              label={t('delete', 'Delete')}
              shortcut="⌫"
              danger
              onClick={deleteSelected}
            />
            <Divider />
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
             <ToolButton
                icon={ZoomOut}
                label={t('zoom_out', 'Zoom Out')}
                shortcut="⌘−"
                disabled={zoom <= 0.1}
                onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.1))}
              />
              <Tooltip label={t('reset_zoom', 'Reset Zoom')} shortcut="⌘0">
                <button
                  onClick={onZoomFit}
                  className="h-9 px-2 rounded-xl text-stone-500 hover:text-stone-100 hover:bg-white/5 transition-all text-[11px] font-mono font-bold tabular-nums min-w-[48px] active:scale-95 cursor-pointer"
                >
                  {Math.round(zoom * 100)}%
                </button>
              </Tooltip>
              <ToolButton
                icon={ZoomIn}
                label={t('zoom_in', 'Zoom In')}
                shortcut="⌘+"
                disabled={zoom >= 4}
                onClick={() => setZoom(prev => Math.min(prev + 0.1, 4))}
              />
          </div>

          <Divider />

          {/* Hide Toolbar Button — inside the bar */}
          <ToolButton
            icon={ChevronDown}
            label={t('hide_toolbar', 'Hide Toolbar')}
            onClick={() => setToolbarVisible(false)}
          />
        </div>
      </div>
    </div>
  );
};

export default SlideEditorToolbar;
