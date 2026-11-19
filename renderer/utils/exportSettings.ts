import { applyPreset } from "../shader/effects/params";
import type { EffectDefinition, ParamValues } from "../shader/effects/types";
import { healState } from "./effectSettings";

export interface ExportSettingsInput {
  effect?: string | null;
  preset?: string | null;
  /** Explicit values (an app request, or a CLI settings file): untrusted, healed. */
  raw?: unknown;
}

export interface ResolvedExportSettings {
  effect: EffectDefinition;
  values: ParamValues;
}

const list = (ids: string[]) => ids.join(", ");

/**
 * Picks the effect and values an export uses. Order: `raw` values (healed against the effect), else
 * the named preset, else the effect's first preset. A preset id alone also selects its effect
 * (preset ids are unique across effects). Throws with the available ids on an unknown name.
 */
export function resolveExportSettings(effects: EffectDefinition[], input: ExportSettingsInput = {}): ResolvedExportSettings {
  const { effect: effectId, preset: presetId, raw } = input;
  let effect: EffectDefinition | undefined;
  if (effectId) {
    effect = effects.find((e) => e.id === effectId);
    if (!effect) throw new Error(`Unknown effect "${effectId}". Available: ${list(effects.map((e) => e.id))}`);
  } else if (presetId) {
    effect = effects.find((e) => e.presets.some((p) => p.id === presetId));
  }
  effect ??= effects[0];
  if (!effect) throw new Error("No effects are registered");

  if (raw !== undefined && raw !== null) {
    const values = healState(effect, { values: raw }).values;
    return { effect, values };
  }
  if (presetId) {
    const preset = effect.presets.find((p) => p.id === presetId);
    if (!preset) {
      throw new Error(`Unknown preset "${presetId}" for ${effect.id}. Available: ${list(effect.presets.map((p) => p.id))}`);
    }
    return { effect, values: applyPreset(effect, preset) };
  }
  return { effect, values: healState(effect, null).values };
}
