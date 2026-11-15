import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildExternalSubtitleArgs, buildSubtitleArgs } from "./ffmpegArgs";
import { ffmpegPath } from "./binaries";
import { spawnTracked } from "./processes";
import { CACHE_ROOT } from "./session";

/** Runs ffmpeg with the args built for a temp output path and returns the WebVTT text. */
function runToVtt(buildArgs: (out: string) => string[]): Promise<string> {
  mkdirSync(CACHE_ROOT, { recursive: true });
  const dir = mkdtempSync(join(CACHE_ROOT, "sub-"));
  const out = join(dir, "sub.vtt");
  return new Promise((resolve, reject) => {
    const child = spawnTracked(ffmpegPath(), buildArgs(out));
    const cleanup = () => rmSync(dir, { recursive: true, force: true });
    child.on("error", (e) => { cleanup(); reject(e); });
    child.on("exit", (code) => {
      try {
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
  return runToVtt((out) => buildSubtitleArgs(input, ordinal, startSec, out));
}

export function convertExternalSubtitle(
  input: string, demuxer: string, startSec: number,
): Promise<string> {
  return runToVtt((out) => buildExternalSubtitleArgs(input, demuxer, startSec, out));
}
