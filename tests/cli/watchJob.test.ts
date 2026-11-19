import { describe, expect, it } from "vitest";
import { Job } from "../../electron/jobs/job";
import { watchJob } from "../../electron/cli/watchJob";
import type { ProgressUpdate, Reporter } from "../../electron/cli/progressBar";

function fakeReporter() {
  const calls: Array<ProgressUpdate | "finish"> = [];
  const r: Reporter = { update: (p) => calls.push(p), finish: () => calls.push("finish") };
  return { r, calls };
}

describe("watchJob", () => {
  it("draws a final 100% line on success, then finishes", async () => {
    const job = new Job("convert", "x");
    const { r, calls } = fakeReporter();
    const done = watchJob(job, r, new AbortController().signal, "Converting");
    job.report(0.9, "frame 9");
    job.succeed("/out.mp4", []);
    await done;
    const last = calls.slice(-2);
    expect(last[0]).toMatchObject({ fraction: 1, label: "Converting" });
    expect(last[1]).toBe("finish");
  });
  it("does not draw 100% on failure", async () => {
    const job = new Job("download", "x");
    const { r, calls } = fakeReporter();
    const done = watchJob(job, r, new AbortController().signal);
    job.fail("boom");
    await done;
    expect(calls.at(-1)).toBe("finish");
    expect(calls.some((c) => c !== "finish" && c.fraction === 1)).toBe(false);
  });
  it("cancels the job when aborted", async () => {
    const job = new Job("export", "x");
    const { r } = fakeReporter();
    const ac = new AbortController();
    const done = watchJob(job, r, ac.signal);
    ac.abort();
    await done;
    expect(job.state).toBe("cancelled");
  });
});
