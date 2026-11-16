import { describe, expect, it } from "vitest";
import { resolveValues } from "../../renderer/shader/effects/params";
import { crtEffect } from "../../renderer/shader/effects/crt";
import { vhsEffect } from "../../renderer/shader/effects/vhs";
import { curveTube } from "../../renderer/shader/effects/shared/tube/geometry";
import type { DeriveEnv, ParamValues } from "../../renderer/shader/effects/types";

const FLAT = { curvatureX: 0, curvatureY: 0, overscan: 0, tubeAspect: 0 };
const env43: DeriveEnv = { viewport: { width: 1440, height: 1080 }, video: { width: 640, height: 480 } };
const env169: DeriveEnv = { viewport: { width: 1920, height: 1080 }, video: { width: 640, height: 480 } };

const crt = (o: Partial<ParamValues> = {}) => resolveValues(crtEffect.params, { ...FLAT, ...o });
const vhs = (o: Partial<ParamValues> = {}) => resolveValues(vhsEffect.params, { curvatureX: 0, curvatureY: 0, ...o });
const near = (p: { x: number; y: number } | null, x: number, y: number) => {
  expect(p).not.toBeNull();
  expect(p!.x).toBeCloseTo(x, 6);
  expect(p!.y).toBeCloseTo(y, 6);
};

describe("curveTube (port of tubeGeometry)", () => {
  // Hand-computed from geometry.glsl with kx = 0.1, ky = 0.2, CURVE_BULGE = 0.5.
  it("moves an edge-middle point inward (bulge) and leaves flat glass alone", () => {
    // t=(0.9,0.5): c=(0.8,0); f.x = 0 - 0.018 = -0.018; delta.x = -0.0144; uv.x = 0.9 - 0.0072
    near(curveTube({ x: 0.9, y: 0.5 }, 0.1, 0.2), 0.8928, 0.5);
    near(curveTube({ x: 0.9, y: 0.9 }, 0, 0), 0.9, 0.9);
  });
  it("moves a near-corner point outward (bend wins over bulge)", () => {
    // c=(0.8,0.8): f.x = 0.128 - 0.018 - 0.128*0.018 = 0.107696, f.y = 0.064 - 0.036 - 0.064*0.036 = 0.025696
    near(curveTube({ x: 0.9, y: 0.9 }, 0.1, 0.2), 0.9430784, 0.9102784);
  });
  it("does not move the edge midpoints or the centre", () => {
    near(curveTube({ x: 1, y: 0.5 }, 0.1, 0.2), 1, 0.5);
    near(curveTube({ x: 0.5, y: 0 }, 0.1, 0.2), 0.5, 0);
    near(curveTube({ x: 0.5, y: 0.5 }, 0.1, 0.2), 0.5, 0.5);
  });
});

describe("CRT pointerToSource", () => {
  const at = (x: number, y: number, o: Partial<ParamValues> = {}, env = env43) =>
    crtEffect.pointerToSource({ x, y }, crt(o), env);

  it("maps the centre to the centre", () => near(at(0.5, 0.5, { curvatureX: 0.1, curvatureY: 0.1, overscan: 0.05 }), 0.5, 0.5));
  it("is the identity for flat glass, no overscan, 4:3 source in a 4:3 viewport", () => {
    near(at(0.2, 0.7), 0.2, 0.7);
    near(at(0.99, 0.01), 0.99, 0.01);
  });
  it("scales about the centre with overscan: (0.75 - 0.5) * 0.9 + 0.5", () => {
    near(at(0.75, 0.5, { overscan: 0.1 }), 0.725, 0.5);
    near(at(0.5, 0.1, { overscan: 0.1 }), 0.5, 0.5 + -0.4 * 0.9);
  });
  it("letterboxes a 4:3 tube in a 16:9 viewport (tube spans x 0.125..0.875)", () => {
    expect(at(0.05, 0.5, {}, env169)).toBeNull();
    expect(at(0.95, 0.5, {}, env169)).toBeNull();
    near(at(0.5, 0.5, {}, env169), 0.5, 0.5);
    near(at(0.25, 0.5, {}, env169), 1 / 6, 0.5); // t.x = (0.25 - 0.5) / 0.75 + 0.5
  });
  it("applies curvature in the shader's direction", () => {
    // 4:3 viewport: t = view. Same hand values as curveTube above, no overscan.
    near(at(0.9, 0.5, { curvatureX: 0.1, curvatureY: 0.15 }), 0.8928, 0.5);
    near(at(0.9, 0.9, { curvatureX: 0.1, curvatureY: 0.15 }), 0.9305088, 0.9141088);
  });
  it("returns null in the letterbox bars of a wider video", () => {
    // Letterbox of a 16:9 video in the 4:3 tube: the picture is 0.75 tall, so y = 0.05 is a bar.
    const wide: DeriveEnv = { viewport: env43.viewport, video: { width: 1920, height: 1080 } };
    expect(at(0.5, 0.05, {}, wide)).toBeNull();
    near(at(0.5, 0.5 + 0.375, {}, wide), 0.5, 1);
  });
});

describe("VHS pointerToSource", () => {
  const at = (x: number, y: number, o: Partial<ParamValues> = {}, env = env43) =>
    vhsEffect.pointerToSource({ x, y }, vhs(o), env);

  it("maps the centre to the centre", () => {
    near(at(0.5, 0.5, { tv: 0 }), 0.5, 0.5);
    near(at(0.5, 0.5, { tv: 1, curvatureX: 0.1, curvatureY: 0.1 }), 0.5, 0.5);
  });
  it("is the identity with the TV off for a 4:3 source in a 4:3 viewport", () => near(at(0.3, 0.8, { tv: 0 }), 0.3, 0.8));
  it("differs between tv off and on only by curvature", () => {
    const off = at(0.9, 0.9, { tv: 0, curvatureX: 0.1, curvatureY: 0.15 });
    const on = at(0.9, 0.9, { tv: 1, curvatureX: 0.1, curvatureY: 0.15 });
    near(off, 0.9, 0.9);
    near(on, 0.9305088, 0.9141088);
    near(at(0.9, 0.9, { tv: 1 }), 0.9, 0.9); // zero curvature: same as off
  });
  it("returns null in the side bars of a 16:9 viewport and in the letterbox bars of the frame", () => {
    expect(at(0.05, 0.5, { tv: 0 }, env169)).toBeNull();
    // 16:9 video letterboxed into the 4:3 frame: picture is 0.75 tall.
    const wide: DeriveEnv = { viewport: env43.viewport, video: { width: 1920, height: 1080 } };
    expect(at(0.5, 0.05, { frameFit: 2 }, wide)).toBeNull();
    near(at(0.5, 0.875, { frameFit: 2 }, wide), 0.5, 1);
  });
});
