import { isSuperseded } from "../../shared/superseded";
import type { JobKind } from "../../shared/jobs";
import { Job } from "./job";

/** Finished jobs stay reachable (open/reveal) up to this many; the oldest finished go first. */
export const MAX_JOBS = 20;

const jobs = new Map<string, Job>();
const listeners = new Set<(job: Job) => void>();

function prune(): void {
  for (const [id, job] of jobs) {
    if (jobs.size <= MAX_JOBS) return;
    if (job.finished) jobs.delete(id);
  }
}

/** Starts `run` at once. A throw fails the job unless it was cancelled or superseded. */
export function startJob(kind: JobKind, title: string, run: (job: Job) => Promise<void>): Job {
  const job = new Job(kind, title);
  jobs.set(job.id, job);
  prune();
  job.onChange(() => listeners.forEach((cb) => cb(job)));
  listeners.forEach((cb) => cb(job));
  Promise.resolve()
    .then(() => run(job))
    .catch((e: unknown) => {
      if (job.state === "cancelled" || isSuperseded(e)) return;
      job.fail(e instanceof Error ? e.message : String(e));
    });
  return job;
}

export const getJob = (id: string): Job | undefined => jobs.get(id);

export function cancelJob(id: string): void {
  jobs.get(id)?.cancel();
}

export function cancelAll(): void {
  jobs.forEach((j) => j.cancel());
}

export function allJobs(): Job[] {
  return [...jobs.values()];
}

export function onJobChange(cb: (job: Job) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Test hook. */
export function resetJobs(): void {
  jobs.clear();
  listeners.clear();
}
