import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { presetProblems, resolveValues } from "../../renderer/shader/effects/params";
import { EFFECTS } from "../../renderer/shader/effects/registry";
import { commonChunks } from "../../renderer/shader/gl/commonChunks";
import { resolveIncludes } from "../../renderer/shader/gl/includes";
import { shaderFiles, unknownNames } from "./shaderNames";

const EFFECTS_DIR = join(__dirname, "../../renderer/shader/effects");

describe.each(EFFECTS.map((e) => [e.id, e] as const))("effect %s definition", (id, effect) => {
  it("has unique parameter ids", () => {
    const ids = effect.params.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("puts every parameter in a declared group", () => {
    for (const p of effect.params) expect(effect.groups, p.id).toContain(p.group);
  });
  it("keeps every default inside its own range", () => {
    for (const p of effect.params) expect(resolveValues([p], { [p.id]: p.default })[p.id], p.id).toBe(p.default);
  });
  it("has presets without problems", () => {
    expect(effect.presets.length).toBeGreaterThan(0);
    for (const preset of effect.presets) expect(presetProblems(effect.params, preset), preset.id).toEqual([]);
  });
  it("has unique preset and pass ids", () => {
    expect(new Set(effect.presets.map((p) => p.id)).size).toBe(effect.presets.length);
    expect(new Set(effect.passes.map((p) => p.id)).size).toBe(effect.passes.length);
  });

  describe("shaders", () => {
    const dir = join(EFFECTS_DIR, id);
    const paramIds = new Set(effect.params.map((p) => p.id));
    const derivedKeys = new Set(
      Object.keys(effect.derive(resolveValues(effect.params), { viewport: { width: 1920, height: 1080 }, video: { width: 1920, height: 1080 } })),
    );
    const files = shaderFiles(dir);
    const chunks = { ...commonChunks, ...effect.chunks };

    it("has shader files", () => {
      expect(files.length).toBeGreaterThan(0);
    });
    it.each(files.map((f) => [f.slice(dir.length + 1), f] as const))("%s uses only real p_/d_ identifiers", (_n, file) => {
      expect(unknownNames(file, paramIds, derivedKeys)).toEqual([]);
    });
    it.each(effect.passes.map((p) => [p.id, p] as const))("pass %s declares every sampler in its inputs", (_pid, pass) => {
      const src = resolveIncludes(pass.frag, chunks).replace(/\/\/.*$/gm, "");
      for (const sampler of Object.keys(pass.inputs)) {
        expect(src, `${pass.id}: ${sampler}`).toMatch(new RegExp(`uniform\\s+(?:highp\\s+)?sampler2D\\s+${sampler}\\b`));
      }
    });
  });
});
