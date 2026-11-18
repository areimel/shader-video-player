import { describe, expect, it } from "vitest";
import { EFFECTS } from "../../renderer/shader/effects/registry";
import { applyPreset } from "../../renderer/shader/effects/params";
import { resolveExportSettings } from "../../renderer/utils/exportSettings";

describe("resolveExportSettings", () => {
  it("preset ids are unique across effects", () => {
    const ids = EFFECTS.flatMap((e) => e.presets.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("defaults to the first effect with its first preset", () => {
    const r = resolveExportSettings(EFFECTS);
    expect(r.effect).toBe(EFFECTS[0]);
    expect(r.values).toEqual(applyPreset(EFFECTS[0]!, EFFECTS[0]!.presets[0]!));
  });

  it("a preset id alone selects its effect", () => {
    const vhs = EFFECTS[1]!;
    const p = vhs.presets[1] ?? vhs.presets[0]!;
    const r = resolveExportSettings(EFFECTS, { preset: p.id });
    expect(r.effect).toBe(vhs);
    expect(r.values).toEqual(applyPreset(vhs, p));
  });

  it("raw values are healed: unknown keys dropped, out-of-range clamped", () => {
    const e = EFFECTS[0]!;
    const spec = e.params.find((p) => p.kind === "range")!;
    const r = resolveExportSettings(EFFECTS, { effect: e.id, raw: { [spec.id]: 1e9, bogus: 3 } });
    expect(r.values.bogus).toBeUndefined();
    expect(r.values[spec.id]).toBe(spec.max);
  });

  it("errors list the available ids", () => {
    expect(() => resolveExportSettings(EFFECTS, { effect: "nope" })).toThrow(EFFECTS[0]!.id);
    expect(() => resolveExportSettings(EFFECTS, { effect: EFFECTS[0]!.id, preset: "nope" })).toThrow(EFFECTS[0]!.presets[0]!.id);
  });
});
