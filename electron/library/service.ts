import { realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { LibraryMetaPatch, LibrarySnapshot } from "../../shared/types";
import { readJson, writeJson } from "../jsonStore";
import { folderConflict, folderCoverage } from "./folders";
import { isFolderId, newFolderId } from "./ids";
import { cachedMeta, onMetaResults, scheduleMeta, setLivePaths, startMeta, stopMeta } from "./metaQueue";
import { MAX_FOLDERS, folderFile, healFolders } from "./shape";
import { applyMeta, buildItems, metaWork, newFolder, publicFolder, publicItem, type Folder, type Item } from "./state";
import { walkFolder, nodeWalkFs } from "./walker";
import { isWatched, stopWatchers, syncWatchers } from "./watcher";

const STORE = "library.json";
/** Manual rescans and fallback (no watcher) rescans are rate-limited; a scan of 32 folders is not free. */
const RESCAN_MIN_MS = 2000;
const FALLBACK_MIN_MS = 5000;
/** Coalesces the scanning-started / folder-done bursts of a full scan into a few snapshots. */
const EMIT_MS = 100;

let folders: Folder[] = [];
/** Every indexed item by id; each id belongs to exactly one folder. */
const byId = new Map<string, Item>();
let revision = 0;
/** Bumped by stop; a scan started in an older epoch never touches state again. */
let epoch = 0;
/** Set by stopLibrary: focus, library:get or a rescan during a slow quit must not start scans or watchers. */
let stopped = false;
/** Per-folder scan generation: a newer scan of the same folder supersedes the older one. */
const scanGen = new Map<string, number>();
let inFlight = 0;
/** Folder ids with a scan running; the fallback refresh leaves those alone instead of restarting them. */
const busy = new Map<string, number>();
const setBusy = (id: string, d: number) => { const n = (busy.get(id) ?? 0) + d; if (n > 0) busy.set(id, n); else busy.delete(id); };
let lastRescan = 0;
let lastFallback = 0;
let emitTimer: NodeJS.Timeout | null = null;
const changeListeners: Array<(s: LibrarySnapshot) => void> = [];
const metaListeners: Array<(p: LibraryMetaPatch[]) => void> = [];

export const onLibraryChanged = (cb: (s: LibrarySnapshot) => void) => { changeListeners.push(cb); };
export const onLibraryMeta = (cb: (p: LibraryMetaPatch[]) => void) => { metaListeners.push(cb); };

export function snapshot(): LibrarySnapshot {
  return {
    revision,
    scanning: inFlight > 0,
    folders: folders.map(publicFolder),
    items: folders.flatMap((f) => f.items.map(publicItem)),
  };
}

/** Bumps the revision now and sends one snapshot shortly after, however many changes land meanwhile. */
function changed(): void {
  revision++;
  emitTimer ??= setTimeout(() => {
    emitTimer = null;
    const s = snapshot();
    for (const l of changeListeners) l(s);
  }, EMIT_MS);
}

function saveFolders(): void {
  writeJson(STORE, folderFile(folders));
}

const watchHandlers = {
  onChange: (id: string) => { const f = folders.find((x) => x.id === id); if (f) void scanFolder(f); },
  onFail: () => undefined, // isWatched() is the source of truth; refreshIfStale polls the unwatched ones
};

/** Hands the index's unprobed items to the metadata queue; only a finished index may prune its cache. */
function requeueMeta(): void {
  const work = metaWork(folders, byId.values());
  scheduleMeta(work.jobs);
  setLivePaths(inFlight === 0 ? work.live : null, work.missingRoots);
}

function setItems(folder: Folder, items: Item[]): void {
  for (const old of folder.items) if (byId.get(old.id) === old) byId.delete(old.id);
  // Nested folders are rejected on add, but a retargeted symlinked root could still overlap another one.
  folder.items = items.filter((i) => !byId.has(i.id));
  for (const i of folder.items) byId.set(i.id, i);
}

async function scanFolder(folder: Folder): Promise<void> {
  if (stopped) return;
  const gen = (scanGen.get(folder.id) ?? 0) + 1;
  scanGen.set(folder.id, gen);
  const ep = epoch;
  const current = () => ep === epoch && scanGen.get(folder.id) === gen && folders.includes(folder);
  inFlight++;
  setBusy(folder.id, 1);
  changed();
  try {
    const res = await walkFolder(folder.path, nodeWalkFs, current);
    if (!current() || res.status === "superseded") return;
    if (res.status === "missing") {
      Object.assign(folder, { real: null, missing: true, truncated: false });
      setItems(folder, []);
    } else {
      Object.assign(folder, { real: res.root, lastRoot: res.root, missing: false, truncated: res.truncated });
      setItems(folder, buildItems(folder.id, res.entries, cachedMeta));
    }
  } finally {
    inFlight--;
    setBusy(folder.id, -1);
    if (ep === epoch && !stopped) {
      changed();
      requeueMeta();
      syncWatchers(folders.map((f) => ({ id: f.id, root: f.real })), watchHandlers);
    }
  }
}

function rescanAll(): void {
  if (stopped) return;
  for (const f of folders) void scanFolder(f);
}

/** True once startLibrary ran: the CLI never starts the library, so GUI-only helpers can tell. */
let started = false;

export function startLibrary(): void {
  if (stopped) return;
  started = true;
  folders = readJson(STORE, healFolders).map((p) => newFolder(p.id, p.path, null));
  startMeta();
  onMetaResults((results) => {
    const patches = applyMeta(byId, results);
    if (patches.length) for (const l of metaListeners) l(patches);
  });
  rescanAll();
}

export function stopLibrary(): void {
  stopped = true;
  epoch++;
  if (emitTimer) clearTimeout(emitTimer);
  emitTimer = null;
  stopWatchers();
  stopMeta();
}

/** Manual rescan from the renderer (rate-limited). */
export function requestRescan(): void {
  if (stopped || Date.now() - lastRescan < RESCAN_MIN_MS) return;
  lastRescan = Date.now();
  rescanAll();
}

/** Window focus and `library:get`: rescans the folders no watcher covers (fallback after a watch error). */
export function refreshIfStale(): void {
  if (stopped) return;
  // At startup no folder is watched until its first scan ends; those scans must not be restarted.
  const stale = folders.filter((f) => !isWatched(f.id) && !busy.has(f.id));
  if (!stale.length || Date.now() - lastFallback < FALLBACK_MIN_MS) return;
  lastFallback = Date.now();
  for (const f of stale) void scanFolder(f);
}

/**
 * Registers folders (dialog choice or dropped directories). Each must resolve to a directory that does not
 * duplicate, contain or sit inside a registered folder. Throws the first reason when none could be added.
 */
export async function addFolders(paths: readonly string[]): Promise<LibrarySnapshot> {
  if (stopped) throw new Error("The library is closing");
  const added: Folder[] = [];
  let reason: string | null = null;
  for (const p of paths) {
    let real: string;
    try {
      real = await realpath(p);
      if (!(await stat(real)).isDirectory()) throw new Error("not a directory");
    } catch {
      reason ??= "That folder could not be read";
      continue;
    }
    // Checked synchronously against the live list after the awaits, so two racing adds cannot both pass.
    if (stopped) throw new Error("The library is closing");
    if (folders.length >= MAX_FOLDERS) { reason ??= `The library holds at most ${MAX_FOLDERS} folders`; break; }
    const conflict = folderConflict(folders.map((f) => ({ real: f.real ?? f.path, name: f.name })), real);
    if (conflict) { reason ??= conflict; continue; }
    const path = resolve(p);
    const folder = newFolder(newFolderId(), path, real);
    folders.push(folder);
    added.push(folder);
  }
  if (!added.length) throw new Error(reason ?? "No folder was added");
  saveFolders();
  changed();
  for (const f of added) void scanFolder(f);
  return snapshot();
}

/**
 * GUI only (never call from CLI code): registers `path` as a library folder when it is free, e.g. after a
 * download lands in the app's videos folder. Does nothing when the library is not running, the folder is
 * missing, already covered by or containing a registered folder, or the folder limit is reached.
 */
export async function ensureLibraryFolder(path: string): Promise<void> {
  if (!started || stopped) return;
  let real: string;
  try {
    real = await realpath(path);
    if (!(await stat(real)).isDirectory()) return;
  } catch { return; }
  if (stopped || folders.length >= MAX_FOLDERS) return;
  if (folderCoverage(folders.map((f) => f.real ?? f.path), real) !== "free") return;
  try { await addFolders([path]); } catch { /* refused (limit, root, race): the library just stays as it is */ }
}

export function removeFolder(id: unknown): LibrarySnapshot {
  const folder = isFolderId(id) ? folders.find((f) => f.id === id) : undefined;
  if (!folder) throw new Error("That folder is not in the library");
  if (stopped) throw new Error("The library is closing");
  folders = folders.filter((f) => f !== folder); // an in-flight scan of it sees folders.includes() fail
  setItems(folder, []);
  scanGen.delete(folder.id);
  saveFolders();
  changed();
  requeueMeta();
  syncWatchers(folders.map((f) => ({ id: f.id, root: f.real })), watchHandlers);
  return snapshot();
}

/** The live folder and item for an id, or null (for `openItem`, which re-validates everything). */
export function lookupItem(id: string): { folder: Folder; item: Item } | null {
  const item = byId.get(id);
  const folder = item && folders.find((f) => f.id === item.folderId);
  return item && folder ? { folder, item } : null;
}
