import { dialog, ipcMain } from "electron";
import { realpath, stat } from "node:fs/promises";
import type { LibrarySnapshot, OpenResult } from "../../shared/types";
import { isSupportedExtension } from "../media/formats";
import { openSelectionAt } from "../selection";
import { getWindow } from "../window";
import { isInside, isItemId, itemIdFor } from "./ids";
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

/** True when `path` still resolves inside `rootReal` (siblings are re-checked too, not just the clicked item). */
async function resolvesInside(rootReal: string, path: string): Promise<boolean> {
  try {
    return isInside(rootReal, await realpath(path));
  } catch {
    return false;
  }
}

/**
 * Opens a library item by its opaque id. The id must be indexed, the file must still resolve (realpath now,
 * not at scan time) to the same id, inside its folder's realpath, with a video extension. The queue is its
 * siblings in the same directory, in natural name order, through openSelectionAt so the usual generation,
 * queue allow-set and serving rules apply.
 */
async function openItem(id: unknown): Promise<OpenResult> {
  if (!isItemId(id)) throw notFound();
  const found = lookupItem(id);
  if (!found) throw notFound();
  const { folder, item } = found;
  let rootReal: string;
  let real: string;
  try {
    rootReal = await realpath(folder.path);
    real = await realpath(item.path);
  } catch {
    throw notFound();
  }
  if (!isInside(rootReal, real) || !isSupportedExtension(real) || itemIdFor(real) !== id) throw notFound();
  // Re-read the index after the awaits: the folder may have been rescanned or removed meanwhile.
  const now = lookupItem(id);
  if (!now) throw notFound();
  const siblings = now.folder.items.filter((i) => i.dir === now.item.dir).sort((a, b) => byName.compare(a.name, b.name));
  const ok = await Promise.all(siblings.map((s) => (s.id === id ? true : resolvesInside(rootReal, s.path))));
  const paths = siblings.filter((_s, i) => ok[i]).map((s) => (s.id === id ? real : s.path));
  return openSelectionAt(paths, paths.indexOf(real));
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
