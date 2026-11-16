import type { CommandId } from "./commands";
export interface AudioTrack {
  ordinal: number;
  codec: string;
  language: string;
  title: string;
  channels: number;
}

export interface SubtitleTrack {
  ordinal: number;
  codec: string;
  language: string;
  title: string;
}

export interface MediaInfo {
  path: string;
  name: string;
  container: string;
  sizeBytes: number;
  durationSec: number;
  startTime: number;
  bitrate: number;
  videoCodec: string;
  profile: string;
  pixFmt: string;
  width: number;
  height: number;
  fps: number;
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
}

export type PlaybackMode = "native" | "transcode";

export interface PlaybackPlan {
  info: MediaInfo;
  mode: PlaybackMode;
  url: string;
  mime: string;
  startOffset: number;
  audioOrdinal: number;
  remuxOnly: boolean;
}

/** An external subtitle file the main process has approved; the renderer only ever holds the opaque id. */
export interface ExternalSubtitle {
  id: string;
  name: string;
}

export interface RecentFile {
  path: string;
  name: string;
  openedAt: number;
}

/** One entry of the play queue; paths are the ones the main process handed out. */
export interface QueueItem {
  path: string;
  name: string;
}

/** A user selection: the whole queue plus the plan of the first item that opened, at `index`. */
export interface OpenResult {
  plan: PlaybackPlan;
  queue: QueueItem[];
  index: number;
}

/** A registered library folder. `path` is for display only; the renderer addresses folders by `id`. */
export interface LibraryFolder {
  id: string;
  name: string;
  path: string;
  /** The folder could not be read on the last scan (unplugged drive, deleted). */
  missing: boolean;
  /** The scan stopped at the item or depth cap. */
  truncated: boolean;
}

/** One video found in a library folder. The renderer only ever holds the opaque `id`. */
export interface LibraryItem {
  id: string;
  folderId: string;
  name: string;
  /** Directory relative to the folder root ("" at the root), for display and grouping. */
  dir: string;
  sizeBytes: number;
  modifiedMs: number;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  probe: "pending" | "ok" | "failed";
  /** Reserved for thumbnails; always null for now. */
  thumb: string | null;
}

export interface LibrarySnapshot {
  revision: number;
  scanning: boolean;
  folders: LibraryFolder[];
  items: LibraryItem[];
}

export type LibraryMetaPatch = Pick<LibraryItem, "id" | "durationSec" | "width" | "height" | "probe">;

export interface PlayerBridge {
  openDialog(): Promise<OpenResult | null>;
  openDropped(files: File[]): Promise<OpenResult>;
  /** Opens the file dialog in the main process and adds the choice to the allow-set; [] when cancelled. */
  addToQueueDialog(): Promise<QueueItem[]>;
  /** Shift+drop: adds the dropped files to the allow-set (paths resolved in the preload). */
  queueDropped(files: File[]): Promise<QueueItem[]>;
  openQueued(path: string): Promise<PlaybackPlan>;
  openRecent(path: string): Promise<PlaybackPlan>;
  restart(startSec: number, audioOrdinal: number): Promise<PlaybackPlan>;
  forceTranscode(startSec: number): Promise<PlaybackPlan>;
  getSubtitle(ordinal: number, offsetSec: number): Promise<string>;
  findSubtitles(): Promise<ExternalSubtitle[]>;
  pickSubtitle(): Promise<ExternalSubtitle | null>;
  loadDroppedSubtitle(file: File): Promise<ExternalSubtitle>;
  getExternalSubtitle(id: string, offsetSec: number): Promise<string>;
  getRecents(): Promise<RecentFile[]>;
  reveal(path: string): void;
  /** Asks where to save a PNG. Resolves to the saved path, or null if the user cancelled. */
  saveScreenshot(png: Uint8Array, suggestedName: string): Promise<string | null>;
  setPlaying(playing: boolean): void;
  closeMedia(): void;
  onPlan(cb: (plan: PlaybackPlan) => void): () => void;
  onQueue(cb: (queue: QueueItem[], index: number) => void): () => void;
  onError(cb: (message: string) => void): () => void;
  /** Native menu commands. Unknown ids are ignored by the renderer helper. */
  onCommand(cb: (id: CommandId) => void): () => void;
  /** The library index (folders and items). Also triggers a rescan of unwatched folders. */
  getLibrary(): Promise<LibrarySnapshot>;
  /** Opens a folder picker in the main process and registers the choice; null when cancelled. */
  addLibraryFolder(): Promise<LibrarySnapshot | null>;
  /** Registers dropped directories (paths resolved in the preload; files are ignored). */
  addLibraryDropped(files: File[]): Promise<LibrarySnapshot>;
  removeLibraryFolder(folderId: string): Promise<LibrarySnapshot>;
  /** Rescans every folder (rate-limited in the main process). */
  rescanLibrary(): void;
  /** Opens an item with the videos in the same directory as the queue. */
  openLibraryItem(itemId: string): Promise<OpenResult>;
  /** Full snapshots whenever folders, items or the scanning flag change. */
  onLibrary(cb: (s: LibrarySnapshot) => void): () => void;
  /** Metadata arriving from background probes, batched. Does not change the snapshot revision. */
  onLibraryMeta(cb: (p: LibraryMetaPatch[]) => void): () => void;
  /** process.platform of the host. */
  platform: string;
  ready(): void;
}
