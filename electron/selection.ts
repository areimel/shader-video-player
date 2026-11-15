import type { OpenResult } from "../shared/types";
import { openMedia } from "./playback";
import { selectFiles } from "./queue";
import { getWindow } from "./window";

/** Registers a user selection as the queue and probes its first file for playback. */
export async function openSelection(paths: unknown): Promise<OpenResult> {
  const queue = selectFiles(paths);
  return { plan: await openMedia(queue[0].path), queue };
}

/** Pushes a selection to the renderer (CLI, second instance, menu): queue first, then the first plan. */
export function pushSelection(result: Promise<OpenResult>): void {
  result.then(
    (r) => {
      getWindow()?.webContents.send("media:queue", r.queue);
      getWindow()?.webContents.send("media:plan", r.plan);
    },
    (e: Error) => getWindow()?.webContents.send("media:error", e.message),
  );
}
