import { watch, type FSWatcher } from "node:fs";

/** Long enough that copying a large file (many change events) triggers one rescan, not dozens. */
const DEBOUNCE_MS = 1500;

interface Watch {
  root: string;
  watcher: FSWatcher;
  timer: NodeJS.Timeout | null;
}

export interface WatchHandlers {
  /** Something changed below this folder (debounced). */
  onChange(folderId: string): void;
  /** The folder cannot be watched (gone, ENOSPC on inotify watches, ...); the caller falls back to polling on focus. */
  onFail(folderId: string): void;
}

const watches = new Map<string, Watch>();

/** Hidden entries are skipped by the walker, so changes inside them (thumbnail caches, temp files) are noise. */
const isHidden = (name: string) => name.split(/[\\/]/).some((part) => part.startsWith("."));

function drop(id: string): void {
  const w = watches.get(id);
  if (!w) return;
  if (w.timer) clearTimeout(w.timer);
  w.watcher.close();
  watches.delete(id);
}

/**
 * Makes the set of watchers match `folders` (root = the folder's realpath from its last scan, or null when
 * it is missing). Unchanged watchers are kept; new or failed ones are (re)tried, so a folder that comes
 * back after a fallback rescan is watched again.
 */
export function syncWatchers(folders: ReadonlyArray<{ id: string; root: string | null }>, h: WatchHandlers): void {
  const wanted = new Map(folders.map((f) => [f.id, f.root]));
  for (const [id, w] of watches) {
    if (wanted.get(id) !== w.root) drop(id);
  }
  for (const [id, root] of wanted) {
    if (watches.has(id)) continue;
    if (!root) {
      h.onFail(id);
      continue;
    }
    try {
      // persistent: false so a watcher never keeps the app alive on quit.
      const watcher = watch(root, { recursive: true, persistent: false }, (_event, name) => {
        if (typeof name === "string" && isHidden(name)) return;
        const w = watches.get(id);
        if (!w) return;
        if (w.timer) clearTimeout(w.timer);
        w.timer = setTimeout(() => { w.timer = null; h.onChange(id); }, DEBOUNCE_MS);
      });
      watcher.on("error", () => { drop(id); h.onFail(id); });
      watches.set(id, { root, watcher, timer: null });
    } catch {
      h.onFail(id);
    }
  }
}

export function isWatched(folderId: string): boolean {
  return watches.has(folderId);
}

export function stopWatchers(): void {
  for (const id of [...watches.keys()]) drop(id);
}
