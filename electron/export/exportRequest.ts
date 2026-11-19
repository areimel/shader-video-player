import type { ExportRequest } from "../../shared/jobs";
import { defaultSize, MAX_DIM, MIN_DIM, sizeAtHeight, TARGET_HEIGHT, type Size } from "./exportArgs";

const MAX_VALUES = 512;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isDim = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 100_000;

/** The renderer is untrusted: every field is checked here, and unknown ones are dropped. */
export function validateExportRequest(req: unknown): ExportRequest {
  if (!isRecord(req)) throw new Error("Invalid export request");
  const { effectId, presetId, values, size, windowSize, audioOrdinal } = req;
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
  if (typeof audioOrdinal !== "number" || !Number.isInteger(audioOrdinal) || audioOrdinal < 0 || audioOrdinal > 1000) throw new Error("Invalid audio track");
  const out: ExportRequest = { effectId, presetId, values: clean, size, audioOrdinal };
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
