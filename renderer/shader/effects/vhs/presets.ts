import type { Preset } from "../types";
import { MASK } from "../shared/tube/params";
import { OSD_MODE, TAPE_SPEED } from "./params";

/** Starting points; each lists only what differs from the defaults. `home-sp` is first: new users get it. */
export const VHS_PRESETS: Preset[] = [
  { id: "home-sp", label: "Home recording (SP)", values: {} },
  {
    id: "rental", label: "Worn rental",
    values: {
      generation: 1, saturation: 0.9, sharpening: 0.45, chromaSmear: 1.3, lumaNoise: 0.25, chromaNoise: 0.35,
      lineJitter: 0.35, wobble: 0.7, topSkew: 2.5, headSwitch: 7, headSwitchNoise: 0.5, dropouts: 0.3, dropoutLength: 12,
      tracking: 0.12, trackingRoll: 0.03,
    },
  },
  {
    id: "ep", label: "Six-hour EP",
    values: {
      tapeSpeed: TAPE_SPEED.ep, saturation: 0.9, lumaBandwidthSP: 2.8, chromaBandwidthSP: 0.35, chromaDelay: 1.3, chromaSmear: 1.3,
      lumaNoise: 0.22, chromaNoise: 0.25, lineJitter: 0.35, wobble: 0.6, dropouts: 0.05,
    },
  },
  {
    id: "camcorder", label: "Camcorder (date stamp)",
    values: {
      osdMode: OSD_MODE.camcorder, saturation: 1.1, sharpening: 0.5, lumaNoise: 0.2, chromaNoise: 0.25,
      lineJitter: 0.15, wobble: 0.2, topSkew: 1, headSwitch: 4,
    },
  },
  {
    id: "vcr-tv", label: "VCR on a TV",
    values: {
      tv: 1, osdMode: OSD_MODE.vcr, tapeLines: 0, headSwitch: 0, // the TV's overscan hides the head switch
      topSkew: 1,
      maskType: MASK.shadow, maskTVL: 300, maskStrength: 0.35,
      beamMin: 0.22, beamMax: 0.42, beamShape: 2,
      curvatureX: 0.04, curvatureY: 0.05, cornerRadius: 0.04, vignette: 0.3,
      glow: 0.15, diffusion: 0.08, halation: 0.08, persistence: 0.25,
      convergenceR: 0.5, convergenceB: -0.5, crtGamma: 2.5,
    },
  },
  {
    id: "dub", label: "Third-generation dub",
    values: {
      generation: 2, saturation: 0.85, sharpening: 0.55, chromaSmear: 1.5, lumaNoise: 0.15, chromaNoise: 0.2,
      lineJitter: 0.3, wobble: 0.6, topSkew: 2, dropouts: 0.1, // derive: x3 chroma delay, x0.8 bandwidth, x sqrt(3) noise
    },
  },
  {
    id: "tracking", label: "Bad tracking",
    values: {
      tracking: 0.75, trackingRoll: 0.12, lineJitter: 0.8, wobble: 1.5, topSkew: 4, headSwitch: 8,
      headSwitchNoise: 0.8, dropouts: 0.6, lumaNoise: 0.3, chromaNoise: 0.4,
    },
  },
];
