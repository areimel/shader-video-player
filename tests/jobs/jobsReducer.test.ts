import { describe, expect, it } from "vitest";
import type { JobSnapshot } from "../../shared/jobs";
import { AUTO_DISMISS_MS, EMPTY_JOBS, formatEta, jobsReducer } from "../../renderer/utils/jobs";

const job = (id: string, over: Partial<JobSnapshot> = {}): JobSnapshot => ({
  id, kind: "convert", title: id, state: "running", progress: { fraction: 0.1, etaSec: 30, label: "" }, actions: [], ...over,
});

describe("jobsReducer", () => {
  it("adds, then updates in place keeping the order", () => {
    let s = jobsReducer(EMPTY_JOBS, { type: "upsert", job: job("a") });
    s = jobsReducer(s, { type: "upsert", job: job("b") });
    s = jobsReducer(s, { type: "upsert", job: job("a", { state: "done" }) });
    expect(s.jobs.map((j) => [j.id, j.state])).toEqual([["a", "done"], ["b", "running"]]);
  });
  it("dismiss removes the card and later updates do not bring it back", () => {
    let s = jobsReducer(EMPTY_JOBS, { type: "upsert", job: job("a") });
    s = jobsReducer(s, { type: "dismiss", id: "a" });
    expect(s.jobs).toEqual([]);
    expect(jobsReducer(s, { type: "upsert", job: job("a", { state: "done" }) }).jobs).toEqual([]);
  });
  it("dismissing an unknown id changes nothing", () => {
    expect(jobsReducer(EMPTY_JOBS, { type: "dismiss", id: "x" })).toBe(EMPTY_JOBS);
  });
  it("load keeps only running jobs", () => {
    const s = jobsReducer(EMPTY_JOBS, { type: "load", jobs: [job("a"), job("b", { state: "done" }), job("c", { state: "failed" })] });
    expect(s.jobs.map((j) => j.id)).toEqual(["a"]);
  });
  it("load does not duplicate a job an earlier push already added", () => {
    let s = jobsReducer(EMPTY_JOBS, { type: "upsert", job: job("a", { state: "done" }) });
    s = jobsReducer(s, { type: "load", jobs: [job("a")] });
    expect(s.jobs).toHaveLength(1);
    expect(s.jobs[0].state).toBe("done");
  });
});

describe("AUTO_DISMISS_MS", () => {
  it("expires done and cancelled cards, never running or failed ones", () => {
    expect(AUTO_DISMISS_MS.done).toBe(8000);
    expect(AUTO_DISMISS_MS.cancelled).toBe(3000);
    expect(AUTO_DISMISS_MS.running).toBeNull();
    expect(AUTO_DISMISS_MS.failed).toBeNull();
  });
});

describe("formatEta", () => {
  it("is empty when unknown", () => {
    expect(formatEta(null)).toBe("");
    expect(formatEta(NaN)).toBe("");
    expect(formatEta(-1)).toBe("");
  });
  it("words seconds, minutes and hours", () => {
    expect(formatEta(4)).toBe("a few seconds left");
    expect(formatEta(42)).toBe("about 40 sec left");
    expect(formatEta(75)).toBe("about 1 min left");
    expect(formatEta(120)).toBe("about 2 min left");
    expect(formatEta(3600)).toBe("about 1 h left");
    expect(formatEta(5400 + 600)).toBe("about 1 h 40 min left");
  });
});
