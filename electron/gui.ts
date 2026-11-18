import { app, ipcMain } from "electron";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { registerIpc } from "./ipc";
import { buildMenu } from "./menu";
import { isSupportedExtension } from "./media/formats";
import { cleanCacheRoot } from "./media/session";
import { killAll } from "./media/processes";
import type { OpenResult } from "../shared/types";
import { closeMedia } from "./playback";
import { openSelection, pushSelection } from "./selection";
import { setPreventSleep } from "./powerSave";
import { registerProtocol } from "./protocol";
import { setupDevCapture } from "./devCapture";
import { ensureLibraryFolder, refreshIfStale, startLibrary, stopLibrary } from "./library/service";
import { createWindow, getWindow } from "./window";
import { cancelAll } from "./jobs/registry";
import { appVideosDir } from "./media/outputDir";
import { parseCli } from "./cli/args";

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

/** Existing, supported files, resolved. Anything else is dropped. */
export function existingVideoFiles(paths: string[]): string[] {
  return paths.filter((a) => existsSync(a) && isSupportedExtension(a)).map((a) => resolve(a));
}

/** Files a (second) instance was started with on the command line. */
export function cliFiles(argv: string[]): string[] {
  const parsed = parseCli(argv, app.isPackaged);
  return parsed.kind === "gui" ? existingVideoFiles(parsed.files) : [];
}

/** `additionalData` of a second-instance event: untrusted shape, so validated. */
function handoffFiles(data: unknown): string[] | null {
  if (typeof data !== "object" || data === null) return null;
  const files = (data as { files?: unknown }).files;
  if (!Array.isArray(files) || !files.every((f) => typeof f === "string")) return null;
  return existingVideoFiles(files as string[]);
}

/** A CLI download hands over with this flag so its folder is in the library (the CLI itself never touches it). */
function wantsDownloadsFolder(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as { registerDownloads?: unknown }).registerDownloads === true;
}

function registerDownloadsFolder(): void {
  void appVideosDir().then(ensureLibraryFolder).catch(() => undefined);
}

export function shutdown(): void {
  stopLibrary(); // before killAll: stops watchers and the probe queue, and writes the metadata cache
  closeMedia();
  setPreventSleep(false);
  cancelAll();
  killAll();
  cleanCacheRoot();
}

/** Normal start. The caller already holds the single-instance lock and applied the GPU flags. */
export function startGui(launchFiles: string[], opts: { registerDownloads?: boolean } = {}): void {
  // open-file can fire before ready; it is queued until the renderer asks.
  app.on("open-file", (e, path) => { e.preventDefault(); openInWindow([path]); });
  app.on("second-instance", (_e, argv, _cwd, additionalData) => {
    const files = handoffFiles(additionalData) ?? cliFiles(argv);
    if (files.length) openInWindow(files);
    if (wantsDownloadsFolder(additionalData)) registerDownloadsFolder();
  });
  app.on("before-quit", shutdown);
  app.on("window-all-closed", () => app.quit());
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => { shutdown(); app.exit(0); });
  }

  cleanCacheRoot();
  if (launchFiles.length) openInWindow(launchFiles);

  void app.whenReady().then(() => {
    registerProtocol();
    registerIpc();
    startLibrary();
    if (opts.registerDownloads) registerDownloadsFolder();
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
