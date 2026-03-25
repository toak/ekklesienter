import { ICanvasItem } from './canvas';
import { ITimerSettings } from './timer';
import { IAudioAttachment, IAudioScope } from './audio';
import { IStyleLayer } from './style';
import { Verse } from './bible';
import { PresenterSettings } from './settings';

export type TransitionDirection = 'top' | 'right' | 'bottom' | 'left' | 'in' | 'out';

export interface ISlideTransition {
  type: string;
  duration: number; // in seconds, supports decimals
  direction?: TransitionDirection;
}

export interface ISlideContent {
  variables: Record<string, string | number>;
  canvasItems?: ICanvasItem[];
}

export type SlideType = 'normal' | 'nested' | 'timer' | 'verse' | 'group';

export interface IBaseSlide {
  id: string;
  type: SlideType;
  order: number;
  blockId: string;
  templateId: string;
  notes?: string;
  isExpanded?: boolean; // UI state for timeline
}

export interface ICanvasSlide extends IBaseSlide {
  type: 'normal';
  backgroundOverride?: IStyleLayer[];
  content: ISlideContent;
  audio?: IAudioAttachment; // Legacy attached audio
  audioScopes?: IAudioScope[]; // New event-based audio tracks
  duration?: number;
  transition?: ISlideTransition;
  timerSettings?: ITimerSettings;
  linkedPresentationId?: string; // ID of the nested presentation file (Linked global `.ekt` library file)
  localNestedPresentationId?: string; // ID if detached
  masterPresentationId?: string; // ID of the nested presentation file (Legacy)
  lastSyncedAt?: string; // ISO string of the library original's updatedAt at time of sync/insertion
}

export interface IVerseSlide extends IBaseSlide {
  type: 'verse';
  verseRef: string;
  translation: string;
  highlightWords?: string[];
  showReference?: boolean;
  textStyle?: Record<string, any>;
}

export interface ITimerSlide extends IBaseSlide {
  type: 'timer';
  durationSec: number;
  countDirection: 'up' | 'down';
  playlist?: string[];
  onComplete?: 'stop' | 'loop' | 'nextSlide';
  warningAtSec?: number;
}

export interface INestedSlide extends IBaseSlide {
  type: 'nested';
  ektpHash?: string; // before import
  presentationId?: string; // after import
  entrySlideId?: string; // optional start slide
  previewHash?: string; // optional thumbnail
}

export interface IGroupSlide extends IBaseSlide {
  type: 'group';
}

export type ISlide = ICanvasSlide | IVerseSlide | ITimerSlide | INestedSlide | IGroupSlide;

export interface IBlock {
  id: string;
  name: string;
  nameRu: string;
  icon: string;
  color: string;
  description: string;
  defaultSlides: number;
}

export interface ISection {
  id: string;
  name: string;
  nameRu: string;
  description?: string;
  blockIds: string[]; // Order of blocks in this section
}

export interface IWorkflowFolder {
  id: string;
  name: string;
  nameRu: string;
  parentId?: string; // For nesting
}

export interface IWorkflow {
  id: string;
  name: string;
  nameRu: string;
  description: string;
  sectionIds: string[]; // Order of sections in this workflow
  folderId?: string; // Reference to IWorkflowFolder
}

export interface IPresentationBin {
  id: string;
  name: string;
  createdAt: number;
  parentId?: string; // For nested bins
}

export interface IServiceFile {
  id: string;
  name: string;
  nameRu?: string;
  description?: string;
  presentationIds: string[]; // Order of nested presentations
  masterPresentationId: string; // The locked master.ektp ID
  folderId?: string; // Reference to IWorkflowFolder
  version?: string; // Schema version
  engineVersion?: string; // App version that created/saved the file
  createdAt: Date;
  updatedAt: Date;
  lastOpened?: Date;
  fileHandle?: any; // Persistent handle for incremental saves
  metadata?: {
    church?: string;
    date?: Date;
    serviceType?: string;
  };
}

export interface IPresentationFile {
  id: string;
  name: string;
  workflowId?: string;
  serviceId?: string; // Links to IServiceFile if nested
  binId?: string; // Reference to IPresentationBin (null = root)
  isMaster?: boolean; // True if it's the master presentation in a service
  version?: string; // Schema version
  engineVersion?: string; // App version that created/saved the file
  createdAt: Date;
  updatedAt: Date;
  lastOpened?: Date;
  fileHandle?: any; // Persistent handle for incremental saves
  thumbnailUrl?: string; // Local blob URL or base64 for the first slide preview
  hasPreview?: boolean; // Flag to indicate if a preview.png exists in the ZIP

  slideStorageMode?: 'inline' | 'split';
  slideIndex?: Array<{ id: string; order: number; type?: SlideType }>;
  ektpHash?: string; // SHA-256 of the imported .ektp archive, for deduplication

  slides: ISlide[];
  audioScopes?: IAudioScope[];
  endTransition?: ISlideTransition;
  metadata?: {
    church?: string;
    date?: Date;
    speaker?: string;
  };
}

export interface IEktmpFile extends ITemplate {
  // Same as ITemplate for now, but designated as a file format
}

// Circular dependency avoidance: Import ITemplate just for the extension
import { ITemplate } from './template';

export interface IPresentationSummary {
  id: string;
  name: string;
  lastOpened: Date;
  type?: 'presentation' | 'service';
}

export interface SlideDisplayProps {
  isProjector?: boolean;
  activeVerse?: Verse | null;
  selectedSlide?: ISlide | null;
  parallelVerse?: Verse | null;
  multiVerses?: Verse[] | null;
  isMultiVerseMode?: boolean;
  appMode?: 'scripture' | 'presentation';
  settings?: PresenterSettings;
}
