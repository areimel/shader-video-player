import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { QueueItem } from "../shared/types";
import { isSupportedExtension } from "./media/formats";

const MAX_QUEUE = 2000;

/** Paths the user selected (dialog, drop, CLI) for the current queue; only these may be opened by `openQueued`. */
let handedOut = new Set<string>();

/**
 * A lone file is always kept (the probe decides, as before); with several, entries that
 * are not a supported video extension (folders, subtitles, text) are dropped.
 */
export function pickPlayable(paths: readonly unknown[]): string[] {
  const valid = paths.filter((p): p is string => typeof p === "string" && p.length > 0).slice(0, MAX_QUEUE);
  return valid.length > 1 ? valid.filter(isSupportedExtension) : valid;
}

/** Validates a user selection, makes it the current allow-set (replacing the old one) and returns the queue. */
export function selectFiles(paths: unknown): QueueItem[] {
  if (!Array.isArray(paths)) throw new Error("File not found");
  const items = pickPlayable(paths).filter((p) => existsSync(p))
    .map((p) => ({ path: resolve(p), name: basename(p) }));
  if (!items.length) throw new Error("File not found");
  handedOut = new Set(items.map((i) => i.path));
  return items;
}

export function isQueued(path: unknown): path is string {
  return typeof path === "string" && handedOut.has(path) && existsSync(path);
}
