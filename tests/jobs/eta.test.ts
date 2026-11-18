import { describe, expect, it } from "vitest";
import { EtaEstimator } from "../../electron/jobs/eta";

describe("EtaEstimator", () => {
  it("is null before 2 s or 1%", () => {
    const e = new EtaEstimator();
    expect(e.update(0, 0)).toBeNull();
    expect(e.update(0.5, 1000)).toBeNull();
    const e2 = new EtaEstimator();
    e2.update(0, 0);
    expect(e2.update(0.005, 5000)).toBeNull();
  });
  it("estimates steady progress", () => {
    const e = new EtaEstimator();
    e.update(0, 0);
    let eta: number | null = null;
    for (let t = 1000; t <= 5000; t += 1000) eta = e.update(t / 20000, t);
    expect(eta).toBeCloseTo(15, 0);
  });
  it("never goes negative and handles completion", () => {
    const e = new EtaEstimator();
    e.update(0, 0);
    e.update(0.5, 3000);
    expect(e.update(1, 4000)).toBe(0);
    expect(e.update(0.9, 5000)).toBeGreaterThanOrEqual(0);
  });
});
