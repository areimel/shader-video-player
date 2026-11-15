import type { PassSpec, Size, SizeEnv, SourceRef } from "./passTypes";

/** Pure graph logic (no GL): validation, sizes and input resolution. */

export class GraphError extends Error {}

export type ResolvedSource = { kind: "video" } | { kind: "pass"; id: string; prev: boolean };
export interface ResolvedInput { sampler: string; source: ResolvedSource }

export function parseSourceRef(ref: SourceRef): ResolvedSource {
  if (ref === "video") return { kind: "video" };
  return ref.endsWith(":prev") ? { kind: "pass", id: ref.slice(0, -5), prev: true } : { kind: "pass", id: ref, prev: false };
}

/** Throws a GraphError listing every problem found. */
export function validatePasses(passes: readonly PassSpec[]): void {
  const errors: string[] = [];
  const index = new Map<string, number>();
  if (passes.length === 0) errors.push("a graph needs at least one pass");

  passes.forEach((p, i) => {
    if (!p.id || p.id === "video" || p.id.includes(":")) errors.push(`invalid pass id "${p.id}"`);
    if (index.has(p.id)) errors.push(`duplicate pass id "${p.id}"`);
    index.set(p.id, i);
  });

  passes.forEach((p, i) => {
    const last = i === passes.length - 1;
    if (last && p.feedback) errors.push(`last pass "${p.id}" renders to the canvas and cannot use feedback`);
    if (last && p.enabled) errors.push(`last pass "${p.id}" renders to the canvas and cannot be disabled`);
    if (p.enabled && Object.keys(p.inputs).length === 0) {
      errors.push(`pass "${p.id}" can be disabled but has no input to forward`);
    }
    for (const [sampler, ref] of Object.entries(p.inputs)) {
      const src = parseSourceRef(ref);
      if (src.kind === "video") continue;
      const at = index.get(src.id);
      const where = `pass "${p.id}" input ${sampler} -> "${ref}"`;
      if (at === undefined) errors.push(`${where}: unknown pass "${src.id}"`);
      else if (src.prev && !passes[at].feedback) errors.push(`${where}: "${src.id}" does not set feedback`);
      else if (!src.prev && at >= i) errors.push(`${where}: passes may only read earlier passes (use ":prev" for later or own output)`);
    }
  });

  if (errors.length) throw new GraphError(`Invalid pass graph:\n- ${errors.join("\n- ")}`);
}

const whole = (n: number) => (Number.isFinite(n) ? Math.max(1, Math.round(n)) : 1);

export function resolveSize(spec: PassSpec, env: SizeEnv): Size {
  const s = spec.size === "viewport" ? env.viewport : spec.size(env);
  return { width: whole(s.width), height: whole(s.height) };
}

export function isEnabled(spec: PassSpec, values: Record<string, number>): boolean {
  return spec.enabled ? spec.enabled(values) : true;
}

/**
 * Resolves each pass's inputs, forwarding reads of disabled passes to that pass's first input
 * (which may itself be disabled, so this follows the chain). Entries for disabled passes are empty.
 */
export function resolveInputs(passes: readonly PassSpec[], enabled: readonly boolean[]): ResolvedInput[][] {
  const byId = new Map(passes.map((p, i) => [p.id, i]));

  const follow = (ref: SourceRef, depth: number): ResolvedSource => {
    const src = parseSourceRef(ref);
    if (src.kind === "video") return src;
    const at = byId.get(src.id);
    if (at === undefined || depth > passes.length) throw new GraphError(`cannot resolve source "${ref}"`);
    if (enabled[at]) return src;
    const first = Object.values(passes[at].inputs)[0];
    if (first === undefined) throw new GraphError(`disabled pass "${src.id}" has no input to forward`);
    return follow(first, depth + 1);
  };

  return passes.map((p, i) =>
    enabled[i] ? Object.entries(p.inputs).map(([sampler, ref]) => ({ sampler, source: follow(ref, 0) })) : []);
}
