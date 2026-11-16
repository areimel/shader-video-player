import type { DeriveEnv, ParamValues } from "../types";
import { cutoffCycles, subcarrierCycles } from "../shared/signal";
import { contentScale, deriveTube, tubeRect, type Fit } from "../shared/tube/derive";
import { VIRTUAL_LINES } from "./params";

/** Scanlines need this many output pixels each to stay free of moiré. */
const MIN_PX_PER_LINE_AUTO = 3.5;

/** contentFit option index (FIT in params.ts) -> framing. */
const FIT_KINDS: readonly Fit[] = ["letterbox", "crop", "stretch"];

export function pickVirtualLines(choice: number, tubeHeightPx: number): number {
  const fixed = VIRTUAL_LINES[choice];
  if (fixed) return fixed;
  const fitting = VIRTUAL_LINES.filter((v) => v > 0 && tubeHeightPx / v >= MIN_PX_PER_LINE_AUTO);
  return fitting.length ? Math.max(...fitting) : 240;
}

export function deriveCrt(v: ParamValues, env: DeriveEnv): ParamValues {
  const tubeAspect = v.tubeAspect === 1 ? 16 / 9 : 4 / 3;
  const tube = tubeRect(tubeAspect, env.viewport);
  const content = contentScale(FIT_KINDS[v.contentFit], env.video.width / env.video.height, tubeAspect);

  const tubeHeightPx = tube.h * env.viewport.height;
  const lines = pickVirtualLines(v.virtualLines, tubeHeightPx);
  const width = Math.round(v.virtualWidth);

  return {
    virtualLines: lines,
    virtualWidth: width,
    ...deriveTube(v, { viewport: env.viewport, tubeAspect, tube, lines }),
    contentW: content.w,
    contentH: content.h,
    pxPerLine: tubeHeightPx / lines, // not read by any shader; kept so CRT's derived set is unchanged
    // Frequencies in cycles per raster sample (Nyquist = 0.5).
    subcarrier: subcarrierCycles(width),
    lumaCutoff: cutoffCycles(v.lumaBandwidth, width),
    chromaCutoff: cutoffCycles(v.chromaBandwidth, width),
  };
}
