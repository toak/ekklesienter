export type MediaType = 'image' | 'video' | 'audio';

export interface IMediaItem {
  id: string;
  name: string;
  path: string; // Absolute path or URL
  type: MediaType;
  data?: Blob; // Optional binary data for imported/bundled media
  binId?: string; // Reference to IMediaBin (null = root)
  createdAt: number;
  updatedAt?: number;
}

export interface IMediaBin {
  id: string;
  name: string;
  createdAt: number;
}


// --- Logo Types ---

export interface ILogo {
  id: string;
  name: string;
  url: string; // file:// path, data url, or ObjectURL
  isPreloaded?: boolean;
  isFromDb?: boolean; // true if saved in IndexedDB
  groupId?: string; // Links to ILogoGroup.id if assigned
}

export interface ILogoEntry {
  id: string;
  name: string;
  data: Blob;
  mimeType: string;
}

export interface IBackgroundEntry {
  id: string;
  name: string;
  data: Blob;
  mimeType: string;
}

export interface ILogoGroup {
  id: string;
  name: string;
  nameRu: string;
  logos: ILogo[];
  isUserCreated?: boolean; // true for manually created or folder-imported groups
  folderPath?: string; // Source folder path for re-scanning
}

export interface ILogoSettings {
  activeLogoId: string | null;
  customLogos: ILogo[]; // Ungrouped custom logos
  customGroups: ILogoGroup[]; // User-created groups
  logoGroups: ILogoGroup[]; // Preloaded groups
}
