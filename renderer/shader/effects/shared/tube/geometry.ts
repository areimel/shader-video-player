import type { ParamValues } from "../../types";

/**
 * TS port of the uv part of `tubeGeometry` in glsl/geometry.glsl (tube placement + screen curvature), so a point on the
 * output can be mapped back through the glass. Keep in step with that file: CURVE_BULGE and curveFactorMinusOne.
 * Not ported: the rounded-corner coverage (`g.coverage`), which only fades the picture edge.
 */

/** Share of each axis' curvature spent on foreshortening. Shader pair: CURVE_BULGE in glsl/geometry.glsl. */
export const CURVE_BULGE = 0.5;

export interface Point { x: number; y: number }

/** f(c) - 1 per axis, curved = c * f(c). Shader pair: curveFactorMinusOne in glsl/geometry.glsl. */
function curveFactorMinusOne(c: Point, kx: number, ky: number): Point {
  const c2x = c.x * c.x, c2y = c.y * c.y;
  const bendX = ky * c2y, bendY = kx * c2x;
  const bulgeX = -CURVE_BULGE * kx * (1 - c2x), bulgeY = -CURVE_BULGE * ky * (1 - c2y);
  return { x: bendX + bulgeX + bendX * bulgeX, y: bendY + bulgeY + bendY * bulgeY };
}

/** Viewport uv (top-left origin) -> undistorted tube-face uv `t`, 0..1 inside the tube rectangle. */
export function viewToTube(viewUv: Point, tubeW: number, tubeH: number): Point {
  return {
    x: (viewUv.x - 0.5) / Math.max(tubeW, 1e-4) + 0.5,
    y: (viewUv.y - 0.5) / Math.max(tubeH, 1e-4) + 0.5,
  };
}

export const insideUnit = (p: Point): boolean => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

/** Tube uv `t` -> curved tube uv (what the shader samples the raster with): t + 0.5 * c * (f(c) - 1), c = 2t - 1. */
export function curveTube(t: Point, curvatureX: number, curvatureY: number): Point {
  const c = { x: t.x * 2 - 1, y: t.y * 2 - 1 };
  const f = curveFactorMinusOne(c, curvatureX, curvatureY);
  return { x: t.x + 0.5 * c.x * f.x, y: t.y + 0.5 * c.y * f.y };
}

/** Viewport uv -> curved tube uv, or null outside the tube rectangle. `v` holds curvatureX / curvatureY. */
export function viewToTubeUv(viewUv: Point, tubeW: number, tubeH: number, v: ParamValues): Point | null {
  const t = viewToTube(viewUv, tubeW, tubeH);
  if (!insideUnit(t)) return null;
  return curveTube(t, v.curvatureX, v.curvatureY);
}
