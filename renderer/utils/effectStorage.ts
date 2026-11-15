import type { EffectDefinition } from "../shader/effects/types";
import { healSelection, healState, type EffectState, type Selection } from "./effectSettings";

const SELECTION_KEY = "svp.effect.active";
const stateKey = (id: string) => `svp.effect.${id}`;

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota or storage disabled */ }
}

export const loadSelection = (effects: EffectDefinition[]): Selection => healSelection(effects, read(SELECTION_KEY));
export const saveSelection = (sel: Selection): void => write(SELECTION_KEY, sel);
export const loadState = (effect: EffectDefinition): EffectState => healState(effect, read(stateKey(effect.id)));
export const saveState = (id: string, s: EffectState): void => write(stateKey(id), s);
