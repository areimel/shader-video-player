import { isAbsolute } from "node:path";
import { isFolderId } from "./ids";

/** Registered folders: kept small so a scan of everything stays bounded (5000 items each). */
export const MAX_FOLDERS = 32;
/** Metadata cache entries; well above MAX_FOLDERS x 5000 so a full library always fits. */
export const MAX_META_ENTRIES = 200_000;

export interface PersistedFolder {
  id: string;
  /** Absolute path as the user registered it (may itself be a symlink; scans resolve it). */
  path: string;
}

export interface FolderFile {
  version: 1;
  folders: PersistedFolder[];
}

/** Light-probe result cached per file; a different size or mtime means the entry is stale. */
export interface MetaEntry {
  path: string;
  size: number;
  mtimeMs: number;
  ok: boolean;
  durationSec: number | null;
  width: number | null;
  height: number | null;
}

export interface MetaFile {
  version: 1;
  entries: MetaEntry[];
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isCount = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0;
const positiveOrNull = (x: unknown): number | null | undefined =>
  x === null ? null : typeof x === "number" && Number.isFinite(x) && x > 0 ? x : undefined;

function entriesOf(raw: unknown, key: string): unknown[] {
  if (!isRecord(raw) || raw.version !== 1) return [];
  const list = raw[key];
  return Array.isArray(list) ? list : [];
}

/** Heals `library.json`: valid ids and absolute paths only, no duplicate ids or paths, at most MAX_FOLDERS. */
export function healFolders(raw: unknown): PersistedFolder[] {
  const out: PersistedFolder[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const f of entriesOf(raw, "folders")) {
    if (out.length >= MAX_FOLDERS) break;
    if (!isRecord(f) || !isFolderId(f.id) || ids.has(f.id)) continue;
    if (typeof f.path !== "string" || !isAbsolute(f.path) || paths.has(f.path)) continue;
    ids.add(f.id);
    paths.add(f.path);
    out.push({ id: f.id, path: f.path });
  }
  return out;
}

export function folderFile(folders: readonly PersistedFolder[]): FolderFile {
  return { version: 1, folders: folders.map(({ id, path }) => ({ id, path })) };
}

/** Heals the metadata cache; a malformed entry is dropped (it will simply be probed again). */
export function healMetaCache(raw: unknown): MetaEntry[] {
  const out: MetaEntry[] = [];
  const seen = new Set<string>();
  for (const e of entriesOf(raw, "entries")) {
    if (out.length >= MAX_META_ENTRIES) break;
    if (!isRecord(e) || typeof e.path !== "string" || !isAbsolute(e.path) || seen.has(e.path)) continue;
    if (!isCount(e.size) || !isCount(e.mtimeMs) || typeof e.ok !== "boolean") continue;
    const durationSec = positiveOrNull(e.durationSec);
    const width = positiveOrNull(e.width);
    const height = positiveOrNull(e.height);
    if (durationSec === undefined || width === undefined || height === undefined) continue;
    seen.add(e.path);
    out.push(e.ok
      ? { path: e.path, size: e.size, mtimeMs: e.mtimeMs, ok: true, durationSec, width, height }
      : { path: e.path, size: e.size, mtimeMs: e.mtimeMs, ok: false, durationSec: null, width: null, height: null });
  }
  return out;
}

export function metaFile(entries: Iterable<MetaEntry>): MetaFile {
  return { version: 1, entries: [...entries] };
}
