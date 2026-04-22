import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, RotateCcw, ZoomIn, Maximize } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { CustomSlider } from '@/components/CustomSlider';
import { CanvasService } from '@/features/presenter/services/CanvasService';

interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BackgroundCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  initialCrop?: CropData;
  onApply: (crop: CropData) => void;
}

export const BackgroundCropModal: React.FC<BackgroundCropModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  initialCrop,
  onApply
}) => {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  // Reset or initialize state
  useEffect(() => {
    if (isOpen) {
      if (initialCrop) {
        // We'll calculate zoom and offset from the initial crop percentages later once image loads
      } else {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      }
    }
  }, [isOpen, imageUrl]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const cw = containerRef.current?.offsetWidth || 0;
    const ch = containerRef.current?.offsetHeight || 0;

    // Viewport is fixed 16:9 inside the container
    const vw = cw * 0.8;
    const vh = vw * (9 / 16);

    setContainerSize({ width: cw, height: ch });

    // Initial display size of image
    // We want the image to fill the 16:9 viewport (object-cover style)
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const viewRatio = 16 / 9;

    let displayW, displayH;
    if (imgRatio > viewRatio) {
      displayH = vh;
      displayW = vh * imgRatio;
    } else {
      displayW = vw;
      displayH = vw / imgRatio;
    }

    setImgSize({ width: displayW, height: displayH });

    if (initialCrop) {
      // Convert initialCrop percentages back to local state
      // crop.width = (vh / displayW) * 100? No.
      // crop.width is % of image. viewfinder.width is fixed at vw.
      // vh = displayH * zoom * (crop.height / 100)
      const newZoom = 100 / initialCrop.width; // Simplified assuming width is the base
      // Actually, if we locked to viewport:
      // zoom = 1 means image "covers" the viewport.
      // initialCrop.width is % of original image width.
      // If crop.width is 50%, it means we are zoomed in 2x relative to the "cover" state?
      // Not necessarily. 
      // Let's stick to a simpler model: Zoom 1 = standard object-cover.
      const initialZoom = 100 / initialCrop.width;
      setZoom(initialZoom);

      const centerX = (initialCrop.x + initialCrop.width / 2) / 100;
      const centerY = (initialCrop.y + initialCrop.height / 2) / 100;

      // Offset such that the crop box is centered in the viewfinder
      setOffset({
        x: (0.5 - centerX) * displayW * initialZoom,
        y: (0.5 - centerY) * displayH * initialZoom
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;

      const cw = containerRef.current?.offsetWidth || 0;
      const vw = cw * 0.8;
      const vh = vw * (9 / 16);

      const clamped = CanvasService.clampCropOffset(
        { x: newX, y: newY },
        { width: vw, height: vh },
        imgSize,
        zoom
      );

      setOffset(clamped);
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, zoom, imgSize, containerSize]);

  const handleApply = () => {
    const cw = containerRef.current?.offsetWidth || 0;
    const vw = cw * 0.8;
    const vh = vw * (9 / 16);

    const crop = CanvasService.calculateCropResult(
        offset,
        { width: vw, height: vh },
        imgSize,
        zoom
    );

    onApply(crop);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative w-full h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Maximize className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight uppercase">{t('adjust_crop', 'Adjust Framing')}</h3>
              <p className="text-xs font-bold text-stone-500">{t('lock_aspect_ratio_tooltip')}: 16:9</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-stone-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Workspace */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden flex items-center justify-center cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          {/* Transparent Image */}
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <img src={imageUrl} className="max-w-none max-h-none opacity-50 blur-sm scale-110" />
          </div>

          {/* Active Image Layer */}
          <div
            className="relative shrink-0"
            style={{
              width: imgSize.width * zoom,
              height: imgSize.height * zoom,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out'
            }}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              onLoad={handleImageLoad}
              className="w-full h-full object-fill pointer-events-none"
              alt=""
            />
          </div>

          {/* Viewfinder Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* 16:9 Cutout logic using box-shadow */}
            <div
              className="relative border-2 border-accent/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]"
              style={{
                width: '80%',
                aspectRatio: '16/9'
              }}
            >
              {/* Visual Guides */}
              <div className="absolute inset-x-0 top-1/3 border-t border-white/10" />
              <div className="absolute inset-x-0 top-2/3 border-t border-white/10" />
              <div className="absolute inset-y-0 left-1/3 border-l border-white/10" />
              <div className="absolute inset-y-0 left-2/3 border-l border-white/10" />

              {/* Corners */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-accent" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-accent" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-accent" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-accent" />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-8 bg-stone-900/50 border-t border-white/5 flex flex-col items-center gap-6">
          <div className="flex items-center gap-6 w-full max-w-3xl">
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-stone-400 transition-all hover:scale-105 active:scale-95"
              title={t('reset_crop')}
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <div className="flex-1 flex items-center gap-6">
              <ZoomIn className="w-5 h-5 text-stone-500 shrink-0" />
              <CustomSlider
                value={zoom}
                defaultValue={1}
                min={1}
                max={10}
                step={0.01}
                onChange={(newZoom) => setZoom(newZoom)}
                unit="%"
                formatValue={(val) => `${Math.round(val * 100)}%`}
                className="flex-1"
              />
            </div>

            <button
              type="button"
              onClick={handleApply}
              className="px-8 py-3 bg-accent text-white rounded-xl font-black uppercase tracking-widest flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-accent/20"
            >
              <Check className="w-5 h-5" />
              {t('apply_crop', 'Apply')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
