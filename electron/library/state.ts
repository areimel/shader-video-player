import type { LibraryFolder, LibraryItem, LibraryMetaPatch } from "../../shared/types";
import { itemIdFor } from "./ids";
import type { LightMeta } from "./metaParse";
import { folderName } from "./folders";
import type { FileVersion, MetaJob, MetaResult } from "./metaQueue";
import type { WalkEntry } from "./walker";

/** A registered folder with its scan state. `real` is the root's realpath from the last scan (null if missing). */
export interface Folder {
  id: string;
  path: string;
  name: string;
  real: string | null;
  /** The last realpath a scan saw, kept while the folder is missing so its cached metadata is not pruned. */
  lastRoot: string | null;
  missing: boolean;
  truncated: boolean;
  items: Item[];
}

/** An indexed item plus the paths that never leave the main process. */
export interface Item extends LibraryItem {
  path: string;
  real: string;
}

export function newFolder(id: string, path: string, real: string | null): Folder {
  return { id, path, name: folderName(path), real, lastRoot: real, missing: false, truncated: false, items: [] };
}

/**
 * What the metadata queue needs from the index: jobs for unprobed items (with their folder's realpath, re-checked
 * before probing), every indexed real path, and the roots of missing folders whose cache entries must survive.
 */
export function metaWork(folders: readonly Folder[], items: Iterable<Item>): { jobs: MetaJob[]; live: string[]; missingRoots: string[] } {
  const roots = new Map(folders.map((f) => [f.id, f.real]));
  const jobs: MetaJob[] = [];
  const live: string[] = [];
  for (const i of items) {
    live.push(i.real);
    const root = roots.get(i.folderId);
    if (i.probe === "pending" && root) jobs.push({ id: i.id, path: i.real, root, size: i.sizeBytes, mtimeMs: i.modifiedMs });
  }
  return { jobs, live, missingRoots: folders.filter((f) => f.missing).map((f) => f.lastRoot ?? f.path) };
}

function withMeta(item: Item, meta: LightMeta | null): void {
  if (!meta) return;
  item.probe = meta.ok ? "ok" : "failed";
  item.durationSec = meta.ok ? meta.durationSec : null;
  item.width = meta.ok ? meta.width : null;
  item.height = meta.ok ? meta.height : null;
}

/** Turns walk entries into items, filling metadata from the cache where this exact file version is known. */
export function buildItems(folderId: string, entries: readonly WalkEntry[], cached: (file: FileVersion) => LightMeta | null): Item[] {
  return entries.map((e) => {
    const id = itemIdFor(e.real);
    const item: Item = {
      id, folderId, name: e.name, dir: e.dir, sizeBytes: e.size, modifiedMs: e.mtimeMs,
      durationSec: null, width: null, height: null, probe: "pending", thumb: null, path: e.path, real: e.real,
    };
    withMeta(item, cached({ path: e.real, size: e.size, mtimeMs: e.mtimeMs }));
    return item;
  });
}

/** Applies probe results to items that still exist as the same file version; returns the renderer patches. */
export function applyMeta(byId: ReadonlyMap<string, Item>, results: readonly MetaResult[]): LibraryMetaPatch[] {
  const patches: LibraryMetaPatch[] = [];
  for (const { job, meta } of results) {
    const item = byId.get(job.id);
    if (!item || item.real !== job.path || item.sizeBytes !== job.size || item.modifiedMs !== job.mtimeMs) continue;
    withMeta(item, meta);
    patches.push({ id: item.id, durationSec: item.durationSec, width: item.width, height: item.height, probe: item.probe });
  }
  return patches;
}

export function publicFolder(f: Folder): LibraryFolder {
  return { id: f.id, name: f.name, path: f.path, missing: f.missing, truncated: f.truncated };
}

/** Copies only the LibraryItem fields, so the internal paths are never sent to the renderer. */
export function publicItem(i: Item): LibraryItem {
  return {
    id: i.id, folderId: i.folderId, name: i.name, dir: i.dir, sizeBytes: i.sizeBytes, modifiedMs: i.modifiedMs,
    durationSec: i.durationSec, width: i.width, height: i.height, probe: i.probe, thumb: i.thumb,
  };
}
