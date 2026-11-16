import { describe, expect, it } from "vitest";
import { EFFECTS } from "../../renderer/shader/effects/registry";
import { homeValues } from "../../renderer/utils/home/effectValues";

const defaults = (fx: (typeof EFFECTS)[number]) => Object.fromEntries(fx.params.map((p) => [p.id, p.default]));

describe("homeValues", () => {
  it("applies framing overrides only to declared parameters, for every registered effect", () => {
    for (const fx of EFFECTS) {
      const values = defaults(fx);
      const out = homeValues(fx, values);
      const ids = new Set(fx.params.map((p) => p.id));
      if (ids.has("overscan")) expect(out.overscan).toBe(0);
      else expect("overscan" in out).toBe(false);
      for (const id of ["contentFit", "frameFit"]) {
        const spec = fx.params.find((p) => p.id === id);
        if (spec) expect(spec.options![out[id]!]).toMatch(/letterbox/i);
        else expect(id in out).toBe(false);
      }
    }
  });

  it("does not mutate the input and returns it unchanged when nothing differs", () => {
    for (const fx of EFFECTS) {
      const values = defaults(fx);
      const snapshot = { ...values };
      const out = homeValues(fx, values);
      expect(values).toEqual(snapshot);
      expect(homeValues(fx, out)).toBe(out);
    }
  });

  it("leaves every other value alone", () => {
    const fx = EFFECTS[0]!;
    const values = { ...defaults(fx), overscan: 0.08 };
    const out = homeValues(fx, values);
    for (const [k, v] of Object.entries(values)) if (k !== "overscan" && k !== "contentFit") expect(out[k]).toBe(v);
  });

  it("ignores effects without those parameters", () => {
    const values = { a: 1 };
    expect(homeValues({ params: [{ id: "a", kind: "range" }] }, values)).toBe(values);
  });
});
