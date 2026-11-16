import { resolve } from "node:path";
import { isSuperseded } from "../shared/superseded";
import type { OpenResult, QueueItem } from "../shared/types";
import { openMedia } from "./playback";
import { appendToQueue, commitQueue, selectFiles } from "./queue";
import { getWindow } from "./window";

/**
 * Probes the selection in order and commits it as the queue once an item actually opens, so a broken
 * file never replaces the current queue. Items before the first one that opened stay in the queue.
 */
export function openSelection(paths: unknown): Promise<OpenResult> {
  return openSelectionAt(paths, 0);
}

/**
 * Like `openSelection`, but playback starts at `paths[index]` (the library opens a file with its folder
 * siblings as the queue). If that item was dropped by validation or fails to open, later items are tried
 * in order; earlier items stay in the queue but are never opened instead. A superseded open is rethrown
 * at once, and the queue is committed only after an item actually opened.
 */
export async function openSelectionAt(paths: unknown, index: number): Promise<OpenResult> {
  if (!Array.isArray(paths) || !Number.isInteger(index) || index < 0 || index >= paths.length) {
    throw new Error("File not found");
  }
  const queue = selectFiles(paths);
  // selectFiles may drop entries, so find the start by path rather than by position.
  const later = new Set(paths.slice(index).filter((p): p is string => typeof p === "string").map((p) => resolve(p)));
  const start = queue.findIndex((q) => later.has(q.path));
  if (start < 0) throw new Error("File not found");
  let failure: unknown;
  for (let i = start; i < queue.length; i++) {
    try {
      const plan = await openMedia(queue[i].path);
      commitQueue(queue);
      return { plan, queue, index: i };
    } catch (e) {
      if (isSuperseded(e)) throw e;
      failure ??= e;
    }
  }
  throw failure;
}

/** Validates a selection and adds it to the current allow-set (nothing is probed until an item plays). */
export function queueSelection(paths: unknown): QueueItem[] {
  return appendToQueue(selectFiles(paths));
}

/** Pushes a selection to the renderer (CLI, second instance, menu): queue first, then the first plan. */
export function pushSelection(result: Promise<OpenResult>): void {
  result.then(
    (r) => {
      getWindow()?.webContents.send("media:queue", { queue: r.queue, index: r.index });
      getWindow()?.webContents.send("media:plan", r.plan);
    },
    (e: Error) => getWindow()?.webContents.send("media:error", e.message),
  );
}
