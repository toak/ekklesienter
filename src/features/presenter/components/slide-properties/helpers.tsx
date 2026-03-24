import React from 'react';
import { ICanvasItem, CanvasItemType } from '@/core/types';
import {
    Type, ImageIcon, Video, Square, Minus, Sparkles, Circle, Triangle, Star, Diamond,
} from 'lucide-react';

// ─── Design Tab Type ────────────────────────────────────────────────────
export type DesignTab = 'background' | 'elements' | 'style' | 'audio' | 'timer' | 'transition';

// ─── Element Insertion Templates ────────────────────────────────────────
export const createCanvasItem = (type: CanvasItemType): ICanvasItem => {
    const base: ICanvasItem = {
        id: crypto.randomUUID(),
        type,
        x: 30, y: 30,
        width: 40, height: 20,
        rotation: 0,
        zIndex: 10,
        locked: false,
        visible: true,
        fills: [],
        strokes: [],
    };

    switch (type) {
        case 'text':
            return {
                ...base,
                text: {
                    content: 'New Text',
                    fontSize: 32,
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 'bold',
                    textFills: [{ id: crypto.randomUUID(), type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#ffffff' }],
                    resizingMode: 'auto-height' as const,
                    lineHeight: 1.3,
                    alignHorizontal: 'center' as const,
                    alignVertical: 'middle' as const,
                },
            };
        case 'image':
            return {
                ...base, width: 30, height: 40,
                shape: { shapeType: 'rect' },
                fills: [{ id: crypto.randomUUID(), type: 'image', visible: true, opacity: 1, blendMode: 'normal', image: { url: '', source: 'local' } }],
            };
        case 'video':
            return {
                ...base, width: 40, height: 30,
                shape: { shapeType: 'rect' },
                fills: [{ id: crypto.randomUUID(), type: 'video', visible: true, opacity: 1, blendMode: 'normal', video: { url: '', source: 'local', isMuted: true, isLooping: true } }],
            };
        case 'shape':
            return {
                ...base, width: 15, height: 15,
                shape: { shapeType: 'rect' },
                fills: [{ id: crypto.randomUUID(), type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#ffffff' }],
                borderWidth: 0,
                borderColor: '#ffffff',
            };
        case 'stroke':
            return {
                ...base, width: 30, height: 0.5,
                stroke: { x2: 100, y2: 0, color: '#ffffff', width: 2 },
                strokes: [{ id: crypto.randomUUID(), type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#ffffff' }],
            };
        case 'effect':
            return {
                ...base, width: 50, height: 50, x: 25, y: 25,
                effect: { effectType: 'glow', color: '#ffffff', intensity: 50 },
            };
        default:
            return base;
    }
};

// ─── Constants ──────────────────────────────────────────────────────────
export const ELEMENT_BUTTONS: { type: CanvasItemType; icon: React.ElementType; label: string; labelRu: string }[] = [
    { type: 'text', icon: Type, label: 'Text', labelRu: 'Текст' },
    { type: 'image', icon: ImageIcon, label: 'Image', labelRu: 'Изображение' },
    { type: 'video', icon: Video, label: 'Video', labelRu: 'Видео' },
    { type: 'shape', icon: Square, label: 'Shape', labelRu: 'Фигура' },
    { type: 'stroke', icon: Minus, label: 'Line', labelRu: 'Линия' },
    { type: 'effect', icon: Sparkles, label: 'Эффект', labelRu: 'Эффект' },
];

export const SHAPE_OPTIONS = [
    { type: 'rect' as const, icon: Square, label: 'Rectangle' },
    { type: 'circle' as const, icon: Circle, label: 'Circle' },
    { type: 'triangle' as const, icon: Triangle, label: 'Triangle' },
    { type: 'star' as const, icon: Star, label: 'Star' },
    { type: 'diamond' as const, icon: Diamond, label: 'Diamond' },
];

// ─── Custom Icons ──────────────────────────────────────────────────────
export const CornerTL = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 2H6C3.79086 2 2 3.79086 2 6V10" strokeLinecap="round" />
    </svg>
);
export const CornerTR = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 2H6C8.20914 2 10 3.79086 10 6V10" strokeLinecap="round" />
    </svg>
);
export const CornerBL = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 10H6C3.79086 10 2 8.20914 2 6V2" strokeLinecap="round" />
    </svg>
);
export const CornerBR = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 10H6C8.20914 10 10 8.20914 10 6V2" strokeLinecap="round" />
    </svg>
);

// ─── Utilities ─────────────────────────────────────────────────────────
export const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};
