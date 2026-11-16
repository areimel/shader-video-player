import type { DeriveEnv, ParamValues } from "../types";
import { ACTIVE_LINE_US, SUBCARRIER_MHZ, mhzToCycles } from "../shared/signal";
import { contentScale, deriveTube, tubeRect, type Fit } from "../shared/tube/derive";
import { FRAME_FIT, TAPE_LINES, TAPE_LINES_CHOICE } from "./params";

// shared/signal.ts ACTIVE_LINE_US = 52.6: NTSC active line (63.556 µs line - 10.9 µs blanking), SMPTE 170M.
// SUBCARRIER_MHZ = 3.579545 (315/88 MHz), SMPTE 170M.
export const TAPE_SAMPLES_43 = 640;   // samples per 4:3 active line: 12.17/µs, Nyquist 6.08 MHz (above S-VHS luma),
                                      // subcarrier at 3.4 samples/cycle (CRT's 400-sample floor is the alias limit).
export const TAPE_FIELD_LINES = 240;  // visible lines per NTSC field (of 262.5). Shader pair: FIELD_LINES in glsl/timebase.glsl.
const MHZ_TO_CYCLES = mhzToCycles(TAPE_SAMPLES_43); // 0.08219 cycles/sample per MHz, for every frame fit (see tapeSize)
const SAMPLES_PER_US = TAPE_SAMPLES_43 / ACTIVE_LINE_US; // 12.167
/** 0.1325 = sigma * f(-3 dB) of a Gaussian. Shader pair: glsl/common/subcarrier.glsl chromaSigma uses 0.0937 = this / sqrt(2)
 *  for each half of the chroma chain, with its 0.8-sample floor (CHROMA_SIGMA_FLOOR below); keep in step. */
export const GAUSS_3DB = Math.sqrt(Math.LN2) / (2 * Math.PI);
const FILTER_ORDER = 3;               // deck low-pass modelled as 3rd-order maximally flat (approx.; real decks are 3rd-5th order)
/** Per speed. Track pitch (NTSC VHS): SP 58 µm, LP 29 µm, EP 19.3 µm. Noise power ∝ 1/track width (phys.) → amplitude √ratio.
 *  Luma: typical consumer-deck specs ~240/220/200 TVL (approx.). Chroma: the colour-under carrier is 629 kHz at every
 *  speed, so chroma bandwidth barely changes. Dropouts: narrower tracks lose more to the same defect (approx.). */
export const SPEED = [
  { luma: 1, chroma: 1, noise: 1, dropouts: 1 },
  { luma: 0.92, chroma: 1, noise: Math.SQRT2, dropouts: 1.5 },
  { luma: 0.83, chroma: 0.95, noise: Math.sqrt(3), dropouts: 2 },
];
const LUMA_NOISE_FULL = 0.05;         // Y rms at lumaNoise = 1 (26 dB). Default 0.15 → 0.0075 ≈ 42.5 dB before the enhancer (the default
                                      // sharpening raises it by about 1.33x); VHS SP luma S/N ≈ 42-45 dB.
const CHROMA_NOISE_FULL = 0.05;       // I/Q rms per channel at chromaNoise = 1. Default 0.2 → 0.01 ≈ 40 dB (VHS chroma AM S/N ≈ 40 dB).
const CHROMA_SIGMA_MIN = 0.5, CHROMA_SIGMA_MAX = 6.4; // tapeH has 33 taps: 2.5 sigma = 16 keeps truncation near 1%
const CHROMA_TAP_RADIUS = 16, CHROMA_SIGMA_REACH = 2.5; // tape-h.frag RADIUS (FILTER_RADIUS) and the sigmas the window must hold
const CHROMA_SIGMA_FLOOR = 0.8;       // glsl/common/subcarrier.glsl chromaSigma floor: the decoder needs several phases per sigma
const HEAD_SWITCH_SHIFT_US = 1.5;     // timing step between the two heads at the switch point (approx.; typically 1-2 µs)
const TRACKING_SHIFT_US = 1.0;        // peak time-base error inside the mistracking band (approx.)
const DROPOUT_TAIL_US = 3;            // FM limiter/demodulator recovery after the carrier returns (approx.)
const DOC_DELAY_US = 1;               // dropout compensator reaction time before it substitutes the 1H-delayed line (approx.)
const DECODER_LUMA_MHZ = 4.2;         // NTSC luma bandwidth: the receiver/capture card's luma path
const DECODER_CHROMA_MHZ = 1.0;       // consumer notch-filter decoder chroma band (approx.; ~0.6-1.3 MHz in practice)
const OSD_DOT_FIELD_LINES = 2;        // one OSD dot = 2 field lines tall (a 7-dot glyph ≈ 5.8% of picture height)
const OSD_MARGIN = 0.08;              // title-safe margin, fraction of frame width/height
const OSD_WIDEST_DOTS = 71;           // widest OSD line: the camcorder date, 12 cells of 6 dots minus the gap (osd.glsl osdCamcorder)
const FRAME_ASPECT_MIN = 0.5, FRAME_ASPECT_MAX = 2.4;
const ASPECT_43 = 4 / 3;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * The tape frame's aspect and the picture's size inside it (fraction of the frame; > 1 = cropped).
 * Picture size is the shared `contentScale`, so VHS and CRT frame a video identically.
 */
