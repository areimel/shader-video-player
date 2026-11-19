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
  it("returns null before 2 s even with a large fraction", () => {
    const e = new EtaEstimator();
    e.update(0, 0);
    expect(e.update(0.9, 1999)).toBeNull();
  });
  it("never produces negative, Infinity or NaN when the fraction goes backwards or stays flat", () => {
    const e = new EtaEstimator();
    e.update(0, 0);
    const seq: [number, number][] = [
      [0.2, 1000], [0.2, 2500], [0.2, 4000], [0.1, 5000], [0.1, 6000], [0.3, 7000], [0.3, 8000],
    ];
    for (const [f, t] of seq) {
      const eta = e.update(f, t);
      if (eta !== null) {
        expect(Number.isFinite(eta)).toBe(true);
        expect(eta).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it("stays null when progress never advances", () => {
    const e = new EtaEstimator();
    e.update(0.5, 0);
    expect(e.update(0.5, 10000)).toBeNull();
  });
  it("returns 0 at fraction 1", () => {
    const e = new EtaEstimator();
    e.update(0, 0);
    e.update(0.2, 1000);
    expect(e.update(1, 2000)).toBe(0);
  });
  it("clamps out-of-range fractions", () => {
    const e = new EtaEstimator();
    e.update(0, 0);
    e.update(0.5, 1000);
    expect(e.update(7, 3000)).toBe(0);
    expect(e.update(-3, 4000)).toBeNull(); // clamped to 0, below the 1% floor
  });
});
