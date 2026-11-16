import type { DeriveEnv, ParamValues } from "../types";
import { curveTube, insideUnit, viewToTube, type Point } from "../shared/tube/geometry";
import { deriveVhs } from "./derive";

/**
 * Output point -> source picture uv for VHS. main.frag: with `tv` off the tape frame is drawn flat in the tube rect
 * (t = (viewUv - 0.5) / tube + 0.5); with it on the shared tube geometry (curvature) applies on top. Then frame.frag:
 * uv = (tapeUv - 0.5) / picture + 0.5 (null in the letterbox/pillar bars). Time-varying tape displacement (wobble,
 * tracking, head switch, jitter, top skew) and the OSD are ignored. Reads derived values from deriveVhs.
 */
export function vhsPointerToSource(viewUv: Point, values: ParamValues, env: DeriveEnv): Point | null {
  const d = deriveVhs(values, env);
  const t = viewToTube(viewUv, d.tubeW, d.tubeH);
  if (!insideUnit(t)) return null;
  const tape = values.tv > 0.5 ? curveTube(t, values.curvatureX, values.curvatureY) : t;
  const uv = { x: (tape.x - 0.5) / d.pictureW + 0.5, y: (tape.y - 0.5) / d.pictureH + 0.5 };
  return insideUnit(uv) ? uv : null;
}