export function frameRect(fit: number, videoAspect: number) {
  const valid = Number.isFinite(videoAspect) && videoAspect > 0;
  if (!valid) return { aspect: ASPECT_43, pictureW: 1, pictureH: 1 };
  if (fit === FRAME_FIT.keep) {
    const aspect = clamp(videoAspect, FRAME_ASPECT_MIN, FRAME_ASPECT_MAX);
    const c = contentScale("letterbox", videoAspect, aspect);
    return { aspect, pictureW: c.w, pictureH: c.h };
  }
  const kind: Fit = fit === FRAME_FIT.crop ? "crop" : "letterbox";
  const c = contentScale(kind, videoAspect, ASPECT_43);
  return { aspect: ASPECT_43, pictureW: c.w, pictureH: c.h };
}

/**
 * Tape raster size. Keep-aspect widens the line (as if the active line lasted 52.6 x aspect/(4/3) µs), so cycles per
 * sample, artifact sizes and OSD dots are the same per picture height in every fit mode.
 */
export function tapeSize(aspect: number, linesChoice: number) {
  const height = TAPE_LINES[linesChoice] ?? TAPE_LINES[TAPE_LINES_CHOICE.rows480];
  return {
    width: 2 * Math.round((TAPE_SAMPLES_43 * aspect) / ASPECT_43 / 2),
    height,
    stride: height / TAPE_FIELD_LINES,
  };
}

/** -3 dB point of `1 + g` cascaded identical maximally flat filters of order 3 (phys. for that filter family).
 *  1 at g = 0, 0.863 at 1, 0.799 at 2. (Gaussian theory, 1/sqrt(1+g), is far harsher than measured dubs.) */
export const generationScale = (g: number): number => Math.pow(Math.pow(2, 1 / (1 + g)) - 1, 1 / (2 * FILTER_ORDER));

/** Weights of field lines n, n-1, n-2 for the vertical chroma smear. Sums to 1; [1, 0, 0] at 0. */
export function combWeights(s: number): [number, number, number] {
  if (s <= 1) return [1 - s / 2, s / 2, 0];
  const t = s - 1;
  return [0.5 - t / 4, 0.5, t / 4];
}

/** Chroma group delay (samples) kept inside tape-h's 33-tap Gaussian: |delay| + 2.5 sigma <= 16, else the kernel's centre
 *  leaves the window and the smear is truncated and one-sided. Keeps the sign; 0 stays 0. Shader pair: tape-h.frag
 *  evaluates gaussian(k + d_chromaDelay) for k = -16..16. */
export function clampChromaDelay(delay: number, sigma: number): number {
  if (delay === 0) return 0;
  const room = Math.max(0, CHROMA_TAP_RADIUS - CHROMA_SIGMA_REACH * sigma);
  return Math.sign(delay) * Math.min(Math.abs(delay), room);
}

/** OSD dot width (tape samples): `wanted`, reduced (min 1) until the widest OSD line and both margins fit the raster. */
export function fitOsdDotW(wanted: number, tapeWidth: number, marginX: number): number {
  const fits = Math.floor((tapeWidth - 2 * marginX) / OSD_WIDEST_DOTS);
  return Math.max(1, Math.min(wanted, fits));
}

