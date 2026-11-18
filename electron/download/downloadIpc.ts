import { ipcMain } from "electron";
import type { Job } from "../jobs/job";
import { ensureLibraryFolder } from "../library/service";
import { appVideosDir } from "../media/outputDir";
import { currentVideoPath, playbackGeneration } from "../playback";
import { openSelection, pushSelection } from "../selection";
import { shouldAutoOpen } from "./autoOpen";
import { startDownload } from "./download";

/** A finished download shows up in the library; it also starts playing when nothing is open and the user has not opened anything since. */
function afterDownload(job: Job): void {
  const startGeneration = playbackGeneration();
  const off = job.onChange(() => {
    if (!job.finished) return;
    off();
    const path = job.outputPath;
    if (job.state !== "done" || !path) return;
    void (async () => {
      await ensureLibraryFolder(await appVideosDir()).catch(() => undefined);
      if (shouldAutoOpen(currentVideoPath(), startGeneration, playbackGeneration())) pushSelection(openSelection([path]));
    })();
  });
}

export function registerDownloadIpc(): void {
  // The URL comes from the untrusted renderer: startDownload validates it (parseVideoUrl) and throws a readable error.
  ipcMain.handle("download:start", async (_e, url: unknown): Promise<string | null> => {
    const job = startDownload(url);
    afterDownload(job);
    return job.id;
  });
}
