import { describe, expect, it } from "vitest";
import { range, select, toggle } from "../../renderer/shader/effects/params";
import type { EffectDefinition } from "../../renderer/shader/effects/types";
import {
  choosePreset, editValue, healSelection, healState, initialState, resetParamValue, resetState,
  selectedEffect, setActive, toggleActive,
} from "../../renderer/utils/effectSettings";

const make = (id: string): EffectDefinition => ({
  id, label: id,
  params: [range("amount", "Amount", "G", 0, 1, 0.1, 0.5), select("mode", "Mode", "G", ["a", "b", "c"], 1), toggle("on", "On", "G", false)],
  groups: ["G"],
  presets: [{ id: "p1", label: "P1", values: { amount: 0.9 } }, { id: "p2", label: "P2", values: { mode: 2 } }],
  derive: () => ({}), pointerToSource: () => null, passes: [], chunks: {},
});
const A = make("a");
const B = make("b");
const effects = [A, B];

describe("effect settings", () => {
  it("starts from the first preset", () => {
    expect(initialState(A)).toEqual({ presetId: "p1", values: { amount: 0.9, mode: 1, on: 0 } });
  });

  it("marks the preset custom on edit and clamps the value", () => {
    const s = editValue(A, initialState(A), "amount", 7);
    expect(s.presetId).toBe("custom");
    expect(s.values.amount).toBe(1);
  });

  it("ignores edits to unknown parameters", () => {
    const s = initialState(A);
    expect(editValue(A, s, "nope", 1)).toBe(s);
  });

  it("applies a preset over defaults, not over previous edits", () => {
    const edited = editValue(A, initialState(A), "amount", 0.1);
    expect(choosePreset(A, edited, "p2")).toEqual({ presetId: "p2", values: { amount: 0.5, mode: 2, on: 0 } });
  });

  it("heals stale, unknown and out-of-range stored data", () => {
    const s = healState(A, { presetId: "gone", values: { amount: 99, mode: "x", old: 3, on: 1.4 } });
    expect(s).toEqual({ presetId: "custom", values: { amount: 1, mode: 1, on: 1 } });
    expect(healState(A, "garbage")).toEqual(initialState(A));
    expect(healState(A, { presetId: "p2", values: { mode: 2 } }).presetId).toBe("p2");
  });

  it("heals the stored selection", () => {
    expect(healSelection(effects, { active: "zzz", last: "b" })).toEqual({ active: null, last: "b" });
    expect(healSelection(effects, { active: "zzz", last: "zzz" })).toEqual({ active: null, last: null });
  });

  it("first run (nothing stored) turns the first registered effect on", () => {
    expect(healSelection(effects, null)).toEqual({ active: "a", last: "a" });
    expect(healSelection(effects, undefined)).toEqual({ active: "a", last: "a" });
    expect(healSelection([], null)).toEqual({ active: null, last: null });
  });

  it("keeps a stored off: active null stays off and last is kept", () => {
    expect(healSelection(effects, { active: null, last: "b" })).toEqual({ active: null, last: "b" });
    expect(healSelection(effects, { active: null, last: null })).toEqual({ active: null, last: null });
  });

  it("treats a present but non-record stored value as corrupt and stays off", () => {
    expect(healSelection(effects, "garbage")).toEqual({ active: null, last: null });
    expect(healSelection(effects, 0)).toEqual({ active: null, last: null });
  });

  it("toggle remembers the last effect and defaults to the first", () => {
    let sel = { active: null, last: null } as ReturnType<typeof healSelection>;
    sel = toggleActive(sel, effects);
    expect(sel.active).toBe("a");
    sel = setActive(sel, "b", effects);
    sel = toggleActive(sel, effects);
    expect(sel).toEqual({ active: null, last: "b" });
    expect(selectedEffect(sel, effects)).toBe(B);
    expect(toggleActive(sel, effects).active).toBe("b");
  });

  it("reset restores parameter defaults as custom; resetParam restores one", () => {
    expect(resetState(A)).toEqual({ presetId: "custom", values: { amount: 0.5, mode: 1, on: 0 } });
    const s = resetParamValue(A, initialState(A), "amount");
    expect(s.values.amount).toBe(0.5);
    expect(s.presetId).toBe("custom");
  });
});
