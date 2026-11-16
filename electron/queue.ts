import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { QueueItem } from "../shared/types";
import { isSupportedExtension } from "./media/formats";

export const MAX_QUEUE = 2000;

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

/** Validates a user selection and returns it as queue items. Nothing is committed until a file opens. */
export function selectFiles(paths: unknown): QueueItem[] {
  if (!Array.isArray(paths)) throw new Error("File not found");
  const items = pickPlayable(paths).filter((p) => existsSync(p))
    .map((p) => ({ path: resolve(p), name: basename(p) }));
  if (!items.length) throw new Error("File not found");
  return items;
}

/** Makes `items` the current allow-set (replacing the old one); call only once one of them has opened. */
export function commitQueue(items: readonly QueueItem[]): void {
  handedOut = new Set(items.map((i) => i.path));
}

/**
 * Adds already-validated items to the allow-set without replacing it, keeping at most MAX_QUEUE paths.
 * Returns the items that are now allowed (new ones that fit, plus ones that were already there).
 */
export function appendToQueue(items: readonly QueueItem[]): QueueItem[] {
  const accepted: QueueItem[] = [];
  for (const item of items) {
    if (handedOut.has(item.path) || handedOut.size < MAX_QUEUE) {
      handedOut.add(item.path);
      accepted.push(item);
    }
  }
  return accepted;
}

/** Forgets every handed-out path (media closed). */
export function clearQueue(): void {
  handedOut = new Set();
}

export function isQueued(path: unknown): path is string {
  return typeof path === "string" && handedOut.has(path) && existsSync(path);
}
