import { describe, expect, it } from "vitest";
import {
  combWeights, deriveVhs, frameRect, generationScale, tapeSize, GAUSS_3DB, SPEED,
} from "../../renderer/shader/effects/vhs/derive";
import { FRAME_FIT, VHS_GROUPS, VHS_PARAMS } from "../../renderer/shader/effects/vhs/params";
import { VHS_PRESETS } from "../../renderer/shader/effects/vhs/presets";
import { defaultValues, presetProblems } from "../../renderer/shader/effects/params";
import { contentScale } from "../../renderer/shader/effects/shared/tube/derive";

const defaults = defaultValues(VHS_PARAMS);
const env = { viewport: { width: 1920, height: 1080 }, video: { width: 1920, height: 1080 } };
const derive = (over: Record<string, number> = {}, e = env) => deriveVhs({ ...defaults, ...over }, e);

describe("VHS definition", () => {
  it("has unique ids in declared groups", () => {
    const ids = VHS_PARAMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of VHS_PARAMS) expect(VHS_GROUPS, p.id).toContain(p.group);
  });
  it("has the seven presets in order, home-sp first", () => {
    expect(VHS_PRESETS.map((p) => p.id)).toEqual(["home-sp", "rental", "ep", "camcorder", "vcr-tv", "dub", "tracking"]);
  });
  it.each(VHS_PRESETS.map((p) => [p.id, p] as const))("preset %s has no problems", (_id, preset) => {
    expect(presetProblems(VHS_PARAMS, preset)).toEqual([]);
  });
});

describe("tapeSize", () => {
  it("sizes the tape raster", () => {
    expect(tapeSize(4 / 3, 1)).toEqual({ width: 640, height: 480, stride: 2 });
    expect(tapeSize(4 / 3, 0)).toEqual({ width: 640, height: 240, stride: 1 });
    expect(tapeSize(16 / 9, 1).width).toBe(854);
  });
});

describe("frameRect", () => {
  const sixteenNine = 16 / 9;
  it("keep aspect follows the video", () => {
    expect(frameRect(FRAME_FIT.keep, sixteenNine)).toEqual({ aspect: sixteenNine, pictureW: 1, pictureH: 1 });
    expect(frameRect(FRAME_FIT.keep, 4 / 3).aspect).toBeCloseTo(4 / 3);
    expect(frameRect(FRAME_FIT.keep, 9 / 16).aspect).toBe(0.5625);
    const wide = frameRect(FRAME_FIT.keep, 3);
    expect(wide.aspect).toBe(2.4);
    expect(wide.pictureH).toBeCloseTo(0.8);
  });
  it("crop and letterbox use a 4:3 frame and agree with contentScale", () => {
    const lb = frameRect(FRAME_FIT.letterbox, sixteenNine);
    expect(lb.aspect).toBeCloseTo(4 / 3);
    expect(lb.pictureW).toBeCloseTo(1);
    expect(lb.pictureH).toBeCloseTo(0.75);
    const crop = frameRect(FRAME_FIT.crop, sixteenNine);
    expect(crop.pictureW).toBeCloseTo(sixteenNine / (4 / 3));
    expect(crop.pictureH).toBeCloseTo(1);
    for (const [fit, kind] of [[FRAME_FIT.crop, "crop"], [FRAME_FIT.letterbox, "letterbox"]] as const) {
      for (const va of [sixteenNine, 4 / 3, 9 / 16]) {
        const r = frameRect(fit, va), c = contentScale(kind, va, 4 / 3);
        expect([r.pictureW, r.pictureH]).toEqual([c.w, c.h]);
      }
    }
  });
  it("falls back to 4:3 for an unknown video", () => {
    for (const fit of [0, 1, 2]) {
      for (const va of [NaN, 0, -1, Infinity]) {
        const r = frameRect(fit, va);
        expect(r.aspect).toBeCloseTo(4 / 3);
        expect([r.pictureW, r.pictureH]).toEqual([1, 1]);
      }
    }
  });
});

