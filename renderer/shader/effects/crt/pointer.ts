import type { DeriveEnv, ParamValues } from "../types";
import { insideUnit, viewToTubeUv, type Point } from "../shared/tube/geometry";
import { deriveCrt } from "./derive";

/**
 * Output point -> source picture uv for the CRT. Mirrors the shader chain: main.frag (tube rect + curvature through
 * shared/tube/geometry.ts), then raster.frag: uv = (tubeUv - 0.5) * (1 - overscan) / content + 0.5. Both read the
 * derived tubeW/tubeH/contentW/contentH from deriveCrt. Null where the picture is not (side bars, outside the overscan).
 */
export function crtPointerToSource(viewUv: Point, values: ParamValues, env: DeriveEnv): Point | null {
  const d = deriveCrt(values, env);
  const tube = viewToTubeUv(viewUv, d.tubeW, d.tubeH, values);
  if (!tube) return null;
  const sx = (1 - values.overscan) / d.contentW;
  const sy = (1 - values.overscan) / d.contentH;
  const uv = { x: (tube.x - 0.5) * sx + 0.5, y: (tube.y - 0.5) * sy + 0.5 };
  return insideUnit(uv) ? uv : null;
}
