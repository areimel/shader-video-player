import { describe, expect, it } from "vitest";
import { deriveCrt } from "../../renderer/shader/effects/crt/derive";
import { CRT_PARAMS, FIT, MASK } from "../../renderer/shader/effects/crt/params";
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
  it("fades scanlines to zero below 2 px per line and full above 2.5", () => {
    expect(derive({ virtualLines: 4 }).scanlineFade).toBe(0); // 1080/576 = 1.9
    expect(derive({ virtualLines: 1 }).scanlineFade).toBe(1); // 4.5
    const mid = derive({ virtualLines: 3 }).scanlineFade; // 2.25
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe("deriveCrt: mask width", () => {
  it("snaps to the supported widths", () => {
    expect(derive({ maskTVL: 350 }).maskWidth).toBe(3);
    expect(derive({ maskTVL: 900 }).maskWidth).toBe(2);
    expect(derive({ maskTVL: 350 }, { width: 3840, height: 2160 }).maskWidth).toBe(6);
    for (const tvl of [250, 400, 600, 900]) expect([2, 3, 4, 6]).toContain(derive({ maskTVL: tvl }).maskWidth);
  });
  it("uses an explicit width verbatim", () => {
    expect(derive({ maskWidth: 3 }).maskWidth).toBe(4);
  });
});

describe("deriveCrt: tube rect and content scale", () => {
  it("fits the tube inside the viewport", () => {
    const d = derive({});
    expect(d.tubeW).toBeCloseTo(0.75);
    expect(d.tubeH).toBeCloseTo(1);
    const wide = derive({ tubeAspect: 1 });
    expect(wide.tubeW).toBe(1);
    expect(wide.tubeH).toBeCloseTo(1);
  });
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

describe("deriveCrt: exposure and cutoffs", () => {
  it("is exactly 1 when nothing darkens the picture", () => {
    expect(derive({ maskType: MASK.none, scanlineStrength: 0 }).exposure).toBeCloseTo(1, 10);
  });
  it("is 1 when compensation is off", () => {
    expect(derive({ autoExposure: 0 }).exposure).toBe(1);
  });
  it("is above 1 with a mask and scanlines", () => {
    expect(derive({}).exposure).toBeGreaterThan(1);
  });
  it("grows with compensation amount", () => {
    expect(derive({ autoExposure: 1 }).exposure).toBeGreaterThan(derive({ autoExposure: 0.4 }).exposure);
  });
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
