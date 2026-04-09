// For UI state managed by Jotai
export type ThemeMode = 'light' | 'dark';
export type AppMode = 'scripture' | 'presentation';
export type PresentationMode = 'normal' | 'fullscreen';

// --- Projector/Command Types ---

export type ProjectorCommandType = 
  | 'show-verse' 
  | 'show-slide' 
  | 'show-preview-slide'
  | 'set-override' 
  | 'clear-override' 
  | 'projector-ready' 
  | 'sync-state';

export interface IProjectorCommand {
  type: ProjectorCommandType;
  payload: any;
}

export interface IProjectorState {
  activeSlideId: string | null;
  activePresentationId: string | null;
  activeOverride: 'blackout' | 'whiteout' | 'logo' | null;
  timestamp: number;
}
