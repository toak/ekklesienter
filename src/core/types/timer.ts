import { IStyleLayer } from './style';

export type TimerTriggerType = 'start' | 'finish' | 'remaining' | 'elapsed' | 'percentage';
export type TimerActionType = 'next_slide' | 'play_sound' | 'change_bg' | 'blackout' | 'flash' | 'volume_fade';

export interface ITimerAction {
  id: string;
  type: TimerActionType;
  payload?: any;
}

export interface ITimerTrigger {
  id: string;
  type: TimerTriggerType;
  value: number; // seconds or percentage
  actions: ITimerAction[];
  fired?: boolean; // internal state to prevent double firing
}

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
