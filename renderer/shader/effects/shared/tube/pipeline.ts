import type { PassSpec, Size, SizeEnv, SourceRef } from "../../../gl/passGraph";
import linearize from "./passes/linearize.frag?raw";
import glowH from "./passes/glow-h.frag?raw";
import glowV from "./passes/glow-v.frag?raw";
import diffuseDown from "./passes/diffuse-down.frag?raw";
import diffuseUp from "./passes/diffuse-up.frag?raw";

const MAX_GLOW_WIDTH = 800;
const DIFFUSE_DIVISOR = 8;

export type TubePassId = "linearize" | "glowH" | "glowV" | "diffuseDown" | "diffuseUp";

export interface TubePassOptions {
  /** The raster the tube draws, samples x lines (CRT: d_virtualWidth x d_virtualLines; VHS: tape raster). */
  rasterSize: (env: SizeEnv) => Size;
  /** Optional per-pass predicates (VHS: TV stage on, amount > 0). A pass without one always runs. */
  enabled?: Partial<Record<TubePassId, (values: Record<string, number>) => boolean>>;
}

/** Sampler bindings for the effect's main pass, which draws the tube from these passes. */
export const TUBE_MAIN_INPUTS = { uSource: "linearize", uGlow: "glowV", uDiffuse: "diffuseUp" } as const;

const diffuseSize = ({ viewport }: SizeEnv) => ({
  width: Math.max(16, Math.round(viewport.width / DIFFUSE_DIVISOR)),
  height: Math.max(16, Math.round(viewport.height / DIFFUSE_DIVISOR)),
});

/**
 * linearize (feedback) -> glowH -> glowV, linearize -> diffuseDown -> diffuseUp.
 * `sourceId`: the pass (or "video") holding the gamma-encoded RGB raster.
 * `uSource` stays the first input of every pass: a disabled pass forwards its first input.
 */
export function tubePasses(sourceId: SourceRef, { rasterSize, enabled = {} }: TubePassOptions): PassSpec[] {
  const glowSize = (env: SizeEnv) => {
    const r = rasterSize(env);
    return { ...r, width: Math.min(r.width, MAX_GLOW_WIDTH) };
  };
  const passes: PassSpec[] = [
    { id: "linearize", frag: linearize, inputs: { uSource: sourceId, uPrev: "linearize:prev" }, size: rasterSize, feedback: true },
    { id: "glowH", frag: glowH, inputs: { uSource: "linearize" }, size: glowSize },
    { id: "glowV", frag: glowV, inputs: { uSource: "glowH" }, size: glowSize },
    { id: "diffuseDown", frag: diffuseDown, inputs: { uSource: "linearize" }, size: diffuseSize },
    { id: "diffuseUp", frag: diffuseUp, inputs: { uSource: "diffuseDown" }, size: diffuseSize },
  ];
  return passes.map((p) => {
    const pred = enabled[p.id as TubePassId];
    return pred ? { ...p, enabled: pred } : p; // no `enabled` key at all when none is given (CRT)
  });
}
