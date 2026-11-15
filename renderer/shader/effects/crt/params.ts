import { range, select, toggle } from "../params";
import type { ParamSpec } from "../types";

export const CRT_GROUPS = ["Picture", "Signal", "Beam", "Mask", "Glow", "Geometry", "Screen"];

/** Option orders are part of the shader contract: shaders compare `p_<id>` against these indexes. */
export const VIRTUAL_LINES = [0, 240, 288, 480, 576]; // index 0 = auto
export const MASK_WIDTHS = [0, 2, 3, 4, 6]; // index 0 = auto
export const SIGNAL = { rgb: 0, svideo: 1, composite: 2 } as const;
export const MASK = { none: 0, aperture: 1, slot: 2, shadow: 3, magentaGreen: 4, rgbx: 5 } as const;
export const FIT = { letterbox: 0, crop: 1, stretch: 2 } as const;

const P = "Picture", S = "Signal", B = "Beam", M = "Mask", G = "Glow", GEO = "Geometry", SC = "Screen";

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

  // Beam: the electron beam drawing each scanline (main pass, beam chunk).
  range("sharpness", "Horizontal sharpness", B, 0, 1, 0.01, 0.6),
  range("beamMin", "Beam width (dark)", B, 0.12, 0.6, 0.01, 0.2, { hint: "Spot size at black, in scanlines." }),
  range("beamMax", "Beam width (bright)", B, 0.2, 1, 0.01, 0.4, { hint: "Spot size at white, in scanlines." }),
  range("beamShape", "Beam shape", B, 2, 4, 0.1, 2.5, { hint: "2 = Gaussian, 4 = flatter top." }),
  range("scanlineStrength", "Scanline strength", B, 0, 1, 0.01, 1),
  select("interlace", "Interlace", B, ["Off", "Bob", "Weave"]),
  range("crtGamma", "Tube gamma", B, 2.2, 2.8, 0.05, 2.4),
  range("persistence", "Phosphor persistence", B, 0, 0.5, 0.01, 0.15),

  // Mask: phosphor layout, drawn in device pixels (main pass, mask chunk).
  select("maskType", "Mask type", M, ["None", "Aperture grille", "Slot mask", "Shadow mask", "Magenta-green", "RGBX"], MASK.aperture),
  range("maskStrength", "Mask strength", M, 0, 1, 0.01, 0.4),
  range("maskTVL", "Mask fineness", M, 250, 900, 10, 350, { unit: "TVL" }),
  select("maskWidth", "Triad width", M, ["Auto", "2 px", "3 px", "4 px", "6 px"]),
  range("slotHeight", "Slot height", M, 2, 6, 1, 4, { unit: "px" }),
  select("subpixelOrder", "Display subpixels", M, ["RGB", "BGR"]),

  // Glow: light spread inside and through the glass (glow / diffuse passes, combined in main).
  range("glow", "Glow", G, 0, 0.5, 0.01, 0.1),
  range("glowSigma", "Glow radius", G, 0.5, 4, 0.1, 1.5, { unit: "px" }),
  range("halation", "Halation", G, 0, 0.3, 0.01, 0.05, { hint: "Light scattered under the mask." }),
  range("diffusion", "Diffusion", G, 0, 0.3, 0.01, 0.05, { hint: "Light scattered through the glass, over the mask." }),
  range("diffusionRadius", "Diffusion radius", G, 0.01, 0.1, 0.005, 0.03),

  // Geometry: tube shape and beam alignment (main pass, geometry chunk).
  range("curvatureX", "Curvature (horizontal)", GEO, 0, 0.15, 0.005, 0.03),
  range("curvatureY", "Curvature (vertical)", GEO, 0, 0.15, 0.005, 0.04),
  range("cornerRadius", "Corner radius", GEO, 0, 0.1, 0.005, 0.03),
  range("edgeSoftness", "Edge softness", GEO, 0, 0.02, 0.001, 0.005),
  range("convergenceR", "Red convergence", GEO, -2, 2, 0.05, 0.3, { unit: "px" }),
  range("convergenceB", "Blue convergence", GEO, -2, 2, 0.05, -0.3, { unit: "px" }),
  range("radialConvergence", "Edge misconvergence", GEO, 0, 1, 0.05, 0),

  // Screen: final output (main pass, post chunk).
  range("autoExposure", "Brightness compensation", SC, 0, 1, 0.01, 0.8,
    { hint: "Restores light lost to the mask and scanlines." }),
  range("brightness", "Brightness", SC, 0.5, 2, 0.01, 1),
  range("vignette", "Vignette", SC, 0, 1, 0.01, 0.2),
  range("reflection", "Glass reflection", SC, 0, 0.3, 0.01, 0.05),
  range("noise", "Static noise", SC, 0, 0.1, 0.005, 0.015, { animated: true }),
  range("flicker", "Flicker", SC, 0, 0.05, 0.005, 0, { animated: true }),
  range("humBar", "Hum bar", SC, 0, 0.1, 0.005, 0, { animated: true }),
  select("displayGamma", "Display gamma", SC, ["sRGB", "2.2", "2.4"]),
];
