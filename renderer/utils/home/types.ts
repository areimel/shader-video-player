/**
 * Home screen contract. The screen is a 320x240 logical raster (40x30 cells of 8x8) painted on a
 * 640x480 canvas; the pure layout turns state into a draw list, the painter draws it, and the
 * effect engine uses the canvas as its source.
 */

export const CELL = 8;
export const COLS = 40;
export const ROWS = 30;
/** Cells kept clear on every side (curvature, rounded corners, the VHS head-switch band). */
export const INSET = 2;

/** Focusable zones. Credits are a static block inside the updates zone. */
export type ZoneId = "library" | "tv" | "updates";
export const ZONES: readonly ZoneId[] = ["library", "tv", "updates"];

export type RowAction =
  | { type: "openItem"; itemId: string }
  | { type: "openRecent"; path: string }
  | { type: "openDialog" }
  | { type: "addFolder" }
  | { type: "removeFolder"; folderId: string }
  | { type: "rescan" }
  /** effectId null = Off; presetId null keeps the effect's current (edited) values. */
  | { type: "setTv"; effectId: string | null; presetId: string | null };

export interface HomeRow {
  /** Stable across rebuilds (the cursor follows it); also the a11y mirror's element id suffix. */
  id: string;
  kind: "item" | "header" | "action" | "text";
  /** Main text, then right-aligned secondary columns (length, resolution, date...). */
  cols: string[];
  /** Rows without an action cannot take the cursor. */
  action?: RowAction;
  /** The entry that is in effect now (the active TV preset). */
  current?: boolean;
  alert?: boolean;
}

export interface Credits { version: string; author: string; thirdParty: string[] }

export interface HomeModel {
  zones: Record<ZoneId, HomeRow[]>;
  credits: Credits;
  /** Right side of the library title bar, e.g. "SCANNING" or "41 TAPES". */
  libraryStatus: string;
}

export interface HomeState {
  zone: ZoneId;
  /** Row index per zone; always on a row with an action when the zone has one. */
  cursor: Record<ZoneId, number>;
  /** First visible row per zone. */
  scroll: Record<ZoneId, number>;
}

export type HitTarget = { zone: ZoneId; index: number };

export type HomeAction =
  | { type: "move"; by: number }
  | { type: "edge"; to: "start" | "end" }
  /** wrap: Tab cycles through the zones, the arrow keys clamp at the ends. */
  | { type: "zone"; dir: -1 | 1; wrap?: boolean }
  | { type: "point"; target: HitTarget }
  | { type: "wheel"; zone: ZoneId; by: number }
  /** The model changed: clamp cursors and scroll, keep the cursor on the same row id where possible. */
  | { type: "sync"; prev: HomeModel; next: HomeModel };

export type ColorRole = "bg" | "band" | "text" | "accent" | "accentInk" | "dim" | "alert";

/** Coordinates and sizes are logical pixels (multiples of CELL in practice). */
export type DrawOp =
  | { op: "rect"; x: number; y: number; w: number; h: number; color: ColorRole }
  | { op: "text"; x: number; y: number; text: string; color: ColorRole; scale?: 1 | 2; align?: "left" | "right" };

export interface HitRegion { x: number; y: number; w: number; h: number; target: HitTarget }

export interface HomeFrame { ops: DrawOp[]; hits: HitRegion[] }

/** Things that change without user input; kept out of HomeState so the reducer stays replayable. */
export interface HomeClock {
  /** e.g. "12:41AM" */
  timeText: string;
  /** Seconds since the screen opened: drives the long-title scroll and the updates paging. */
  elapsed: number;
  reducedMotion: boolean;
}

export interface ChangelogEntry { version: string; date: string; items: string[] }
