import type { EffectDefinition } from "../types";
import { deriveCrt } from "./derive";
import { CRT_GROUPS, CRT_PARAMS } from "./params";
import { CRT_PASSES } from "./pipeline";
import { CRT_PRESETS } from "./presets";

/** Effect-local `#include` chunks: every glsl/*.glsl file, keyed by bare name. */
const files = import.meta.glob<string>("./glsl/*.glsl", { query: "?raw", import: "default", eager: true });
const chunks: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, src]) => [path.replace(/^.*\/|\.glsl$/g, ""), src]),
);

export const crtEffect: EffectDefinition = {
  id: "crt",
  label: "CRT television",
  params: CRT_PARAMS,
  groups: CRT_GROUPS,
  presets: CRT_PRESETS,
  derive: deriveCrt,
  passes: CRT_PASSES,
  chunks,
};
