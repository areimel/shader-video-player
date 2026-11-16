import { describe, expect, it } from "vitest";
import { deriveCrt } from "../../renderer/shader/effects/crt/derive";
import { CRT_PARAMS, FIT } from "../../renderer/shader/effects/crt/params";
import { resolveValues } from "../../renderer/shader/effects/params";

const video169 = { width: 1920, height: 1080 };
const derive = (over: Record<string, number>, viewport = { width: 1920, height: 1080 }, video = video169) =>
  deriveCrt(resolveValues(CRT_PARAMS, over), { viewport, video });

describe("deriveCrt: virtual lines (auto)", () => {
  it("picks 288 at 1080p and 1440p, 576 at 4K", () => {
    expect(derive({}).virtualLines).toBe(288);
    expect(derive({}, { width: 2560, height: 1440 }).virtualLines).toBe(288);
    expect(derive({}, { width: 3840, height: 2160 }).virtualLines).toBe(576);
  });
  it("uses the tube height, not the viewport height, when letterboxed", () => {
    // 4:3 window, 16:9 tube: tube is 1440x810 -> nothing reaches 3.5 px/line, falls back to 240.
    const d = derive({ tubeAspect: 1 }, { width: 1440, height: 1080 });
    expect(d.tubeH).toBeCloseTo(0.75);
    expect(d.virtualLines).toBe(240);
    // Same window with a 4:3 tube fills the height.
    expect(derive({}, { width: 1440, height: 1080 }).virtualLines).toBe(288);
  });
  it("respects an explicit choice", () => {
    expect(derive({ virtualLines: 3 }).virtualLines).toBe(480);
  });
});

describe("deriveCrt: content scale", () => {
  it("letterboxes 16:9 video in a 4:3 tube", () => {
    const d = derive({ contentFit: FIT.letterbox });
    expect(d.contentW).toBeCloseTo(1);
    expect(d.contentH).toBeCloseTo(0.75);
  });
  it("crops 16:9 video in a 4:3 tube", () => {
    const d = derive({ contentFit: FIT.crop });
    expect(d.contentW).toBeCloseTo(4 / 3);
    expect(d.contentH).toBeCloseTo(1);
  });
  it("stretches to fill", () => {
    const d = derive({ contentFit: FIT.stretch });
    expect([d.contentW, d.contentH]).toEqual([1, 1]);
  });
  it("pillarboxes 4:3 video in a 16:9 tube", () => {
    const d = derive({ tubeAspect: 1 }, { width: 1920, height: 1080 }, { width: 640, height: 480 });
    expect(d.contentW).toBeCloseTo(0.75);
    expect(d.contentH).toBe(1);
  });
});

describe("deriveCrt: cutoffs", () => {
  it("keeps filter cutoffs at or below Nyquist", () => {
    for (const w of [320, 754, 1440]) {
      const d = derive({ virtualWidth: w, lumaBandwidth: 6, chromaBandwidth: 2 });
      expect(d.lumaCutoff).toBeLessThanOrEqual(0.5);
      expect(d.chromaCutoff).toBeLessThanOrEqual(0.5);
      expect(d.lumaCutoff).toBeGreaterThan(0);
    }
  });
  it("rounds virtual width to an integer", () => {
    expect(derive({ virtualWidth: 754 }).virtualWidth).toBe(754);
  });
});
