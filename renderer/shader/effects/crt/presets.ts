import type { Preset } from "../types";
import { MASK, SIGNAL } from "./params";

/**
 * Starting points; each lists only what differs from the defaults. Beam widths are in scanlines:
 * below about 0.33 the gaps between lines are clearly visible, above about 0.45 they close up.
 */
export const CRT_PRESETS: Preset[] = [
  {
    id: "composite-tv", label: "Consumer TV (composite)",
    values: {
      virtualLines: 1, signalMode: SIGNAL.composite,
      lumaBandwidth: 3, chromaBandwidth: 0.6, artifacting: 1, fringing: 0.8, ringing: 0.25, signalNoise: 0.03,
      maskType: MASK.shadow, maskTVL: 300, maskStrength: 0.35,
      beamMin: 0.22, beamMax: 0.42, beamShape: 2,
      curvatureX: 0.04, curvatureY: 0.05, cornerRadius: 0.04, vignette: 0.3,
      glow: 0.15, diffusion: 0.08, halation: 0.08, persistence: 0.25,
      convergenceR: 0.5, convergenceB: -0.5, colorTemp: 7500, crtGamma: 2.5,
    },
  },
  {
    id: "trinitron", label: "Trinitron (S-Video)",
    values: {
      signalMode: SIGNAL.svideo, lumaBandwidth: 4.5, chromaBandwidth: 1.2,
      maskType: MASK.aperture, maskTVL: 450, maskStrength: 0.45,
      beamMin: 0.2, beamMax: 0.36, beamShape: 2.5,
      curvatureX: 0.03, curvatureY: 0, cornerRadius: 0.02,
      glow: 0.1, diffusion: 0.05, colorTemp: 9300, crtGamma: 2.4,
    },
  },
  {
    id: "arcade", label: "Arcade monitor (RGB)",
    values: {
      virtualLines: 1, signalMode: SIGNAL.rgb, sharpness: 0.8,
      maskType: MASK.slot, maskTVL: 300, maskStrength: 0.5, slotHeight: 4,
      beamMin: 0.18, beamMax: 0.45, beamShape: 3,
      curvatureX: 0.06, curvatureY: 0.07, cornerRadius: 0.05,
      glow: 0.2, halation: 0.1, persistence: 0.2, crtGamma: 2.5,
      convergenceR: 0.4, convergenceB: 0, signalNoise: 0, jitter: 0,
    },
  },
  {
    id: "pvm", label: "Broadcast monitor (PVM)",
    values: {
      signalMode: SIGNAL.rgb, sharpness: 0.9,
      maskType: MASK.aperture, maskTVL: 700, maskStrength: 0.3,
      beamMin: 0.18, beamMax: 0.3, beamShape: 2,
      curvatureX: 0.01, curvatureY: 0.01, cornerRadius: 0.01, vignette: 0.1,
      glow: 0.05, diffusion: 0.02, halation: 0.02, persistence: 0.05,
      noise: 0, signalNoise: 0, jitter: 0, convergenceR: 0, convergenceB: 0, crtGamma: 2.4,
    },
  },
];
