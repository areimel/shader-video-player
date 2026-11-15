import { dialog, ipcMain } from "electron";
import type { ExternalSubtitle } from "../shared/types";
import { SUBTITLE_EXTENSIONS } from "../shared/subtitleFiles";
import { approveSubtitle, findSiblingSubtitles, loadExternalSubtitle } from "./media/externalSubtitles";
import { currentVideoPath } from "./playback";
import { getWindow } from "./window";

async function pickSubtitle(): Promise<ExternalSubtitle | null> {
  if (!currentVideoPath()) throw new Error("Open a video first");
  const win = getWindow();
  const opts = {
    properties: ["openFile" as const],
    filters: [{ name: "Subtitles", extensions: SUBTITLE_EXTENSIONS }],
  };
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
  return res.canceled || !res.filePaths[0] ? null : approveSubtitle(res.filePaths[0]);
}

export function registerSubtitleIpc(): void {
  ipcMain.handle("subtitle:siblings", () => findSiblingSubtitles(currentVideoPath()));
  ipcMain.handle("subtitle:pick", () => pickSubtitle());
  ipcMain.handle("subtitle:load-dropped", (_e, p: unknown) => {
    if (typeof p !== "string" || p.length === 0) throw new Error("File not found");
    if (!currentVideoPath()) throw new Error("Open a video first");
    return approveSubtitle(p);
  });
  ipcMain.handle("subtitle:external", (_e, id: unknown, offset: unknown) =>
    loadExternalSubtitle(id, Math.max(0, Number(offset) || 0)));
}
