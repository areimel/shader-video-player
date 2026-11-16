import type { Size } from "../../../gl/passGraph";
import type { ParamValues } from "../../types";
import { MASK, MASK_WIDTHS } from "./params";

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

export type Fit = "letterbox" | "crop" | "stretch";

/** Size of the picture inside a frame of `frameAspect` (1 = fills that axis; >1 = cropped). */
export function contentScale(fit: Fit, videoAspect: number, frameAspect: number) {
  if (fit === "stretch" || !Number.isFinite(videoAspect) || videoAspect <= 0) return { w: 1, h: 1 };
  const r = videoAspect / frameAspect; // >1: picture is wider than the frame
  const letterbox = r > 1 ? { w: 1, h: 1 / r } : { w: r, h: 1 };
  if (fit === "letterbox") return letterbox;
  return r > 1 ? { w: r, h: 1 } : { w: 1, h: 1 / r };
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

export interface TubeEnv {
  viewport: Size;
  /** Width / height of the tube face. */
  tubeAspect: number;
  /** tubeRect(tubeAspect, viewport), computed once by the caller (CRT needs it to pick its line count). */
  tube: { w: number; h: number };
  /** Lines in the raster the tube draws (CRT: virtual lines; VHS: tape lines). */
  lines: number;
}

/** Derived values the tube shaders read: d_tubeW, d_tubeH, d_scanlineFade, d_maskWidth, d_exposure. */
export function deriveTube(v: ParamValues, env: TubeEnv): ParamValues {
  const tubeWidthPx = env.tube.w * env.viewport.width;
  const tubeHeightPx = env.tube.h * env.viewport.height;
  const pxPerLine = tubeHeightPx / env.lines;
  const scanlineFade = clamp01((pxPerLine - FADE_END) / (FADE_START - FADE_END));
  return {
    tubeW: env.tube.w,
    tubeH: env.tube.h,
    scanlineFade,
    maskWidth: pickMaskWidth(v.maskWidth, v.maskTVL, tubeWidthPx, env.tubeAspect),
    exposure: exposureGain(v, scanlineFade),
  };
}
