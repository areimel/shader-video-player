import type { DeriveEnv, ParamValues } from "../types";
import { cutoffCycles, subcarrierCycles } from "../shared/signal";
import { FIT, MASK, MASK_WIDTHS, VIRTUAL_LINES } from "./params";

/** Scanlines need this many output pixels each to stay free of moiré. */
const MIN_PX_PER_LINE_AUTO = 3.5;
const FADE_START = 2.5;
const FADE_END = 2.0;

/** Fraction of light each mask pattern passes at full strength. Must match glsl/mask.glsl. */
const MASK_TRANSMITTANCE: Record<number, number> = {
  [MASK.none]: 1, [MASK.aperture]: 1 / 3, [MASK.shadow]: 1 / 3,
  [MASK.magentaGreen]: 1 / 2, [MASK.rgbx]: 1 / 4,
};

/** Slot masks are stripes with a one-pixel dark gap every `slotHeight` rows. */
export function maskTransmittance(maskType: number, slotHeight: number): number {
  if (maskType === MASK.slot) return (1 / 3) * (1 - 1 / Math.max(2, Math.round(slotHeight)));
  return MASK_TRANSMITTANCE[maskType] ?? 1;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Size of the tube rectangle, as a fraction of the viewport, fitted to the tube's aspect. */
export function tubeRect(tubeAspect: number, viewport: { width: number; height: number }) {
  const w = Math.min(viewport.width, viewport.height * tubeAspect);
  return { w: w / viewport.width, h: w / tubeAspect / viewport.height };
}

/** Size of the picture inside the tube (1 = fills that axis; >1 = cropped). */
export function contentScale(fit: number, videoAspect: number, tubeAspect: number) {
  if (fit === FIT.stretch || !Number.isFinite(videoAspect) || videoAspect <= 0) return { w: 1, h: 1 };
  const r = videoAspect / tubeAspect; // >1: picture is wider than the tube
  const letterbox = r > 1 ? { w: 1, h: 1 / r } : { w: r, h: 1 };
  if (fit === FIT.letterbox) return letterbox;
  return r > 1 ? { w: r, h: 1 } : { w: 1, h: 1 / r };
}

export function pickVirtualLines(choice: number, tubeHeightPx: number): number {
  const fixed = VIRTUAL_LINES[choice];
  if (fixed) return fixed;
  const fitting = VIRTUAL_LINES.filter((v) => v > 0 && tubeHeightPx / v >= MIN_PX_PER_LINE_AUTO);
  return fitting.length ? Math.max(...fitting) : 240;
}

/** Phosphor triad width in device pixels, snapped to a width the mask patterns support. */
export function pickMaskWidth(choice: number, tvl: number, tubeWidthPx: number, tubeAspect: number): number {
  const fixed = MASK_WIDTHS[choice];
  if (fixed) return fixed;
  const ideal = tubeWidthPx / (tvl * tubeAspect);
  const widths = MASK_WIDTHS.filter((w) => w > 0);
  return widths.reduce((best, w) => (Math.abs(w - ideal) < Math.abs(best - ideal) ? w : best));
}

/** Gain that restores the light lost to the mask and the dark gaps between scanlines. */
export function exposureGain(v: ParamValues, scanlineFade: number): number {
  const transmit = 1 - v.maskStrength * (1 - maskTransmittance(v.maskType, v.slotHeight));
  // Mean of peak-1 Gaussian beams of the average width, one per line. Neighbouring beams overlap,
  // so this exceeds 1 for wide beams (the picture gets brighter, and the gain drops below 1).
  const sigma = (v.beamMin + v.beamMax) / 2;
  const beamDuty = sigma * Math.sqrt(2 * Math.PI);
  const duty = 1 - v.scanlineStrength * scanlineFade * (1 - beamDuty);
  return 1 + v.autoExposure * (1 / (transmit * duty) - 1);
}

export function deriveCrt(v: ParamValues, env: DeriveEnv): ParamValues {
  const tubeAspect = v.tubeAspect === 1 ? 16 / 9 : 4 / 3;
  const tube = tubeRect(tubeAspect, env.viewport);
  const tubeWidthPx = tube.w * env.viewport.width;
  const tubeHeightPx = tube.h * env.viewport.height;
  const content = contentScale(v.contentFit, env.video.width / env.video.height, tubeAspect);

  const lines = pickVirtualLines(v.virtualLines, tubeHeightPx);
  const width = Math.round(v.virtualWidth);
  const pxPerLine = tubeHeightPx / lines;
  const scanlineFade = clamp01((pxPerLine - FADE_END) / (FADE_START - FADE_END));

  return {
    virtualLines: lines,
    virtualWidth: width,
    tubeW: tube.w,
    tubeH: tube.h,
    contentW: content.w,
    contentH: content.h,
    pxPerLine,
    scanlineFade,
    maskWidth: pickMaskWidth(v.maskWidth, v.maskTVL, tubeWidthPx, tubeAspect),
    exposure: exposureGain(v, scanlineFade),
    // Frequencies in cycles per raster sample (Nyquist = 0.5).
    subcarrier: subcarrierCycles(width),
    lumaCutoff: cutoffCycles(v.lumaBandwidth, width),
    chromaCutoff: cutoffCycles(v.chromaBandwidth, width),
  };
}
