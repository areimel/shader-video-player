import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { PlayerBridge, PlaybackPlan, QueueItem } from "../shared/types";

function listen<T>(channel: string, cb: (v: T) => void): () => void {
  const handler = (_e: unknown, v: T) => cb(v);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const bridge: PlayerBridge = {
  openDialog: () => ipcRenderer.invoke("media:open-dialog"),
  openDropped: (ps) => ipcRenderer.invoke("media:open-dropped", ps),
  openQueued: (p) => ipcRenderer.invoke("media:open-queued", p),
  openRecent: (p) => ipcRenderer.invoke("media:open-recent", p),
  restart: (s, a) => ipcRenderer.invoke("media:restart", s, a),
  forceTranscode: (s) => ipcRenderer.invoke("media:restart", s, 0),
  getSubtitle: (o, off) => ipcRenderer.invoke("media:subtitle", o, off),
  findSubtitles: () => ipcRenderer.invoke("subtitle:siblings"),
  pickSubtitle: () => ipcRenderer.invoke("subtitle:pick"),
  loadDroppedSubtitle: (p) => ipcRenderer.invoke("subtitle:load-dropped", p),
  getExternalSubtitle: (id, off) => ipcRenderer.invoke("subtitle:external", id, off),
  getRecents: () => ipcRenderer.invoke("media:recents"),
  reveal: (p) => ipcRenderer.send("media:reveal", p),
  setPlaying: (on) => ipcRenderer.send("media:playing", on),
  closeMedia: () => ipcRenderer.send("media:close"),
  pathForFile: (f) => webUtils.getPathForFile(f),
  onPlan: (cb) => listen<PlaybackPlan>("media:plan", cb),
  onQueue: (cb) => listen<QueueItem[]>("media:queue", cb),
  onError: (cb) => listen<string>("media:error", cb),
  ready: () => ipcRenderer.send("app:ready"),
};

contextBridge.exposeInMainWorld("player", bridge);
