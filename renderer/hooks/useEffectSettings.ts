import { useCallback, useEffect, useMemo, useState } from "react";
import { EFFECTS } from "../shader/effects/registry";
import type { EffectDefinition, ParamValues } from "../shader/effects/types";
import {
  choosePreset, editValue, resetParamValue, resetState, selectedEffect, setActive, toggleActive,
  type EffectState, type Selection,
} from "../utils/effectSettings";
import { loadSelection, loadState, saveSelection, saveState } from "../utils/effectStorage";

interface Store {
  selection: Selection;
  states: Record<string, EffectState>;
}

export interface EffectSettings {
  /** The drawn effect, or null when off. Identity is stable; only `values` changes while editing. */
  effect: EffectDefinition | null;
  /** The effect the panel edits: the active one, else the last used. Differs from `effect` only while off. */
  selected: EffectDefinition | undefined;
  /** Values of `selected`. */
  values: ParamValues;
  presetId: string;
  setEffect: (id: string | null) => void;
  toggle: () => void;
  setValue: (paramId: string, v: number) => void;
  applyPreset: (presetId: string) => void;
  reset: () => void;
  resetParam: (paramId: string) => void;
}

const NO_VALUES: ParamValues = {};

/** Moves to `selection`, loading the newly selected effect's saved state so values are never missing. */
function moveTo(store: Store, selection: Selection): Store {
  const next = selectedEffect(selection, EFFECTS);
  if (!next || store.states[next.id]) return { ...store, selection };
  return { selection, states: { ...store.states, [next.id]: loadState(next) } };
}

const init = (): Store => moveTo({ selection: { active: null, last: null }, states: {} }, loadSelection(EFFECTS));

export function useEffectSettings(): EffectSettings {
  const [store, setStore] = useState(init);
  const selected = selectedEffect(store.selection, EFFECTS);
  const state = selected ? store.states[selected.id] : undefined;

  useEffect(() => saveSelection(store.selection), [store.selection]);
  useEffect(() => { if (selected && state) saveState(selected.id, state); }, [selected, state]);

  const edit = useCallback((fn: (effect: EffectDefinition, s: EffectState) => EffectState) => {
    setStore((s) => {
      const effect = selectedEffect(s.selection, EFFECTS);
      const cur = effect && s.states[effect.id];
      return effect && cur ? { ...s, states: { ...s.states, [effect.id]: fn(effect, cur) } } : s;
    });
  }, []);

  return useMemo(() => ({
    effect: selected && store.selection.active === selected.id ? selected : null,
    selected,
    values: state?.values ?? NO_VALUES,
    presetId: state?.presetId ?? "custom",
    setEffect: (id) => setStore((s) => moveTo(s, setActive(s.selection, id, EFFECTS))),
    toggle: () => setStore((s) => moveTo(s, toggleActive(s.selection, EFFECTS))),
    setValue: (id, v) => edit((e, s) => editValue(e, s, id, v)),
    applyPreset: (id) => edit((e, s) => choosePreset(e, s, id)),
    reset: () => edit((e) => resetState(e)),
    resetParam: (id) => edit((e, s) => resetParamValue(e, s, id)),
  }), [store.selection, selected, state, edit]);
}
