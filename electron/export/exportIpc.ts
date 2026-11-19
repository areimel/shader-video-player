import { dialog, ipcMain } from "electron";
import { basename, extname, join, resolve } from "node:path";
import { appVideosDir } from "../media/outputDir";
import { probeFile } from "../media/probe";
import { currentVideoPath } from "../playback";
import { getWindow } from "../window";
import { outputSizeFor, validateExportRequest } from "./exportRequest";
import { validAudioOrdinal } from "../media/audioOrdinal";
import { startExport } from "./exportJob";

/** Resolves to the job id, or null when the user cancelled the save dialog. */
async function start(rawReq: unknown): Promise<string | null> {
  const req = validateExportRequest(rawReq);
  const path = currentVideoPath();
  if (!path) throw new Error("Open a video to export it");
  const info = await probeFile(path);
  if (!validAudioOrdinal(req.audioOrdinal, info.audioTracks)) throw new Error("Invalid audio track");
  const defaultName = `${basename(path, extname(path))}.${req.effectId}.mp4`;
  const opts = {
    title: "Export video",
    defaultPath: join(await appVideosDir(), defaultName),
    filters: [{ name: "MP4 video", extensions: ["mp4"] }],
  };
  const win = getWindow();
  const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
  if (res.canceled || !res.filePath) return null;
  const out = extname(res.filePath).toLowerCase() === ".mp4" ? res.filePath : `${res.filePath}.mp4`;
  if (resolve(out) === resolve(path)) throw new Error("Choose a different file than the source");
  const job = startExport({
    path, info,
    settings: { effectId: req.effectId, presetId: req.presetId, raw: req.values },
    size: outputSizeFor(req, { width: info.width, height: info.height }),
    audioOrdinal: req.audioOrdinal,
    out,
  });
  return job.id;
}

export function registerExportIpc(): void {
  ipcMain.handle("export:start", (_e, req: unknown) => start(req));
}
