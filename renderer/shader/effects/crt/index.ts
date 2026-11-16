import type { EffectDefinition } from "../types";
import { tubeChunks } from "../shared/tube/chunks";
import { deriveCrt } from "./derive";
import { CRT_GROUPS, CRT_PARAMS } from "./params";
import { CRT_PASSES } from "./pipeline";
import { CRT_PRESETS } from "./presets";

export const crtEffect: EffectDefinition = {
  id: "crt",
  label: "CRT television",
  params: CRT_PARAMS,
  groups: CRT_GROUPS,
  presets: CRT_PRESETS,
  derive: deriveCrt,
  passes: CRT_PASSES,
  requiresFloat: true, // signed I/Q, modulated chroma, values above 1 and a feedback loop that needs more than 8 bits
  chunks: { ...tubeChunks }, // CRT has no chunks of its own; common chunks are added by the engine
};
