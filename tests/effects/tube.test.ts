import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CRT_PARAMS } from "../../renderer/shader/effects/crt/params";
import { resolveValues } from "../../renderer/shader/effects/params";
import { deriveTube, tubeRect } from "../../renderer/shader/effects/shared/tube/derive";
import { BEAM_SIGMA_MAX, MASK, tubeGroupNames, tubeParams } from "../../renderer/shader/effects/shared/tube/params";
import { TUBE_MAIN_INPUTS, tubePasses } from "../../renderer/shader/effects/shared/tube/pipeline";
import { shaderFiles, unknownNames } from "./shaderNames";

const TUBE_DIR = join(__dirname, "../../renderer/shader/effects/shared/tube");
const GROUPS = { beam: "B", mask: "M", glow: "G", geometry: "GEO", screen: "S" };
const params = tubeParams(GROUPS);
const tube = (over: Record<string, number> = {}, viewport = { width: 1920, height: 1080 }, lines = 288, tubeAspect = 4 / 3) =>
  deriveTube(resolveValues(params, over), { viewport, tubeAspect, tube: tubeRect(tubeAspect, viewport), lines });

describe("deriveTube: tube rect", () => {
  it("fits the tube inside the viewport", () => {
    const vp = { width: 1920, height: 1080 };
    const d = tubeRect(4 / 3, vp);
    expect(d.w).toBeCloseTo(0.75);
    expect(d.h).toBeCloseTo(1);
    const wide = tubeRect(16 / 9, vp);
    expect(wide.w).toBe(1);
    expect(wide.h).toBeCloseTo(1);
  });
  it("returns only what the tube shaders read", () => {
    expect(Object.keys(tube()).sort()).toEqual(["exposure", "maskWidth", "scanlineFade", "tubeH", "tubeW"]);
  });
});

describe("deriveTube: mask width", () => {
  it("snaps to the supported widths", () => {
    expect(tube({ maskTVL: 350 }).maskWidth).toBe(3);
    expect(tube({ maskTVL: 900 }).maskWidth).toBe(2);
    expect(tube({ maskTVL: 350 }, { width: 3840, height: 2160 }).maskWidth).toBe(6);
    for (const tvl of [250, 400, 600, 900]) expect([2, 3, 4, 6]).toContain(tube({ maskTVL: tvl }).maskWidth);
  });
  it("uses an explicit width verbatim", () => {
    expect(tube({ maskWidth: 3 }).maskWidth).toBe(4);
  });
});

describe("deriveTube: scanline fade", () => {
  it("fades scanlines to zero below 2 px per line and full above 2.5", () => {
    const vp = { width: 1920, height: 1080 };
    expect(tube({}, vp, 576).scanlineFade).toBe(0); // 1080/576 = 1.9
    expect(tube({}, vp, 240).scanlineFade).toBe(1); // 4.5
    const mid = tube({}, vp, 480).scanlineFade; // 2.25
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe("deriveTube: exposure", () => {
  it("is exactly 1 when nothing darkens the picture", () => {
    expect(tube({ maskType: MASK.none, scanlineStrength: 0 }).exposure).toBeCloseTo(1, 10);
  });
  it("is 1 when compensation is off", () => {
    expect(tube({ autoExposure: 0 }).exposure).toBe(1);
  });
  it("is above 1 with a mask and scanlines", () => {
    expect(tube({}).exposure).toBeGreaterThan(1);
  });
  it("grows with compensation amount", () => {
    expect(tube({ autoExposure: 1 }).exposure).toBeGreaterThan(tube({ autoExposure: 0.4 }).exposure);
  });
});

describe("tube parameters", () => {
  it("offers only Off and Bob interlace", () => {
    expect(params.find((p) => p.id === "interlace")?.options).toEqual(["Off", "Bob"]);
  });

  it("labels glow radius in lines", () => {
    expect(params.find((p) => p.id === "glowSigma")?.unit).toBe("lines");
  });

  it("keeps beam widths where summing 3 lines is within 2% (worst case: Gaussian beam, any pixel position)", () => {
    const tail = (sigma: number, d: number) => {
      const g = (x: number) => Math.exp(-0.5 * (x / sigma) ** 2);
      let all = 0, three = 0;
      for (let j = -8; j <= 8; j++) { all += g(d - j); if (Math.abs(j) <= 1) three += g(d - j); }
      return (all - three) / all;
    };
    for (const id of ["beamMin", "beamMax"]) {
      const max = params.find((p) => p.id === id)?.max ?? 0;
      expect(max).toBe(BEAM_SIGMA_MAX);
      for (let d = -0.5; d <= 0.5; d += 0.05) expect(tail(max, d)).toBeLessThan(0.02);
    }
  });

  it("uses the given group names", () => {
    const names = tubeGroupNames(GROUPS);
    for (const p of params) expect(names, p.id).toContain(p.group);
    const ids = params.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is declared unchanged by CRT", () => {
    const crtTube = tubeParams({ beam: "Beam", mask: "Mask", glow: "Glow", geometry: "Geometry", screen: "Screen" });
    expect(CRT_PARAMS.slice(-crtTube.length)).toEqual(crtTube);
  });
});

describe("tube pipeline", () => {
  const rasterSize = () => ({ width: 100, height: 50 });

  it("gives CRT passes no enabled predicate", () => {
    for (const p of tubePasses("src", { rasterSize })) expect("enabled" in p, p.id).toBe(false);
  });
  it("applies per-pass predicates only where given", () => {
    const off = () => false;
    const passes = tubePasses("src", { rasterSize, enabled: { glowH: off, diffuseUp: off } });
    expect(passes.filter((p) => p.enabled).map((p) => p.id)).toEqual(["glowH", "diffuseUp"]);
  });
  it("keeps uSource first so a disabled pass forwards the right input", () => {
    for (const p of tubePasses("src", { rasterSize })) expect(Object.keys(p.inputs)[0], p.id).toBe("uSource");
  });
  it("main inputs name passes that exist", () => {
    const ids = tubePasses("src", { rasterSize }).map((p) => p.id);
    for (const id of Object.values(TUBE_MAIN_INPUTS)) expect(ids).toContain(id);
  });
});

describe("tube shaders", () => {
  const paramIds = new Set(params.map((p) => p.id));
  const derivedKeys = new Set(Object.keys(tube()));
  const files = shaderFiles(TUBE_DIR);

  it("finds shader files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.slice(TUBE_DIR.length + 1), f] as const))("%s uses only tube p_/d_ names", (_n, file) => {
    expect(unknownNames(file, paramIds, derivedKeys)).toEqual([]);
  });
});
