import { isAbsolute } from "node:path";
import { PROGRESS_TAG } from "./ytdlpArgs";

export type DownloadStage = "video" | "audio" | "merging";

export type DownloadEvent =
  | { kind: "progress"; fraction: number | null; etaSec: number | null }
  | { kind: "stage"; stage: DownloadStage }
  | { kind: "path"; path: string }
  | { kind: "other" };

const num = (s: string | undefined): number | null => {
  if (s === undefined || s === "NA" || s === "None") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** One yt-dlp stdout line: our progress line, `[download] Destination:` (a new stream), `[Merger]`, or the printed final path. */
export function parseLine(line: string): DownloadEvent {
  const l = line.trim();
  if (l.startsWith(PROGRESS_TAG + " ")) {
    const [, done, total, eta] = l.split(/\s+/);
    const d = num(done);
    const t = num(total);
    return { kind: "progress", fraction: d !== null && t ? Math.min(1, d / t) : null, etaSec: num(eta) };
  }
  if (l.startsWith("[download] Destination:")) return { kind: "stage", stage: "video" }; // refined by the tracker
  if (l.startsWith("[Merger]") || l.startsWith("[VideoRemuxer]")) return { kind: "stage", stage: "merging" };
  if (l && !l.startsWith("[") && isAbsolute(l)) return { kind: "path", path: l };
  return { kind: "other" };
}

/** Share of the bar given to the first stream (video); audio takes most of the rest, merging the end. */
const FIRST_STREAM_SHARE = 0.9;
const AUDIO_END = 0.99;

export interface TrackerUpdate { fraction: number | null; label: DownloadStage; etaSec: number | null }

export interface DownloadTracker {
  /** Feeds a line; returns the job update when the line changes it. */
  push(line: string): TrackerUpdate | null;
  /** Last printed final path. */
  readonly path: string | null;
}

/**
 * yt-dlp downloads a video and an audio stream as separate files, each with its own 0..100 %. The first
 * destination is labelled video, the second audio; the bar maps them onto one 0..1 range.
 */
export function createTracker(): DownloadTracker {
  let streams = 0;
  let stage: DownloadStage = "video";
  let last: number | null = null;
  let path: string | null = null;
  return {
    get path() { return path; },
    push(line) {
      const ev = parseLine(line);
      if (ev.kind === "path") { path = ev.path; return null; }
      if (ev.kind === "stage") {
        if (ev.stage === "merging") stage = "merging";
        else { streams++; stage = streams === 1 ? "video" : "audio"; }
        last = stage === "merging" ? AUDIO_END : stage === "audio" ? FIRST_STREAM_SHARE : 0;
        return { fraction: last, label: stage, etaSec: null };
      }
      if (ev.kind === "progress") {
        if (ev.fraction !== null) {
          last = stage === "audio"
            ? FIRST_STREAM_SHARE + ev.fraction * (AUDIO_END - FIRST_STREAM_SHARE)
            : ev.fraction * FIRST_STREAM_SHARE;
        }
        return { fraction: last, label: stage, etaSec: ev.etaSec };
      }
      return null;
    },
  };
}
