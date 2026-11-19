import { ipcMain, shell } from "electron";
import { JOB_CHANNELS, type JobOpened, type JobSnapshot } from "../../shared/jobs";
import { openSelection, pushSelection } from "../selection";
import { getWindow } from "../window";
import { allJobs, cancelJob, getJob, onJobChange } from "./registry";

const unknownJob = () => new Error("That job is no longer available");

function validId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 64;
}

/** A resume position: finite and not negative, or absent. Anything else is rejected, not clamped. */
function validStart(startSec: unknown): number | null {
  if (startSec === undefined || startSec === null) return null;
  if (typeof startSec !== "number" || !Number.isFinite(startSec) || startSec < 0) throw new Error("Invalid start position");
  return startSec;
}

/** The finished job's output path, or a throw. The path never leaves the main process. */
function finishedOutput(id: unknown): string {
  const job = validId(id) ? getJob(id) : undefined;
  if (!job) throw unknownJob();
  if (job.state !== "done" || !job.outputPath) throw new Error("That job has no file to open");
  return job.outputPath;
}

export function registerJobsIpc(): void {
  onJobChange((job) => getWindow()?.webContents.send(JOB_CHANNELS.changed, job.snapshot()));
  ipcMain.handle(JOB_CHANNELS.list, (): JobSnapshot[] => allJobs().map((j) => j.snapshot()));
  ipcMain.on(JOB_CHANNELS.cancel, (_e, id: unknown) => { if (validId(id)) cancelJob(id); });
  ipcMain.handle(JOB_CHANNELS.open, async (_e, id: unknown, startSec?: unknown): Promise<JobOpened> => {
    const start = validStart(startSec);
    const result = openSelection([finishedOutput(id)]);
    pushSelection(result); // same path as the menu: queue, then plan
    await result;
    return { startSec: start };
  });
  ipcMain.on(JOB_CHANNELS.reveal, (_e, id: unknown) => {
    try { shell.showItemInFolder(finishedOutput(id)); } catch { /* unknown or unfinished job: nothing to show */ }
  });
}
