import { describe, expect, it } from "vitest";
import { vhsEffect } from "../../renderer/shader/effects/vhs";
import { clampChromaDelay, deriveVhs, fitOsdDotW } from "../../renderer/shader/effects/vhs/derive";
import { FRAME_FIT, OSD_MODE, TAPE_LINES_CHOICE, TAPE_SPEED, VHS_PARAMS } from "../../renderer/shader/effects/vhs/params";
import { VHS_PASSES } from "../../renderer/shader/effects/vhs/pipeline";
import { defaultValues } from "../../renderer/shader/effects/params";

const defaults = defaultValues(VHS_PARAMS);
const env = (w: number, h: number) => ({ viewport: { width: 1920, height: 1080 }, video: { width: w, height: h } });
const derive = (over: Record<string, number> = {}, w = 1920, h = 1080) => deriveVhs({ ...defaults, ...over }, env(w, h));

describe("VHS definition", () => {
  it("requires float render targets", () => {
    expect(vhsEffect.requiresFloat).toBe(true);
  });
  it("runs its passes in order", () => {
    expect(VHS_PASSES.map((p) => p.id)).toEqual([
      "frame", "tapeH", "tapeV", "signalEncode", "signalDecode",
      "linearize", "glowH", "glowV", "diffuseDown", "diffuseUp", "main",
    ]);
  });
});

describe("pass enabled predicates", () => {
  const on = (id: string, values: Record<string, number>) => {
    const pass = VHS_PASSES.find((p) => p.id === id)!;
    return pass.enabled ? (pass.enabled as (v: Record<string, number>) => boolean)(values) : true;
  };
  const base = { p_connection: 1, p_tv: 0, p_glow: 0, p_halation: 0, p_diffusion: 0 };

  it("composite passes follow the connection", () => {
    for (const id of ["signalEncode", "signalDecode"]) {
      expect(on(id, { ...base, p_connection: 1 }), id).toBe(true);
      expect(on(id, { ...base, p_connection: 0 }), id).toBe(false);
      expect(on(id, { ...base, p_connection: 0, p_tv: 1 }), id).toBe(false);
    }
  });
  it("tube passes need the TV", () => {
    expect(on("linearize", base)).toBe(false);
    expect(on("linearize", { ...base, p_tv: 1 })).toBe(true);
  });
  it("glow passes also need glow", () => {
    for (const id of ["glowH", "glowV"]) {
      expect(on(id, { ...base, p_tv: 1 }), id).toBe(false);
      expect(on(id, { ...base, p_glow: 0.2 }), id).toBe(false);
      expect(on(id, { ...base, p_tv: 1, p_glow: 0.2 }), id).toBe(true);
    }
  });
  it("diffuse passes also need halation or diffusion", () => {
    for (const id of ["diffuseDown", "diffuseUp"]) {
      expect(on(id, { ...base, p_tv: 1 }), id).toBe(false);
      expect(on(id, { ...base, p_halation: 0.1 }), id).toBe(false);
      expect(on(id, { ...base, p_tv: 1, p_halation: 0.1 }), id).toBe(true);
      expect(on(id, { ...base, p_tv: 1, p_diffusion: 0.1 }), id).toBe(true);
    }
  });
  it("the tape passes and main always run", () => {
    for (const id of ["frame", "tapeH", "tapeV", "main"]) {
      expect(VHS_PASSES.find((p) => p.id === id)!.enabled, id).toBeUndefined();
    }
  });
});

describe("derived values", () => {
  it("the tube follows the frame aspect in every fit", () => {
    for (const frameFit of [FRAME_FIT.keep, FRAME_FIT.crop, FRAME_FIT.letterbox]) {
      for (const [w, h] of [[1920, 1080], [1440, 1080], [1080, 1920], [2560, 1080]]) {
        const d = derive({ tv: 1, frameFit }, w, h);
        expect((d.tubeW * 1920) / (d.tubeH * 1080), `${frameFit} ${w}x${h}`).toBeCloseTo(d.frameAspect, 5);
      }
    }
  });
  it("240 tape lines is one row per field line", () => {
    const d = derive({ tapeLines: TAPE_LINES_CHOICE.rows240 });
    expect(d.tapeLines).toBe(240);
    expect(d.fieldStride).toBe(1);
    expect(derive({ tapeLines: TAPE_LINES_CHOICE.rows480 }).fieldStride).toBe(2);
  });
  it("caps the dropout probability per slot", () => {
    expect(derive({ dropouts: 1e6 }).dropoutProb).toBe(0.5);
    expect(derive({ dropouts: 0 }).dropoutProb).toBe(0);
  });
  it("falls back to SP for an unknown tape speed", () => {
    const sp = derive({ tapeSpeed: TAPE_SPEED.sp });
    for (const tapeSpeed of [3, -1, 99]) {
      const d = derive({ tapeSpeed });
      expect([d.lumaCutoff, d.chromaSigma, d.lumaNoise, d.dropoutProb]).toEqual([sp.lumaCutoff, sp.chromaSigma, sp.lumaNoise, sp.dropoutProb]);
    }
  });
});

describe("chroma delay window", () => {
  const fits = (d: Record<string, number>) => Math.abs(d.chromaDelay) + 2.5 * d.chromaSigma <= 16 + 1e-9;

  it("stays inside tape-h's 33 taps at high generation and delay", () => {
    for (const chromaBandwidthSP of [0.2, 0.4, 1.5]) {
      for (const chromaDelay of [4, -2]) {
        const d = derive({ generation: 3, chromaDelay, chromaBandwidthSP });
        expect(fits(d), `bw ${chromaBandwidthSP} delay ${chromaDelay}`).toBe(true);
        expect(Math.sign(d.chromaDelay) || Math.sign(chromaDelay)).toBe(Math.sign(chromaDelay));
      }
    }
    const wide = derive({ generation: 3, chromaDelay: 4, chromaBandwidthSP: 0.2 });
    expect(wide.chromaDelay).toBeLessThan(12);
  });
  it("leaves a small delay unchanged and 0 at exactly 0", () => {
    expect(derive({ chromaDelay: 1 }).chromaDelay).toBe(1);
    expect(derive({ chromaDelay: -1.5, generation: 1 }).chromaDelay).toBe(-3);
    expect(derive({ chromaDelay: 0, generation: 3 }).chromaDelay).toBe(0);
    expect(clampChromaDelay(0, 6.4)).toBe(0);
    expect(clampChromaDelay(5, 6.4)).toBe(0); // sigma at its maximum leaves no room
  });
});

describe("OSD on narrow frames", () => {
  it("shrinks the dots so the camcorder date and both margins fit", () => {
    const d = derive({ osdMode: OSD_MODE.camcorder }, 1080, 1920);
    expect(d.tapeWidth).toBeLessThan(300);
    expect(d.osdDotW).toBeLessThan(4);
    expect(d.osdDotW).toBeGreaterThanOrEqual(1);
    expect(71 * d.osdDotW + 2 * d.osdMarginX).toBeLessThanOrEqual(d.tapeWidth);
    expect(derive({ osdMode: OSD_MODE.camcorder }).osdDotW).toBe(4);
  });
  it("never goes below one dot", () => {
    expect(fitOsdDotW(4, 100, 8)).toBe(1);
    expect(fitOsdDotW(2, 854, 68)).toBe(2);
  });
});
