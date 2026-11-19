import { describe, expect, it } from "vitest";
import { EFFECTS } from "../../renderer/shader/effects/registry";
import { effectUniforms } from "../../renderer/shader/gl/effectUniforms";

const size = { width: 640, height: 480 };

describe("effectUniforms", () => {
  it("prefixes user values with p_ and derived with d_, without double prefixes", () => {
    const effect = { derive: () => ({ foo: 2, d_bar: 3 }) };
    expect(effectUniforms(effect, { a: 1, p_b: 4 }, size, size)).toEqual({ p_a: 1, p_b: 4, d_foo: 2, d_bar: 3 });
  });

  it("passes viewport and video size to derive", () => {
    let seen: unknown;
    effectUniforms({ derive: (_v, env) => { seen = env; return {}; } }, {}, size, { width: 10, height: 20 });
    expect(seen).toEqual({ viewport: size, video: { width: 10, height: 20 } });
  });

  for (const effect of EFFECTS) {
    it(`${effect.id}: default values yield p_ for every param and some d_ values`, () => {
      const values = Object.fromEntries(effect.params.map((p) => [p.id, p.default]));
      const u = effectUniforms(effect, values, size, { width: 320, height: 240 });
      for (const p of effect.params) expect(u[`p_${p.id}`]).toBe(p.default);
      expect(Object.keys(u).some((k) => k.startsWith("d_"))).toBe(true);
      expect(Object.values(u).every(Number.isFinite)).toBe(true);
    });
  }
});
