import type { PassSpec, Size } from "./passTypes";
import type { AnimatedParam } from "./renderPolicy";

/** The part of EffectDefinition the renderer needs (structural, so gl/ does not depend on effects/). */
export interface RunnableEffect {
  params: readonly AnimatedParam[];
  passes: readonly PassSpec[];
  chunks: Readonly<Record<string, string>>;
  requiresFloat?: boolean;
  derive(values: Record<string, number>, env: { viewport: Size; video: Size }): Record<string, number>;
}

const prefixed = (prefix: string, values: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k.startsWith(prefix) ? k : prefix + k, v]));

/** The full uniform map for one frame: user values as `p_<id>`, derived values as `d_<name>`. Pure. */
export function effectUniforms(
  effect: Pick<RunnableEffect, "derive">,
  userValues: Record<string, number>,
  viewport: Size,
  videoSize: Size,
): Record<string, number> {
  return {
    ...prefixed("p_", userValues),
    ...prefixed("d_", effect.derive(userValues, { viewport, video: videoSize })),
  };
}
