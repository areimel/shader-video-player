import { isSuperseded } from "../shared/superseded";
import type { OpenResult, QueueItem } from "../shared/types";
import { openMedia } from "./playback";
import { appendToQueue, commitQueue, selectFiles } from "./queue";
import { getWindow } from "./window";

/**
 * Probes the selection in order and commits it as the queue once an item actually opens, so a broken
 * file never replaces the current queue. Items before the first one that opened stay in the queue.
 */
export async function openSelection(paths: unknown): Promise<OpenResult> {
  const queue = selectFiles(paths);
  let failure: unknown;
  for (let index = 0; index < queue.length; index++) {
    try {
      const plan = await openMedia(queue[index].path);
      commitQueue(queue);
      return { plan, queue, index };
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
