import type { EffectDefinition } from "../types";
import { chunksFromGlob } from "../shared/chunks";
import { tubeChunks } from "../shared/tube/chunks";
import { deriveVhs } from "./derive";
import { VHS_GROUPS, VHS_PARAMS } from "./params";
import { VHS_PASSES } from "./pipeline";
import { VHS_PRESETS } from "./presets";

// The effect's own chunks (timebase, tape-noise, dropout, osd, ...). A glob over a missing or empty directory is {}.
const vhsChunks = chunksFromGlob(
  import.meta.glob<string>("./glsl/*.glsl", { query: "?raw", import: "default", eager: true }),
);

export const vhsEffect: EffectDefinition = {
  id: "vhs",
  label: "VHS tape",
  params: VHS_PARAMS,
  groups: VHS_GROUPS,
  presets: VHS_PRESETS,
  derive: deriveVhs,
  passes: VHS_PASSES,
  requiresFloat: true, // signed I/Q, modulated chroma, unclamped R'G'B', noise below 0 and above 1
  chunks: { ...tubeChunks, ...vhsChunks }, // common chunks are added by the engine
};
