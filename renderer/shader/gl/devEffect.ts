import type { EffectDefinition } from "../effects/types";
import passthrough from "../glsl/passthrough.frag?raw";

/** Dev-only effect that exercises the GL path until the real effects are registered. */
export const devPassthroughEffect: EffectDefinition = {
  id: "dev-passthrough",
  label: "Passthrough (dev)",
  params: [],
  groups: [],
  presets: [],
  derive: () => ({}),
  chunks: {},
  passes: [{ id: "main", frag: passthrough, inputs: { uSource: "video" }, size: "viewport" }],
};
