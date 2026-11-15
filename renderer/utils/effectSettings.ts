import { applyPreset, defaultValues, resolveValues, sanitizeValue } from "../shader/effects/params";
import type { EffectDefinition, ParamValues } from "../shader/effects/types";

/** presetId is "custom" once a value has been edited by hand or reset to defaults. */
export const CUSTOM = "custom";

export interface EffectState {
  presetId: string;
  values: ParamValues;
}

/** `active` is the effect being drawn (null = off); `last` is what toggling back on restores. */
export interface Selection {
  active: string | null;
  last: string | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export function initialState(effect: EffectDefinition): EffectState {
  const first = effect.presets[0];
  return first ? { presetId: first.id, values: applyPreset(effect, first) } : { presetId: CUSTOM, values: defaultValues(effect.params) };
}

/** Rebuilds a state from untrusted stored data; anything stale, unknown or out of range falls back. */
export function healState(effect: EffectDefinition, raw: unknown): EffectState {
  if (!isRecord(raw) || !isRecord(raw.values)) return initialState(effect);
  const partial: ParamValues = {};
  for (const p of effect.params) {
    const v = raw.values[p.id];
    if (typeof v === "number") partial[p.id] = v;
  }
  const knownPreset = effect.presets.some((p) => p.id === raw.presetId);
  return { presetId: knownPreset ? String(raw.presetId) : CUSTOM, values: resolveValues(effect.params, partial) };
}

export function healSelection(effects: EffectDefinition[], raw: unknown): Selection {
  const known = (v: unknown): string | null => (typeof v === "string" && effects.some((e) => e.id === v) ? v : null);
  if (!isRecord(raw)) return { active: null, last: null };
  const active = known(raw.active);
  return { active, last: active ?? known(raw.last) };
}

/** The effect whose settings the panel shows: the active one, else the last used, else the first registered. */
export function selectedEffect(sel: Selection, effects: EffectDefinition[]): EffectDefinition | undefined {
  const id = sel.active ?? sel.last;
  return effects.find((e) => e.id === id) ?? effects[0];
}

export function setActive(sel: Selection, id: string | null, effects: EffectDefinition[]): Selection {
  if (id === null) return { active: null, last: sel.active ?? sel.last };
  return effects.some((e) => e.id === id) ? { active: id, last: id } : sel;
}

export function toggleActive(sel: Selection, effects: EffectDefinition[]): Selection {
  if (sel.active) return setActive(sel, null, effects);
  const next = selectedEffect(sel, effects);
  return next ? setActive(sel, next.id, effects) : sel;
}

export function editValue(effect: EffectDefinition, s: EffectState, id: string, v: number): EffectState {
  const spec = effect.params.find((p) => p.id === id);
  if (!spec) return s;
  return { presetId: CUSTOM, values: { ...s.values, [id]: sanitizeValue(spec, v) } };
}

export function resetParamValue(effect: EffectDefinition, s: EffectState, id: string): EffectState {
  const spec = effect.params.find((p) => p.id === id);
  return spec ? editValue(effect, s, id, spec.default) : s;
}

export function choosePreset(effect: EffectDefinition, s: EffectState, presetId: string): EffectState {
  const preset = effect.presets.find((p) => p.id === presetId);
  return preset ? { presetId: preset.id, values: applyPreset(effect, preset) } : s;
}

export function resetState(effect: EffectDefinition): EffectState {
  return { presetId: CUSTOM, values: defaultValues(effect.params) };
}
