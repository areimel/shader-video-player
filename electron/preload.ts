import { contextBridge, ipcRenderer, webUtils } from "electron";
import { isCommandId } from "../shared/commands";
import type { LibraryMetaPatch, LibrarySnapshot, PlayerBridge, PlaybackPlan, QueueItem } from "../shared/types";

function listen<T>(channel: string, cb: (v: T) => void): () => void {
  const handler = (_e: unknown, v: T) => cb(v);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

// Dropped files are resolved to paths here, in the isolated preload world, from real File objects.
// The page never passes path strings for drops, so it cannot name arbitrary files. Anything that is
// not a genuine File (or has no backing path) is dropped.
function droppedPaths(files: unknown): string[] {
  const out: string[] = [];
  if (!Array.isArray(files)) return out;
  for (let i = 0; i < files.length; i++) {
    const f: unknown = files[i];
    if (!(f instanceof File)) continue;
    const path = webUtils.getPathForFile(f);
    if (path) out.push(path);
  }
  return out;
}

const bridge: PlayerBridge = {
  openDialog: () => ipcRenderer.invoke("media:open-dialog"),
  openDropped: (files) => ipcRenderer.invoke("media:open-dropped", droppedPaths(files)),
  addToQueueDialog: () => ipcRenderer.invoke("media:queue-dialog"),
  queueDropped: (files) => ipcRenderer.invoke("media:queue-dropped", droppedPaths(files)),
  openQueued: (p) => ipcRenderer.invoke("media:open-queued", p),
  openRecent: (p) => ipcRenderer.invoke("media:open-recent", p),
  restart: (s, a) => ipcRenderer.invoke("media:restart", s, a),
  forceTranscode: (s) => ipcRenderer.invoke("media:restart", s, 0),
  getSubtitle: (o, off) => ipcRenderer.invoke("media:subtitle", o, off),
  findSubtitles: () => ipcRenderer.invoke("subtitle:siblings"),
  pickSubtitle: () => ipcRenderer.invoke("subtitle:pick"),
  loadDroppedSubtitle: (file) => ipcRenderer.invoke("subtitle:load-dropped", droppedPaths([file])[0] ?? ""),
  getExternalSubtitle: (id, off) => ipcRenderer.invoke("subtitle:external", id, off),
  getRecents: () => ipcRenderer.invoke("media:recents"),
  saveScreenshot: (png, name) => ipcRenderer.invoke("screenshot:save", png, name),
  reveal: (p) => ipcRenderer.send("media:reveal", p),
  setPlaying: (on) => ipcRenderer.send("media:playing", on),
  closeMedia: () => ipcRenderer.send("media:close"),
  onPlan: (cb) => listen<PlaybackPlan>("media:plan", cb),
  onQueue: (cb) => listen<{ queue: QueueItem[]; index: number }>("media:queue", (v) => cb(v.queue, v.index)),
  onError: (cb) => listen<string>("media:error", cb),
  onCommand: (cb) => listen<unknown>("menu:command", (id) => { if (isCommandId(id)) cb(id); }),
  getLibrary: () => ipcRenderer.invoke("library:get"),
  addLibraryFolder: () => ipcRenderer.invoke("library:add-folder"),
  addLibraryDropped: (files) => ipcRenderer.invoke("library:add-dropped", droppedPaths(files)),
  removeLibraryFolder: (id) => ipcRenderer.invoke("library:remove-folder", id),
  rescanLibrary: () => ipcRenderer.send("library:rescan"),
  openLibraryItem: (id) => ipcRenderer.invoke("library:open", id),
  onLibrary: (cb) => listen<LibrarySnapshot>("library:changed", cb),
  onLibraryMeta: (cb) => listen<LibraryMetaPatch[]>("library:meta", cb),
  platform: process.platform,
  ready: () => ipcRenderer.send("app:ready"),
};

contextBridge.exposeInMainWorld("player", bridge);
