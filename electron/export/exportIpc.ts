import { dialog, ipcMain } from "electron";
import { basename, extname, join, resolve } from "node:path";
import type { ExportRequest } from "../../shared/jobs";
import { appVideosDir } from "../media/outputDir";
import { probeFile } from "../media/probe";
import { currentVideoPath } from "../playback";
import { getWindow } from "../window";
import { defaultSize, MAX_DIM, MIN_DIM, sizeAtHeight, TARGET_HEIGHT, type Size } from "./exportArgs";
import { startExport } from "./exportJob";

const MAX_VALUES = 512;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isDim = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 100_000;

/** The renderer is untrusted: every field is checked here, and unknown ones are dropped. */
export function validateExportRequest(req: unknown): ExportRequest {
  if (!isRecord(req)) throw new Error("Invalid export request");
  const { effectId, presetId, values, size, windowSize } = req;
  if (typeof effectId !== "string" || effectId.length === 0 || effectId.length > 64) throw new Error("Invalid effect");
  if (presetId !== null && (typeof presetId !== "string" || presetId.length > 64)) throw new Error("Invalid preset");
  if (!isRecord(values)) throw new Error("Invalid settings");
  const entries = Object.entries(values);
  if (entries.length > MAX_VALUES) throw new Error("Invalid settings");
  const clean: Record<string, number> = {};
  for (const [k, v] of entries) {
    if (k.length > 64 || typeof v !== "number" || !Number.isFinite(v)) throw new Error("Invalid settings");
    clean[k] = v;
  }
  if (size !== "source" && size !== "1080p" && size !== "window") throw new Error("Invalid size");
  const out: ExportRequest = { effectId, presetId, values: clean, size };
  if (size === "window") {
    if (!isRecord(windowSize) || !isDim(windowSize.width) || !isDim(windowSize.height)) throw new Error("Invalid window size");
    out.windowSize = { width: windowSize.width, height: windowSize.height };
  }
  return out;
}

const evenClamp = (n: number): number => Math.min(MAX_DIM, Math.max(MIN_DIM, Math.round(n / 2) * 2));

/** Output size for a request, given the source's size. */
export function outputSizeFor(req: ExportRequest, src: Size): Size {
  if (req.size === "1080p") return sizeAtHeight(src.width / src.height, TARGET_HEIGHT);
  if (req.size === "window" && req.windowSize) return { width: evenClamp(req.windowSize.width), height: evenClamp(req.windowSize.height) };
  return defaultSize(src);
}

/** Resolves to the job id, or null when the user cancelled the save dialog. */
async function start(rawReq: unknown): Promise<string | null> {
  const req = validateExportRequest(rawReq);
  const path = currentVideoPath();
  if (!path) throw new Error("Open a video to export it");
  const info = await probeFile(path);
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
    audioOrdinal: info.audioTracks[0]?.ordinal ?? 0, // the player's selected track is not tracked in main
    out,
  });
  return job.id;
}

export function registerExportIpc(): void {
  ipcMain.handle("export:start", (_e, req: unknown) => start(req));
}
