import { atom, PrimitiveAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { AppMode, ILogo } from '../types';

export const fontPreviewFamilyAtom = atom(null as string | null) as PrimitiveAtom<string | null>;
export const fontPreviewWeightAtom = atom(null as string | null) as PrimitiveAtom<string | null>;

// App state
export const appModeAtom = atom<AppMode>('scripture');
export const devModeAtom = atomWithStorage('dev-mode', false);
export const isDevAuthenticatedAtom = atomWithStorage('dev-authenticated', false);

// Text settings
export const fontSizeAtom = atom(3.5); // rem
export const previewFontSizeAtom = atom(3.5);
export const showReferenceAtom = atom(true);
export const themeAccentAtom = atom('amber'); // amber, rose, blue, stone

// Layout
export const sidebarOpenAtom = atom(true);
export const historyOpenAtom = atom(false);
export const searchOpenAtom = atom(false);
export const canvasZoomAtom = atom<number>(1.0);
export const canvasOffsetAtom = atom<{ x: number, y: number }>({ x: 0, y: 0 });
export const slideDesignPanelOpenAtom = atom<boolean>(false);
export const latestInteractionAreaAtom = atom<'canvas' | 'timeline' | 'audio'>('timeline');
export const selectedCanvasItemIdsAtom = atom<string[]>([]);
export const timelineHeightAtom = atom(236); // Strictly limited to 236px
export const isTimelineHoveredAtom = atom(false);
export const editingCanvasItemIdAtom = atom<string | null>(null);
export const selectedTransitionSlideIdAtom = atom(null as string | null) as PrimitiveAtom<string | null>;

export type SlideDesignTab = 'background' | 'elements' | 'style' | 'audio' | 'timer' | 'transition' | 'video';
export const slideDesignTabAtom = atom<SlideDesignTab>('style');

export type CanvasTool = 'select' | 'text' | 'pan' | 'image' | 'video' | 'shape' | 'stroke' | 'effect' | string;
export const canvasToolAtom = atom<CanvasTool>('select');

export interface TextCommand {
  command: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'foreColor' | 'fontName' | 'fontSize' | 'undo' | 'redo' | 'scriptStyle' | 'textCase' | 'listType' | 'underlineStyle' | 'lineHeight' | 'letterSpacing' | 'paragraphSpacing' | 'fontWeight';
  value?: string;
  timestamp: number;
}
export const textCommandAtom = atom<TextCommand | null>(null as TextCommand | null);

// Live Overrides
export type OverrideType = 'blackout' | 'whiteout' | 'logo';
export const activeOverrideAtom = atom<OverrideType | null>(null);
export const liveLogoAtom = atom<ILogo | null>(null as ILogo | null);
// Left Panel State
export const selectedLeftBlockIdAtom = atom<string>('worship');

// Computed style for the slide text
export const slideStyleAtom = atom((get) => ({
  fontSize: `${get(fontSizeAtom)}rem`,
  lineHeight: 1.4,
}));

// Drag/Update state for Slide Editor (used to pause sync)
export const slideEditorDragActiveAtom = atom(false);
export const slideEditorPendingUpdateAtom = atom(false);

// Hover states for Enter key contextual actions
export const slidePreviewHoveredAtom = atom(false);
export const slideDesignHoveredAtom = atom(false);
export const presenterPanelHoveredAtom = atom(false);