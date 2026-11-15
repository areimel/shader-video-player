import { describe, expect, it } from "vitest";
import type { PassSpec } from "../../renderer/shader/gl/passTypes";
import {
  isEnabled, parseSourceRef, resolveInputs, resolveSize, validatePasses,
} from "../../renderer/shader/gl/passPlan";

const pass = (id: string, inputs: Record<string, string>, extra: Partial<PassSpec> = {}): PassSpec =>
  ({ id, frag: "", inputs, size: "viewport", ...extra });

describe("parseSourceRef", () => {
  it("parses video, pass and prev refs", () => {
    expect(parseSourceRef("video")).toEqual({ kind: "video" });
    expect(parseSourceRef("a")).toEqual({ kind: "pass", id: "a", prev: false });
    expect(parseSourceRef("a:prev")).toEqual({ kind: "pass", id: "a", prev: true });
  });
});

describe("validatePasses", () => {
  it("accepts earlier reads, video, and :prev of feedback passes (including its own)", () => {
    expect(() => validatePasses([
      pass("a", { uSource: "video", uPrev: "a:prev" }, { feedback: true }),
      pass("b", { uSource: "a", uOld: "a:prev" }),
    ])).not.toThrow();
  });

  it("rejects unknown refs, forward reads, :prev without feedback and bad ids", () => {
    const run = (passes: PassSpec[]) => () => validatePasses(passes);
    expect(run([pass("a", { s: "ghost" }), pass("b", {})])).toThrow(/unknown pass "ghost"/);
    expect(run([pass("a", { s: "b" }), pass("b", {})])).toThrow(/earlier passes/);
    expect(run([pass("a", { s: "a" }), pass("b", {})])).toThrow(/earlier passes/);
    expect(run([pass("a", {}), pass("b", { s: "a:prev" })])).toThrow(/does not set feedback/);
    expect(run([pass("a", {}), pass("a", {})])).toThrow(/duplicate/);
    expect(run([pass("video", {})])).toThrow(/invalid pass id/);
    expect(run([])).toThrow(/at least one/);
  });

  it("rejects a feedback or disableable last pass and a disableable pass without inputs", () => {
    expect(() => validatePasses([pass("a", {}, { feedback: true })])).toThrow(/cannot use feedback/);
    expect(() => validatePasses([pass("a", {}, { enabled: () => true })])).toThrow(/cannot be disabled/);
    expect(() => validatePasses([pass("a", {}, { enabled: () => true }), pass("b", {})])).toThrow(/no input to forward/);
  });
});

describe("resolveSize", () => {
  const env = { viewport: { width: 1920, height: 1080 }, video: { width: 640, height: 480 }, values: { p_lines: 240 } };

  it("resolves viewport and function sizes, rounded to whole pixels >= 1", () => {
    expect(resolveSize(pass("a", {}), env)).toEqual({ width: 1920, height: 1080 });
    const fn = pass("a", {}, { size: (e) => ({ width: e.video.width * 1.5, height: e.values.p_lines }) });
    expect(resolveSize(fn, env)).toEqual({ width: 960, height: 240 });
    const bad = pass("a", {}, { size: () => ({ width: 0, height: NaN }) });
    expect(resolveSize(bad, env)).toEqual({ width: 1, height: 1 });
  });
});

describe("resolveInputs", () => {
  const passes = [
    pass("raster", { uSource: "video" }),
    pass("glow", { uSource: "raster" }, { enabled: (v) => v.p_glow > 0 }),
    pass("blur", { uSource: "glow" }, { enabled: (v) => v.p_blur > 0 }),
    pass("main", { uSource: "raster", uGlow: "glow", uBlur: "blur:prev" }),
  ];
  const sources = (enabled: boolean[]) =>
    resolveInputs(passes.map((p, i) => (i === 2 ? { ...p, feedback: true } : p)), enabled)
      .map((inputs) => inputs.map((i) => i.source));

  it("is the identity when everything is enabled", () => {
    expect(sources([true, true, true, true])[3]).toEqual([
      { kind: "pass", id: "raster", prev: false },
      { kind: "pass", id: "glow", prev: false },
      { kind: "pass", id: "blur", prev: true },
    ]);
  });

  it("forwards readers of a disabled pass to its first input, following chains", () => {
    const r = sources([true, false, false, true]);
    expect(r[1]).toEqual([]);
    expect(r[2]).toEqual([]);
    expect(r[3]).toEqual([
      { kind: "pass", id: "raster", prev: false },
      { kind: "pass", id: "raster", prev: false },
      { kind: "pass", id: "raster", prev: false },
    ]);
  });

  it("can forward all the way to the video", () => {
    const r = resolveInputs([pass("a", { s: "video" }, { enabled: () => false }), pass("b", { s: "a" })], [false, true]);
    expect(r[1][0].source).toEqual({ kind: "video" });
  });

  it("evaluates enabled predicates against values", () => {
    expect(isEnabled(passes[1], { p_glow: 0 })).toBe(false);
    expect(isEnabled(passes[1], { p_glow: 0.5 })).toBe(true);
    expect(isEnabled(passes[0], {})).toBe(true);
  });
});
