import { readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { ExternalSubtitle } from "../../shared/types";
import { SUBTITLE_DEMUXERS, isSubtitlePath, matchSiblingSubtitles } from "../../shared/subtitleFiles";
import { extensionOf } from "./formats";
import { convertExternalSubtitle } from "./subtitles";

const MAX_BYTES = 10 * 1024 * 1024;

/** Approved files by opaque id: the renderer can only ever ask for files the main process registered. */
const approved = new Map<string, string>();
const idByPath = new Map<string, string>();
let counter = 0;

/** Validates a user-chosen or sibling file and registers it. Throws if it is not an acceptable subtitle file. */
export function approveSubtitle(path: string): ExternalSubtitle {
  const real = realpathSync(path);
  if (!isSubtitlePath(real)) throw new Error("Unsupported subtitle format");
  const st = statSync(real);
  if (!st.isFile() || st.size > MAX_BYTES) throw new Error("Not a usable subtitle file");
  let id = idByPath.get(real);
  if (!id) {
    id = `sub${++counter}`;
    idByPath.set(real, id);
    approved.set(id, real);
  }
  return { id, name: basename(real) };
}

/** Siblings of the open video; replaces earlier approvals so stale ids from a previous video stop working. */
export function findSiblingSubtitles(videoPath: string | null): ExternalSubtitle[] {
  approved.clear();
  idByPath.clear();
  if (!videoPath) return [];
  const dir = realpathSync(dirname(videoPath));
  const out: ExternalSubtitle[] = [];
  for (const name of matchSiblingSubtitles(videoPath, readdirSync(dir))) {
    try {
      // Skip symlinks that leave the video's folder.
      if (dirname(realpathSync(join(dir, name))) !== dir) continue;
      out.push(approveSubtitle(join(dir, name)));
    } catch { /* unreadable or oversized: not offered */ }
  }
  return out;
}

export function loadExternalSubtitle(id: unknown, offsetSec: number): Promise<string> {
  const path = typeof id === "string" ? approved.get(id) : undefined;
  if (!path) return Promise.reject(new Error("Subtitle file is not available"));
  return convertExternalSubtitle(path, SUBTITLE_DEMUXERS[extensionOf(path)], offsetSec);
}
