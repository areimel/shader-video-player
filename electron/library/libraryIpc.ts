import { dialog, ipcMain } from "electron";
import { realpath, stat } from "node:fs/promises";
import type { LibrarySnapshot, OpenResult } from "../../shared/types";
import { isSupportedExtension } from "../media/formats";
import { isSuperseded, supersededError } from "../../shared/superseded";
import { MAX_QUEUE } from "../queue";
import { openSelectionAt } from "../selection";
import { getWindow } from "../window";
import { isInside, isItemId, itemIdFor } from "./ids";
import { windowAround } from "./queueWindow";
import {
  addFolders, lookupItem, onLibraryChanged, onLibraryMeta, refreshIfStale, removeFolder, requestRescan, snapshot,
} from "./service";

const MAX_DROPPED = 16;
const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const notFound = () => new Error("File not found");

async function addFromDialog(): Promise<LibrarySnapshot | null> {
  const win = getWindow();
  const opts = { title: "Add library folder", properties: ["openDirectory" as const] };
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
  return res.canceled || !res.filePaths[0] ? null : addFolders([res.filePaths[0]]);
}

/** Dropped paths come from the preload (real File objects), but are still re-resolved and re-stat'ed here. */
async function addDropped(paths: unknown): Promise<LibrarySnapshot> {
  if (!Array.isArray(paths) || paths.length > MAX_DROPPED) throw new Error(`Drop at most ${MAX_DROPPED} folders at a time`);
  const dirs: string[] = [];
  for (const p of paths) {
    if (typeof p !== "string" || p.length === 0) continue;
    try {
      const real = await realpath(p);
      if ((await stat(real)).isDirectory()) dirs.push(real);
    } catch { /* vanished or unreadable: not a folder we can add */ }
  }
  if (!dirs.length) throw new Error("Drop a folder to add it to the library");
  return addFolders(dirs);
}

/** Sibling realpaths are resolved a few at a time, checking for a newer click between batches. */
const RESOLVE_BATCH = 16;
/** Latest click wins: bumped by every openItem; an older one throws superseded after any await. */
let openRequest = 0;

/** The realpath of `path` if it still resolves inside `rootReal` to a video file, else null. */
async function resolveInside(rootReal: string, path: string): Promise<string | null> {
  try {
    const real = await realpath(path);
    return isInside(rootReal, real) && isSupportedExtension(real) ? real : null;
  } catch {
    return null;
  }
}

/**
 * Opens a library item by its opaque id. The id must be indexed, the file must still resolve (realpath now,
 * not at scan time) to the same id, inside its folder's realpath, with a video extension. The queue is its
 * siblings in the same directory, in natural name order, windowed to MAX_QUEUE around the item, each one
 * re-resolved the same way and queued by its realpath (the queue later opens paths without a containment
 * check). It goes through openSelectionAt so the generation, allow-set and serving rules apply.
 */
async function openItem(id: unknown): Promise<OpenResult> {
  const req = ++openRequest;
  const stillCurrent = () => { if (req !== openRequest) throw supersededError(); };
  if (!isItemId(id)) throw notFound();
  const found = lookupItem(id);
  if (!found) throw notFound();
  const { folder, item } = found;
  let rootReal: string;
  let real: string | null;
  try {
    rootReal = await realpath(folder.path);
    stillCurrent();
    real = await resolveInside(rootReal, item.path);
  } catch (e) {
    throw isSuperseded(e) ? e : notFound();
  }
  stillCurrent();
  if (!real || itemIdFor(real) !== id) throw notFound();
  const siblings = folder.items.filter((i) => i.dir === item.dir).sort((a, b) => byName.compare(a.name, b.name));
  const win = windowAround(siblings, siblings.indexOf(item), MAX_QUEUE);
  if (win.index < 0) throw notFound(); // the folder was rescanned meanwhile and `item` is no longer in it
  const paths: string[] = [];
  let index = -1;
  for (let b = 0; b < win.items.length; b += RESOLVE_BATCH) {
    const batch = win.items.slice(b, b + RESOLVE_BATCH);
    const resolved = await Promise.all(batch.map((s) => (s === item ? real : resolveInside(rootReal, s.path))));
    stillCurrent();
    batch.forEach((s, i) => {
      const p = resolved[i];
      if (!p) return;
      if (s === item) index = paths.length;
      paths.push(p);
    });
  }
  // Last look before handing over: the folder may have been removed (or the file dropped by a rescan)
  // during the awaits. A rescan that kept the file is fine; its paths were just re-verified above.
  const now = lookupItem(id);
  if (!now || now.folder !== folder) throw notFound();
  return openSelectionAt(paths, index);
}

export function registerLibraryIpc(): void {
  onLibraryChanged((s) => getWindow()?.webContents.send("library:changed", s));
  onLibraryMeta((p) => getWindow()?.webContents.send("library:meta", p));
  ipcMain.handle("library:get", () => {
    refreshIfStale();
    return snapshot();
  });
  ipcMain.handle("library:add-folder", () => addFromDialog());
  ipcMain.handle("library:add-dropped", (_e, paths: unknown) => addDropped(paths));
  ipcMain.handle("library:remove-folder", (_e, id: unknown) => removeFolder(id));
  ipcMain.on("library:rescan", () => requestRescan());
  ipcMain.handle("library:open", (_e, id: unknown) => openItem(id));
}
