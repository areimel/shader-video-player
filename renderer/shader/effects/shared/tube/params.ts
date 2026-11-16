import { range, select } from "../../params";
import type { ParamSpec } from "../../types";

/** Option orders are part of the shader contract: tube chunks compare `p_<id>` against these indexes. */
export const MASK_WIDTHS = [0, 2, 3, 4, 6]; // index 0 = auto
export const MASK = { none: 0, aperture: 1, slot: 2, shadow: 3, magentaGreen: 4, rgbx: 5 } as const;

/**
 * Widest beam sigma (in lines). beam.glsl sums only the 3 nearest lines (fetch budget: 18 raster taps + 2). At the worst
 * case (Gaussian, shape 2) the lines it leaves out hold 1.8% of the energy at sigma 0.55 but 3% at 0.6 and 17% at 1.0,
 * which would dim wide beams relative to derive.ts exposureGain. Past this value 3 lines are no longer accurate.
 */
export const BEAM_SIGMA_MAX = 0.55;

/** Panel group names for the tube's parameter groups (CRT: "Beam"...; VHS: "TV: Beam"...). */
export interface TubeGroups { beam: string; mask: string; glow: string; geometry: string; screen: string }

/** The groups in panel order. */
export const tubeGroupNames = (g: TubeGroups): string[] => [g.beam, g.mask, g.glow, g.geometry, g.screen];

/** The tube's parameters (tube passes, beam/geometry/mask/post chunks, deriveTube), in panel order. */
export function tubeParams(g: TubeGroups): ParamSpec[] {
  const B = g.beam, M = g.mask, G = g.glow, GEO = g.geometry, SC = g.screen;
  return [
    // Beam: the electron beam drawing each scanline (main pass, beam chunk).
    range("sharpness", "Horizontal sharpness", B, 0, 1, 0.01, 0.6),
    range("beamMin", "Beam width (dark)", B, 0.12, BEAM_SIGMA_MAX, 0.01, 0.2, { hint: "Spot size at black, in scanlines." }),
    range("beamMax", "Beam width (bright)", B, 0.2, BEAM_SIGMA_MAX, 0.01, 0.4, { hint: "Spot size at white, in scanlines." }),
    range("beamShape", "Beam shape", B, 2, 4, 0.1, 2.5, { hint: "2 = Gaussian, 4 = flatter top." }),
    range("scanlineStrength", "Scanline strength", B, 0, 1, 0.01, 1),
    select("interlace", "Interlace", B, ["Off", "Bob"]),
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
    range("glowSigma", "Glow radius", G, 0.5, 4, 0.1, 1.5, { unit: "lines" }),
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
}
