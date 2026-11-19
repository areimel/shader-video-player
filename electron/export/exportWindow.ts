import { BrowserWindow, ipcMain, type IpcMainEvent } from "electron";
import { join } from "node:path";
import { EXPORT_CHANNELS, type ExportInit } from "../../shared/exportPage";
import { hardenContents } from "../window";

const LOAD_TIMEOUT_MS = 20_000;

/** The hidden page that renders export frames. Only messages from its own webContents are accepted. */
export interface ExportPage {
  /** Resolves when the page's script is running; rejects if it fails to load. */
  ready: Promise<void>;
  init(init: ExportInit): void;
  sendFrame(n: number, bytes: Uint8Array): void;
  end(): void;
  onPixels(cb: (n: number, bytes: Uint8Array) => void): void;
  onError(cb: (message: string) => void): void;
  close(): void;
}

export function createExportPage(): ExportPage {
  const win = new BrowserWindow({
    show: false, width: 640, height: 360,
    webPreferences: {
      preload: join(__dirname, "exportPreload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false,
    },
  });
  const wc = win.webContents;
  hardenContents(wc);

  let pixelsCb: (n: number, bytes: Uint8Array) => void = () => {};
  let errorCb: (message: string) => void = () => {};
  let closed = false;
  const mine = (e: IpcMainEvent) => !closed && e.sender === wc;

  let readyResolve: () => void = () => {};
  let readyReject: (e: Error) => void = () => {};
  const ready = new Promise<void>((res, rej) => { readyResolve = res; readyReject = rej; });
  const timer = setTimeout(() => readyReject(new Error("The export page did not start")), LOAD_TIMEOUT_MS);
  ready.then(() => clearTimeout(timer), () => clearTimeout(timer));

  const onReady = (e: IpcMainEvent) => { if (mine(e)) readyResolve(); };
  const onPixels = (e: IpcMainEvent, n: unknown, bytes: unknown) => {
    if (!mine(e) || typeof n !== "number" || !(bytes instanceof Uint8Array)) return;
    pixelsCb(n, bytes);
  };
  const onError = (e: IpcMainEvent, message: unknown) => {
    if (mine(e)) errorCb(typeof message === "string" ? message : "Export page failed");
  };
  ipcMain.on(EXPORT_CHANNELS.ready, onReady);
  ipcMain.on(EXPORT_CHANNELS.pixels, onPixels);
  ipcMain.on(EXPORT_CHANNELS.error, onError);

  wc.on("render-process-gone", (_e, d) => { const m = `The export page crashed (${d.reason})`; readyReject(new Error(m)); errorCb(m); });
  wc.on("did-fail-load", (_e, code, desc) => readyReject(new Error(`Could not load the export page: ${desc} (${code})`)));

  const dev = process.env.VITE_DEV_SERVER_URL;
  if (dev) void win.loadURL(new URL("export.html", dev).href);
  else void win.loadFile(join(__dirname, "../dist-renderer/export.html"));

  const send = (channel: string, ...args: unknown[]) => { if (!closed && !wc.isDestroyed()) wc.send(channel, ...args); };
  return {
    ready,
    init: (init) => send(EXPORT_CHANNELS.init, init),
    sendFrame: (n, bytes) => send(EXPORT_CHANNELS.frame, { n, bytes }),
    end: () => send(EXPORT_CHANNELS.end),
    onPixels: (cb) => { pixelsCb = cb; },
    onError: (cb) => { errorCb = cb; },
    close() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      ipcMain.removeListener(EXPORT_CHANNELS.ready, onReady);
      ipcMain.removeListener(EXPORT_CHANNELS.pixels, onPixels);
      ipcMain.removeListener(EXPORT_CHANNELS.error, onError);
      if (!win.isDestroyed()) win.destroy();
    },
  };
}
