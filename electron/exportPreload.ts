import { contextBridge, ipcRenderer } from "electron";
import { EXPORT_CHANNELS, type ExportFrame, type ExportInit, type ExportPageBridge } from "../shared/exportPage";

// Frames and pixels only. The page never learns a path and cannot reach any other channel.
const bridge: ExportPageBridge = {
  onInit: (cb) => { ipcRenderer.on(EXPORT_CHANNELS.init, (_e, init: ExportInit) => cb(init)); },
  onFrame: (cb) => { ipcRenderer.on(EXPORT_CHANNELS.frame, (_e, frame: ExportFrame) => cb(frame)); },
  onEnd: (cb) => { ipcRenderer.on(EXPORT_CHANNELS.end, () => cb()); },
  sendPixels: (n, bytes) => ipcRenderer.send(EXPORT_CHANNELS.pixels, n, bytes),
  sendError: (message) => ipcRenderer.send(EXPORT_CHANNELS.error, String(message).slice(0, 500)),
  ready: () => ipcRenderer.send(EXPORT_CHANNELS.ready),
};

contextBridge.exposeInMainWorld("svpExport", bridge);
