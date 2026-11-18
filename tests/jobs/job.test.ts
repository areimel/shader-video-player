import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Job } from "../../electron/jobs/job";
import { cancelAll, getJob, onJobChange, resetJobs, startJob } from "../../electron/jobs/registry";
import { supersededError } from "../../shared/superseded";

beforeEach(() => { vi.useFakeTimers(); resetJobs(); });
afterEach(() => vi.useRealTimers());

describe("Job", () => {
  it("throttles progress events to 10/s", () => {
    const j = new Job("convert", "a");
    const cb = vi.fn();
    j.onChange(cb);
    for (let i = 0; i < 100; i++) { j.report(i / 100); vi.advanceTimersByTime(5); }
    expect(cb.mock.calls.length).toBeLessThanOrEqual(6);
    expect(j.progress.fraction).toBeCloseTo(0.99);
  });
  it("keeps the output path out of the snapshot", () => {
    const j = new Job("export", "a");
    j.succeed("/secret/out.mp4", ["open", "reveal"]);
    expect(JSON.stringify(j.snapshot())).not.toContain("secret");
    expect(j.snapshot()).toMatchObject({ state: "done", actions: ["open", "reveal"] });
  });
  it("runs cleanups on cancel only, once", () => {
    const j = new Job("download", "a");
    const fn = vi.fn();
    j.onCancel(fn);
    j.cancel(); j.cancel();
    expect(fn).toHaveBeenCalledTimes(1);
    j.succeed("/x", []);
    expect(j.state).toBe("cancelled");
    const k = new Job("download", "b");
    const g = vi.fn();
    k.onCancel(g);
    k.succeed("/x", []);
    k.cancel();
    expect(g).not.toHaveBeenCalled();
  });
});

describe("registry", () => {
  it("fails the job when run throws", async () => {
    const j = startJob("convert", "a", async () => { throw new Error("boom"); });
    await vi.advanceTimersByTimeAsync(0);
    expect(j.snapshot()).toMatchObject({ state: "failed", error: "boom" });
    expect(getJob(j.id)).toBe(j);
  });
  it("ignores errors after cancel or supersede", async () => {
    const a = startJob("convert", "a", async (job) => { job.cancel(); throw new Error("killed"); });
    const b = startJob("convert", "b", async () => { throw supersededError(); });
    await vi.advanceTimersByTimeAsync(0);
    expect(a.state).toBe("cancelled");
    expect(b.state).toBe("running");
  });
  it("notifies listeners and cancelAll cancels", async () => {
    const cb = vi.fn();
    const off = onJobChange(cb);
    const j = startJob("export", "a", () => new Promise(() => {}));
    expect(cb).toHaveBeenCalled();
    cancelAll();
    expect(j.state).toBe("cancelled");
    off();
  });
});
