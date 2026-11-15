import { describe, expect, it } from "vitest";
import {
  presetProblems, range, resolveValues, sanitizeValue, select, toggle,
} from "../../renderer/shader/effects/params";
import type { ParamSpec } from "../../renderer/shader/effects/types";

const params: ParamSpec[] = [
  range("a", "A", "G", 0, 1, 0.1, 0.5),
  select("s", "S", "G", ["x", "y", "z"], 1),
  toggle("t", "T", "G", true),
  range("n", "N", "G", 0, 1, 0.1, 0, { animated: true }),
];

describe("sanitizeValue", () => {
  it("clamps ranges and keeps fractions", () => {
    expect(sanitizeValue(params[0], 2)).toBe(1);
    expect(sanitizeValue(params[0], -1)).toBe(0);
    expect(sanitizeValue(params[0], 0.37)).toBe(0.37);
  });
  it("rounds selects and toggles", () => {
    expect(sanitizeValue(params[1], 1.6)).toBe(2);
    expect(sanitizeValue(params[1], 9)).toBe(2);
    expect(sanitizeValue(params[2], 0.4)).toBe(0);
  });
  it("falls back to the default for non-numbers", () => {
    expect(sanitizeValue(params[0], NaN)).toBe(0.5);
    expect(sanitizeValue(params[0], "x")).toBe(0.5);
    expect(sanitizeValue(params[1], undefined)).toBe(1);
  });
});

describe("resolveValues", () => {
  it("returns defaults, overlays known keys, drops unknown ones", () => {
    expect(resolveValues(params)).toEqual({ a: 0.5, s: 1, t: 1, n: 0 });
    const v = resolveValues(params, { a: 3, bogus: 1, t: 0 });
    expect(v).toEqual({ a: 1, s: 1, t: 0, n: 0 });
    expect("bogus" in v).toBe(false);
  });
});

describe("presetProblems", () => {
  it("is empty for a valid preset", () => {
    expect(presetProblems(params, { id: "ok", label: "", values: { a: 0.2, s: 2 } })).toEqual([]);
  });
  it("reports unknown ids and out-of-range values", () => {
    const p = presetProblems(params, { id: "bad", label: "", values: { zzz: 1, a: 5, s: 1.5 } });
    expect(p).toHaveLength(3);
    expect(p.join("\n")).toMatch(/unknown parameter "zzz"/);
    expect(p.join("\n")).toMatch(/"a" = 5 is out of range/);
  });
});

