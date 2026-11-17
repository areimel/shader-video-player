import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { supersededError } from "../../shared/superseded";
import { buildExternalSubtitleArgs, buildSubtitleArgs } from "./ffmpegArgs";
import { ffmpegPath } from "./binaries";
import { killProcess, spawnTracked } from "./processes";
import { PROCESS_ROOT } from "./session";

/** The one embedded-track extraction in flight; it reads the whole file, so a newer request or a close kills it. */
let active: { cancel(): void } | null = null;

export function cancelSubtitleExtraction(): void {
  active?.cancel();
}

/** Runs ffmpeg with the args built for a temp output path and returns the WebVTT text. */
function runToVtt(buildArgs: (out: string) => string[], cancellable = false): Promise<string> {
  mkdirSync(PROCESS_ROOT, { recursive: true });
  const dir = mkdtempSync(join(PROCESS_ROOT, "sub-"));
  const out = join(dir, "sub.vtt");
  return new Promise((resolve, reject) => {
    const child = spawnTracked(ffmpegPath(), buildArgs(out));
    let cancelled = false;
    const job = { cancel() { cancelled = true; killProcess(child); } };
    if (cancellable) active = job;
    const cleanup = () => {
      if (active === job) active = null;
      rmSync(dir, { recursive: true, force: true });
    };
    child.on("error", (e) => { cleanup(); reject(e); });
    child.on("exit", (code) => {
      try {
        if (cancelled) throw supersededError();
        if (code !== 0) throw new Error("Could not extract subtitles");
        resolve(readFileSync(out, "utf8"));
      } catch (e) {
        reject(e);
      } finally {
        cleanup();
      }
    });
  });
}

export function extractSubtitle(input: string, ordinal: number, startSec: number): Promise<string> {
  cancelSubtitleExtraction();
  return runToVtt((out) => buildSubtitleArgs(input, ordinal, startSec, out), true);
}

export function convertExternalSubtitle(
  input: string, demuxer: string, startSec: number,
): Promise<string> {
  return runToVtt((out) => buildExternalSubtitleArgs(input, demuxer, startSec, out));
}