export function deriveVhs(v: ParamValues, env: DeriveEnv): ParamValues {
  const g = v.generation;
  const sp = SPEED[v.tapeSpeed] ?? SPEED[0];
  const gs = generationScale(g);
  const frame = frameRect(v.frameFit, env.video.width / env.video.height);
  const tape = tapeSize(frame.aspect, v.tapeLines);
  const comb = combWeights(v.chromaSmear);

  const lumaCutoff = Math.min(0.5, v.lumaBandwidthSP * sp.luma * gs * MHZ_TO_CYCLES);
  const chromaSigma = clamp(
    GAUSS_3DB / (v.chromaBandwidthSP * sp.chroma * gs * MHZ_TO_CYCLES), CHROMA_SIGMA_MIN, CHROMA_SIGMA_MAX);
  const osdMarginX = Math.round(OSD_MARGIN * tape.width);
  const headLines = Math.round(v.headSwitch);
  const copies = Math.sqrt(1 + g); // independent equal-power noise / time-base error per playback (phys.)

  // The tube shows the tape frame, so its aspect is the frame's and its raster has the tape's line count.
  const tubeAspect = frame.aspect;
  const tube = tubeRect(tubeAspect, env.viewport);

  return {
    tapeWidth: tape.width,
    tapeLines: tape.height,
    fieldStride: tape.stride,
    frameAspect: frame.aspect,
    pictureW: frame.pictureW,
    pictureH: frame.pictureH,

    lumaCutoff,
    chromaSigma,
    chromaCutoff: GAUSS_3DB / chromaSigma, // effective, after the clamp
    chromaDelay: clampChromaDelay(v.chromaDelay * (1 + g), chromaSigma), // group delays add per playback (phys.)
    combW0: comb[0], combW1: comb[1], combW2: comb[2],

    lumaNoise: v.lumaNoise * LUMA_NOISE_FULL * sp.noise * copies,
    chromaNoise: v.chromaNoise * CHROMA_NOISE_FULL * sp.noise * copies,
    jitter: v.lineJitter * copies,
    wobble: v.wobble,
    topSkew: v.topSkew,

    headSwitchLines: headLines,
    headSwitchShift: headLines > 0 ? HEAD_SWITCH_SHIFT_US * SAMPLES_PER_US : 0,
    headSwitchNoise: headLines > 0 ? v.headSwitchNoise : 0,
    tracking: v.tracking,
    trackingRoll: v.tracking > 0 ? v.trackingRoll : 0,
    trackingShift: v.tracking > 0 ? TRACKING_SHIFT_US * SAMPLES_PER_US : 0,

    // 2 slots per field line; each copy adds its own dropouts.
    dropoutProb: Math.min(0.5, (v.dropouts * sp.dropouts * (1 + g)) / (2 * TAPE_FIELD_LINES)),
    dropoutLen: v.dropoutLength * SAMPLES_PER_US,
    dropoutTail: DROPOUT_TAIL_US * SAMPLES_PER_US,
    docDelay: DOC_DELAY_US * SAMPLES_PER_US,
    dropoutEdge: Math.max(1, 0.5 / lumaCutoff), // luma-path rise time: the real streak happens before the low-pass

    subcarrier: SUBCARRIER_MHZ * MHZ_TO_CYCLES,
    decodeLumaCutoff: Math.min(0.5, DECODER_LUMA_MHZ * MHZ_TO_CYCLES),
    decodeChromaSigma: Math.max(CHROMA_SIGMA_FLOOR, GAUSS_3DB / (DECODER_CHROMA_MHZ * MHZ_TO_CYCLES)),

    osdDotW: fitOsdDotW(Math.round((OSD_DOT_FIELD_LINES * tape.width) / (TAPE_FIELD_LINES * frame.aspect)), tape.width, osdMarginX),
    osdDotH: OSD_DOT_FIELD_LINES * tape.stride,
    osdMarginX,
    osdMarginY: Math.round(OSD_MARGIN * tape.height),

    ...deriveTube(v, { viewport: env.viewport, tubeAspect, tube, lines: tape.height }),
  };
}
