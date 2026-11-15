import type { EffectDefinition, ParamSpec, ParamValues, Preset } from "./types";

type Extra = Pick<ParamSpec, "unit" | "animated" | "hint">;

/** Builders keep parameter tables to one line per parameter. */
export const range = (
  id: string, label: string, group: string,
  min: number, max: number, step: number, def: number, extra: Extra = {},
): ParamSpec => ({ id, label, group, kind: "range", min, max, step, default: def, ...extra });

export const select = (
  id: string, label: string, group: string, options: string[], def = 0, extra: Extra = {},
): ParamSpec => ({ id, label, group, kind: "select", options, default: def, min: 0, max: options.length - 1, step: 1, ...extra });

export const toggle = (
  id: string, label: string, group: string, def: boolean, extra: Extra = {},
): ParamSpec => ({ id, label, group, kind: "toggle", default: def ? 1 : 0, min: 0, max: 1, step: 1, ...extra });

export function defaultValues(params: ParamSpec[]): ParamValues {
  return Object.fromEntries(params.map((p) => [p.id, p.default]));
}

/** Clamps to the declared range and snaps selects/toggles to whole numbers. */
export function sanitizeValue(spec: ParamSpec, value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : spec.default;
  const clamped = Math.min(spec.max ?? n, Math.max(spec.min ?? n, n));
  return spec.kind === "range" ? clamped : Math.round(clamped);
}

/** Defaults, overlaid with any known, in-range entries from `partial`. Unknown keys are dropped. */
export function resolveValues(params: ParamSpec[], partial: Partial<ParamValues> = {}): ParamValues {
  return Object.fromEntries(
    params.map((p) => [p.id, p.id in partial ? sanitizeValue(p, partial[p.id]) : p.default]),
  );
}

export function applyPreset(effect: EffectDefinition, preset: Preset): ParamValues {
  return resolveValues(effect.params, preset.values);
}

/** Problems that would make a preset silently wrong: unknown ids or out-of-range values. */
export function presetProblems(params: ParamSpec[], preset: Preset): string[] {
  const byId = new Map(params.map((p) => [p.id, p]));
  return Object.entries(preset.values).flatMap(([id, v]) => {
    const spec = byId.get(id);
    if (!spec) return [`${preset.id}: unknown parameter "${id}"`];
    return sanitizeValue(spec, v) === v ? [] : [`${preset.id}: "${id}" = ${v} is out of range`];
  });
}
