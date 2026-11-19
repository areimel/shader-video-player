import type { Job } from "../jobs/job";
import type { Reporter } from "./progressBar";

/**
 * Draws a job's progress until it finishes. A successful job gets a final 100% line (the last
 * reported fraction is usually a little short), then the display is ended; failures and
 * cancellations just end it. Aborting `signal` cancels the job. Resolves once the job is finished.
 */
export function watchJob(job: Job, reporter: Reporter, signal: AbortSignal, label?: string): Promise<void> {
  return new Promise((resolve) => {
    const tell = () => reporter.update(label === undefined ? job.progress : { ...job.progress, label });
    const onAbort = () => job.cancel();
    let off = () => undefined as void;
    const check = () => {
      if (!job.finished) return tell();
      off();
      signal.removeEventListener("abort", onAbort);
      if (job.state === "done") reporter.update({ fraction: 1, etaSec: 0, label: label ?? job.progress.label });
      reporter.finish();
      resolve();
    };
    off = job.onChange(check);
    signal.addEventListener("abort", onAbort);
    if (signal.aborted) onAbort();
    check();
  });
}
