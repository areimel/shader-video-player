import { realpathSync } from "node:fs";
import type { MediaInfo, PlaybackPlan } from "../shared/types";
import { isSuperseded, supersededError } from "../shared/superseded";
import { allowOnly, clearAllowed } from "./allowlist";
import { addRecent } from "./recents";
import { isRemuxOnly } from "./media/ffmpegArgs";
import { nativeMime } from "./media/formats";
import { keyframeBefore, probeFile } from "./media/probe";
import { StreamSession } from "./media/session";
import { cancelSubtitleExtraction, extractSubtitle } from "./media/subtitles";

let info: MediaInfo | null = null;
let session: StreamSession | null = null;
/** Bumped by every open/restart/close; a request that finds it changed was superseded and must not return a plan. */
let generation = 0;

const stillCurrent = (gen: number): void => {
  if (gen !== generation) throw supersededError();
};

export function getStream(id: string): StreamSession | null {
  return session && session.id === id ? session : null;
}

function disposeSession(): void {
  session?.dispose();
  session = null;
}

async function transcodePlan(
  gen: number, media: MediaInfo, startSec: number, audioOrdinal: number,
): Promise<PlaybackPlan> {
  disposeSession();
  const remux = isRemuxOnly(media);
  const start = remux && startSec > 0 ? await keyframeBefore(media, startSec) : startSec;
  stillCurrent(gen);
  const next = new StreamSession(media, start, audioOrdinal);
  session = next;
  try {
    await next.start();
    stillCurrent(gen);
  } catch (e) {
    if (session === next) disposeSession();
    if (isSuperseded(e)) throw e;
    stillCurrent(gen);
    throw new Error(`This file could not be converted (${(e as Error).message})`);
  }
  return {
    info: media, mode: "transcode", url: `svp-media://stream/${next.id}`,
    mime: "video/mp4", startOffset: start, audioOrdinal, remuxOnly: remux,
  };
}

export async function openMedia(path: string): Promise<PlaybackPlan> {
  const gen = ++generation;
  // Probe first: only a file ffprobe confirms is a real video is ever opened or served.
  const probed = await probeFile(realpathSync(path));
  stillCurrent(gen);
  cancelSubtitleExtraction();
  disposeSession();
  info = probed;
  addRecent(probed.path);
  const mime = nativeMime(probed);
  if (!mime) {
    clearAllowed(); // transcodes are served by session id, never by path
    return transcodePlan(gen, probed, 0, 0);
  }
  const real = allowOnly(probed.path);
  return {
    info: probed, mode: "native", mime, startOffset: 0, audioOrdinal: 0, remuxOnly: false,
    url: `svp-media://file/${encodeURIComponent(real)}`,
  };
}

export function restartStream(startSec: number, audioOrdinal: number): Promise<PlaybackPlan> {
  if (!info) return Promise.reject(new Error("No file open"));
  clearAllowed(); // a restart means the file is no longer played natively by path
  return transcodePlan(++generation, info, startSec, audioOrdinal);
}

export function subtitleFor(ordinal: number, offsetSec: number): Promise<string> {
  if (!info) return Promise.reject(new Error("No file open"));
  return extractSubtitle(info.path, ordinal, offsetSec);
}

export function currentVideoPath(): string | null {
  return info?.path ?? null;
}

export function closeMedia(): void {
  generation++;
  cancelSubtitleExtraction();
  disposeSession();
  clearAllowed();
  info = null;
}
