import { describe, expect, it } from "vitest";
import { cutoffCycles, subcarrierCycles } from "../../renderer/shader/effects/shared/signal";

describe("shared signal frequencies", () => {
  it("computes the subcarrier in cycles per sample", () => {
    expect(subcarrierCycles(754)).toBe(3.579545 * (52.6 / 754));
  });
  it("clamps cutoffs to Nyquist", () => {
    expect(cutoffCycles(6, 400)).toBe(0.5);
  });
  it("scales cutoffs by MHz", () => {
    expect(cutoffCycles(1, 754)).toBe(52.6 / 754);
  });
});
