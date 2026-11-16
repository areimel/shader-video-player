import { range, select, toggle } from "../params";
import type { ParamSpec } from "../types";
import { tubeGroupNames, tubeParams, type TubeGroups } from "../shared/tube/params";

// Tube option constants live in ../shared/tube/params.ts; re-exported so existing imports keep working.
export { BEAM_SIGMA_MAX, MASK, MASK_WIDTHS } from "../shared/tube/params";

const TUBE_GROUPS: TubeGroups = { beam: "Beam", mask: "Mask", glow: "Glow", geometry: "Geometry", screen: "Screen" };

export const CRT_GROUPS = ["Picture", "Signal", ...tubeGroupNames(TUBE_GROUPS)];

/** Option orders are part of the shader contract: shaders compare `p_<id>` against these indexes. */
export const VIRTUAL_LINES = [0, 240, 288, 480, 576]; // index 0 = auto
export const SIGNAL = { rgb: 0, svideo: 1, composite: 2 } as const;
export const FIT = { letterbox: 0, crop: 1, stretch: 2 } as const;

const P = "Picture", S = "Signal";

export const CRT_PARAMS: ParamSpec[] = [
  // Picture: how the video is mapped onto the tube's raster (raster pass).
  select("virtualLines", "Scan lines", P, ["Auto", "240", "288", "480", "576"], 0,
    { hint: "Lines the tube draws. Auto picks the most that still leaves visible scanlines." }),
  range("virtualWidth", "Samples per line", P, 400, 1440, 2, 754,
    { hint: "Below ~380 the colour subcarrier would alias, so 400 is the floor." }),
  select("tubeAspect", "Tube shape", P, ["4:3", "16:9"]),
  select("contentFit", "Picture fit", P, ["Letterbox", "Crop", "Stretch"]),
  range("overscan", "Overscan", P, 0, 0.1, 0.005, 0.04),
  range("saturation", "Saturation", P, 0, 2, 0.01, 1),
  range("tint", "Tint", P, -30, 30, 1, 0, { unit: "°" }),
  range("colorTemp", "Colour temperature", P, 5000, 9300, 100, 6500, { unit: "K" }),

  // Signal: analog transmission between source and tube (signalEncode / signalDecode passes).
  select("signalMode", "Connection", S, ["RGB", "S-Video", "Composite"], SIGNAL.composite),
  range("lumaBandwidth", "Luma bandwidth", S, 1.5, 6, 0.1, 4.2, { unit: "MHz" }),
  range("chromaBandwidth", "Chroma bandwidth", S, 0.3, 2, 0.05, 1, { unit: "MHz" }),
  range("artifacting", "Rainbowing", S, 0, 2, 0.05, 1, { hint: "Fine luma detail leaking into colour (composite only)." }),
  range("fringing", "Dot crawl", S, 0, 2, 0.05, 1, { hint: "Colour leaking into luma at edges (composite only)." }),
  select("phaseMode", "Subcarrier phase", S, ["2-phase", "3-phase"]),
  toggle("crawl", "Animate crawl", S, true),
  range("ringing", "Ringing", S, 0, 1, 0.01, 0.15),
  range("chromaDelay", "Chroma delay", S, -2, 2, 0.1, 0.5, { unit: "px" }),
  range("signalNoise", "Signal noise", S, 0, 0.2, 0.005, 0.02, { animated: true }),
  range("jitter", "Line jitter", S, 0, 1, 0.05, 0.1, { unit: "px", animated: true }),

  ...tubeParams(TUBE_GROUPS),
];
