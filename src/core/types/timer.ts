import { IStyleLayer } from './style';

export type TimerTriggerType = 'on_start' | 'on_end' | 'remaining' | 'elapsed' | 'percentage' | 'on_keypress';
export type TimerActionType = 'next_slide' | 'prev_slide' | 'navigate_to' | 'play_sound' | 'change_bg' | 'blackout' | 'flash' | 'volume_fade' | 'apply_override' | 'close_override' | 'wait' | 'key_halt';

export type ITimerAction =
  | { id: string; type: 'next_slide' | 'prev_slide' | 'blackout' | 'flash' | 'close_override' }
  | { id: string; type: 'navigate_to'; payload: { slideId: string } }
  | { id: string; type: 'play_sound'; payload: { soundId: string; volume?: number; mediaId?: string } }
  | { id: string; type: 'change_bg'; payload: { background: IStyleLayer[] } }
  | { id: string; type: 'volume_fade'; payload: { duration: number } }
  | { id: string; type: 'apply_override'; payload: { override: 'blackout' | 'whiteout' | 'logo' } }
  | { id: string; type: 'wait'; payload: { duration: number } }
  | { id: string; type: 'key_halt'; payload: { key: string } };

export type ITimerTrigger =
  | { id: string; type: 'on_start' | 'on_end'; actions: ITimerAction[]; fired?: boolean }
  | { id: string; type: 'remaining' | 'elapsed' | 'percentage'; value: number; actions: ITimerAction[]; fired?: boolean }
  | { id: string; type: 'on_keypress'; triggerValue: string; actions: ITimerAction[]; fired?: boolean };

export interface ITimerSettings {
  duration: number; // in seconds
  style: 'minimal_ring' | 'modern_bold' | 'serene' | 'brutalist' | 'neon_cyber' | 'aurora' | 'old_digital' | 'flip_clock' | 'neo_brutalist' | 'vhs_crt';
  endAction: 'none' | 'loop' | 'next' | 'blackout';
  showMilliseconds?: boolean;
  prefix?: string;
  suffix?: string;
  subtitle?: string;
  themeFill?: IStyleLayer[];
  customFills?: Record<string, IStyleLayer[]>;
  fontSize?: number;
  backgroundOpacity?: number; // 0-1
  triggers?: ITimerTrigger[];
  playlist?: string[]; // Array of media file IDs
}
