import { app, ipcMain } from "electron";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { applyGpuFlags } from "./gpuFlags";
import { registerIpc } from "./ipc";
import { buildMenu } from "./menu";
import { isSupportedExtension } from "./media/formats";
import { cleanCacheRoot } from "./media/session";
import { killAll } from "./media/processes";
import type { OpenResult } from "../shared/types";
import { closeMedia } from "./playback";
import { openSelection, pushSelection } from "./selection";
import { setPreventSleep } from "./powerSave";
import { registerProtocol, registerScheme } from "./protocol";
import { setupDevCapture } from "./devCapture";
import { refreshIfStale, startLibrary, stopLibrary } from "./library/service";
import { createWindow, getWindow } from "./window";

applyGpuFlags();
registerScheme();

let rendererReady = false;
// Only the most recent request matters; probing starts right away so it overlaps window load.
let queued: { result: Promise<OpenResult> } | null = null;

function openInWindow(paths: string[]): void {
  const win = getWindow();
  const result = openSelection(paths);
  if (!win || !rendererReady) {
    result.catch(() => undefined);
    queued = { result };
    return;
  }
  if (win.isMinimized()) win.restore();
  win.focus();
  pushSelection(result);
}

function cliFiles(argv: string[]): string[] {
  const args = argv.slice(app.isPackaged ? 1 : 2);
  return args.filter((a) => !a.startsWith("-") && existsSync(a) && isSupportedExtension(a))
    .map((a) => resolve(a));
}

function shutdown(): void {
  stopLibrary(); // before killAll: stops watchers and the probe queue, and writes the metadata cache
  closeMedia();
  setPreventSleep(false);
  killAll();
  cleanCacheRoot();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // open-file can fire before ready; it is queued until the renderer asks.
  app.on("open-file", (e, path) => { e.preventDefault(); openInWindow([path]); });
  app.on("second-instance", (_e, argv) => {
    const files = cliFiles(argv);
    if (files.length) openInWindow(files);
  });
  app.on("before-quit", shutdown);
  app.on("window-all-closed", () => app.quit());
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => { shutdown(); app.exit(0); });
  }

  cleanCacheRoot();
  const launchFiles = cliFiles(process.argv);
  if (launchFiles.length) openInWindow(launchFiles);

  void app.whenReady().then(() => {
    registerProtocol();
    registerIpc();
    startLibrary();
    const win = createWindow(() => { rendererReady = false; });
    // Folders whose watcher failed (or that were missing) are rescanned when the user comes back.
    win.on("focus", refreshIfStale);
    setupDevCapture(win);
    ipcMain.on("app:ready", () => {
      rendererReady = true;
      if (queued) pushSelection(queued.result);
      queued = null;
    });
    buildMenu();
  });
}