describe("bandwidth", () => {
  it("lumaCutoff follows the contract", () => {
    expect(derive().lumaCutoff).toBeCloseTo((3.0 * 52.6) / 640);
    expect(derive({ tapeSpeed: 1 }).lumaCutoff).toBeCloseTo(derive().lumaCutoff * SPEED[1].luma);
    expect(derive({ tapeSpeed: 2 }).lumaCutoff).toBeCloseTo(derive().lumaCutoff * SPEED[2].luma);
    expect(derive({ lumaBandwidthSP: 6.5 }).lumaCutoff).toBe(0.5);
  });
  it("generationScale", () => {
    expect(generationScale(0)).toBe(1);
    expect(generationScale(1)).toBeCloseTo(0.863, 3);
    expect(generationScale(2)).toBeCloseTo(0.799, 3);
  });
  it("subcarrier is the same in every fit", () => {
    const s = [0, 1, 2].map((f) => derive({ frameFit: f }).subcarrier);
    expect(s[1]).toBe(s[0]);
    expect(s[2]).toBe(s[0]);
    expect(s[0]).toBeCloseTo(0.2942, 4);
  });
  it("chroma sigma is clamped and consistent", () => {
    for (const tapeSpeed of [0, 1, 2]) for (const generation of [0, 3]) for (const chromaBandwidthSP of [0.2, 1.5]) {
      const d = derive({ tapeSpeed, generation, chromaBandwidthSP });
      expect(d.chromaSigma).toBeGreaterThanOrEqual(0.5);
      expect(d.chromaSigma).toBeLessThanOrEqual(6.4);
      expect(d.chromaCutoff * d.chromaSigma).toBeCloseTo(GAUSS_3DB);
    }
  });
});

describe("noise scaling", () => {
  it("scales with speed and generation", () => {
    const base = derive().lumaNoise;
    expect(derive({ tapeSpeed: 1 }).lumaNoise / base).toBeCloseTo(Math.SQRT2);
    expect(derive({ tapeSpeed: 2 }).lumaNoise / base).toBeCloseTo(Math.sqrt(3));
    expect(derive({ generation: 2 }).lumaNoise / base).toBeCloseTo(Math.sqrt(3));
    expect(derive({ generation: 3 }).chromaNoise / derive().chromaNoise).toBeCloseTo(2);
    expect(derive({ generation: 3 }).jitter / derive().jitter).toBeCloseTo(2);
  });
});

describe("artifact amounts are exact no-ops at 0", () => {
  const zero = {
    lumaNoise: 0, chromaNoise: 0, lineJitter: 0, wobble: 0, topSkew: 0, chromaDelay: 0, headSwitch: 0,
    tracking: 0, dropouts: 0, chromaSmear: 0,
  };
  it.each([0, 1, 2])("at tape speed %i", (tapeSpeed) => {
    for (const generation of [0, 2]) {
      const d = derive({ ...zero, tapeSpeed, generation });
      for (const k of ["lumaNoise", "chromaNoise", "jitter", "wobble", "topSkew", "chromaDelay", "headSwitchLines",
        "headSwitchShift", "headSwitchNoise", "tracking", "trackingRoll", "trackingShift", "dropoutProb"]) {
        expect(d[k], k).toBe(0);
      }
      expect([d.combW0, d.combW1, d.combW2]).toEqual([1, 0, 0]);
    }
  });
  it("combWeights sum to one", () => {
    for (const s of [0, 0.5, 1, 1.5, 2]) expect(combWeights(s).reduce((a, b) => a + b)).toBeCloseTo(1);
  });
});

describe("derived set", () => {
  it("includes tape, frame, OSD and tube values", () => {
    const d = derive();
    expect(d.tapeWidth).toBe(854);
    expect(d.tapeLines).toBe(480);
    expect(d.fieldStride).toBe(2);
    expect(d.osdDotW).toBe(4);
    expect(d.osdDotH).toBe(4);
    for (const k of ["tubeW", "tubeH", "scanlineFade", "maskWidth", "exposure", "frameAspect", "pictureW"]) {
      expect(Number.isFinite(d[k]), k).toBe(true);
    }
  });
  it("makes a 16:9 source a 16:9 TV with Keep aspect", () => {
    const d = derive();
    expect((d.tubeW * 1920) / (d.tubeH * 1080)).toBeCloseTo(16 / 9);
  });
  it("does not return CRT content names", () => {
    expect(derive()).not.toHaveProperty("contentW");
  });
});
