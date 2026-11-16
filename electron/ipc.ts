import { dialog, ipcMain, shell } from "electron";
import { existsSync } from "node:fs";
import type { QueueItem } from "../shared/types";
import { SUPPORTED_EXTENSIONS } from "./media/formats";
import { closeMedia, currentVideoPath, openMedia, restartStream, subtitleFor } from "./playback";
import { setPreventSleep } from "./powerSave";
import { clearQueue, commitQueue, isQueued } from "./queue";
import { getRecents, isRecent } from "./recents";
import { openSelection, queueSelection } from "./selection";
import { registerLibraryIpc } from "./library/libraryIpc";
import { registerSubtitleIpc } from "./subtitleIpc";
import { registerScreenshotIpc } from "./screenshot";
import { getWindow } from "./window";

function validPath(p: unknown): p is string {
  return typeof p === "string" && p.length > 0 && existsSync(p);
}

/** The shared open dialog; resolves the chosen paths, or null when cancelled. */
async function pickVideoPaths(): Promise<string[] | null> {
  const win = getWindow();
  const opts = {
    properties: ["openFile" as const, "multiSelections" as const],
    filters: [
      { name: "Videos", extensions: SUPPORTED_EXTENSIONS },
      { name: "All files", extensions: ["*"] },
    ],
  };
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
  return res.canceled || !res.filePaths.length ? null : res.filePaths;
}

export async function showOpenDialog() {
  const paths = await pickVideoPaths();
  return paths ? openSelection(paths) : null;
}

async function showQueueDialog(): Promise<QueueItem[]> {
  const paths = await pickVideoPaths();
  return paths ? queueSelection(paths) : [];
}

export function registerIpc(): void {
  registerSubtitleIpc();
  registerScreenshotIpc();
  registerLibraryIpc();
  ipcMain.handle("media:open-dialog", () => showOpenDialog());
  ipcMain.handle("media:open-dropped", (_e, paths: unknown) => openSelection(paths));
  ipcMain.handle("media:queue-dialog", () => showQueueDialog());
  ipcMain.handle("media:queue-dropped", (_e, paths: unknown) => queueSelection(paths));
  ipcMain.handle("media:open-queued", (_e, p: unknown) => {
    if (!isQueued(p)) throw new Error("File not found");
    return openMedia(p);
  });
  ipcMain.handle("media:open-recent", async (_e, p: unknown) => {
    if (!validPath(p) || !isRecent(p)) throw new Error("File not found");
    const plan = await openMedia(p);
    // A recent becomes a one-item queue, so later append/previous can reopen it through `isQueued`.
    commitQueue([{ path: plan.info.path, name: plan.info.name }]);
    return plan;
  });
  ipcMain.handle("media:restart", (_e, start: number, audio: number) =>
    restartStream(Math.max(0, Number(start) || 0), Math.max(0, Number(audio) || 0)));
  ipcMain.handle("media:subtitle", (_e, ordinal: number, offset: number) =>
    subtitleFor(Number(ordinal) || 0, Math.max(0, Number(offset) || 0)));
  ipcMain.handle("media:recents", () => getRecents());
  ipcMain.on("media:reveal", (_e, p: unknown) => {
    if (typeof p === "string" && p === currentVideoPath()) shell.showItemInFolder(p);
  });
  ipcMain.on("media:playing", (_e, on: unknown) => setPreventSleep(on === true));
  ipcMain.on("media:close", () => { closeMedia(); clearQueue(); setPreventSleep(false); });
}
