import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveCrt } from "../../renderer/shader/effects/crt/derive";
import { CRT_GROUPS, CRT_PARAMS } from "../../renderer/shader/effects/crt/params";
import { CRT_PASSES } from "../../renderer/shader/effects/crt/pipeline";
import { CRT_PRESETS } from "../../renderer/shader/effects/crt/presets";
import { presetProblems, resolveValues } from "../../renderer/shader/effects/params";
import { resolveIncludes } from "../../renderer/shader/gl/includes";

const CRT_DIR = join(__dirname, "../../renderer/shader/effects/crt");

function shaderFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return shaderFiles(path);
    return /\.(frag|glsl)$/.test(name) ? [path] : [];
  });
}

/** Include chunks read from disk (the app loads the same files through import.meta.glob). */
function chunksIn(dir: string): Record<string, string> {
  return Object.fromEntries(readdirSync(dir).filter((n) => n.endsWith(".glsl"))
    .map((n) => [n.replace(/\.glsl$/, ""), readFileSync(join(dir, n), "utf8")]));
}
const CHUNKS = { ...chunksIn(join(CRT_DIR, "../../glsl/common")), ...chunksIn(join(CRT_DIR, "glsl")) };

describe("CRT definition", () => {
  it("has unique parameter ids", () => {
    const ids = CRT_PARAMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("puts every parameter in a declared group", () => {
    for (const p of CRT_PARAMS) expect(CRT_GROUPS, p.id).toContain(p.group);
  });
  it("keeps every default inside its own range", () => {
    for (const p of CRT_PARAMS) expect(resolveValues([p], { [p.id]: p.default })[p.id], p.id).toBe(p.default);
  });
  it.each(CRT_PRESETS.map((p) => [p.id, p] as const))("preset %s has no problems", (_id, preset) => {
    expect(presetProblems(CRT_PARAMS, preset)).toEqual([]);
  });
  it("has unique preset and pass ids", () => {
    expect(new Set(CRT_PRESETS.map((p) => p.id)).size).toBe(CRT_PRESETS.length);
    expect(new Set(CRT_PASSES.map((p) => p.id)).size).toBe(CRT_PASSES.length);
  });
});

describe("CRT shader consistency", () => {
  const paramIds = new Set(CRT_PARAMS.map((p) => p.id));
  const derivedKeys = new Set(
    Object.keys(deriveCrt(resolveValues(CRT_PARAMS), { viewport: { width: 1920, height: 1080 }, video: { width: 1920, height: 1080 } })),
  );
  const files = shaderFiles(CRT_DIR);

  it("finds shader files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.slice(CRT_DIR.length + 1), f] as const))("%s uses only real p_/d_ identifiers", (_n, file) => {
    const src = readFileSync(file, "utf8").replace(/\/\/.*$/gm, "");
    const bad: string[] = [];
    for (const m of src.matchAll(/\b([pd])_([A-Za-z0-9_]+)\b/g)) {
      const known = m[1] === "p" ? paramIds : derivedKeys;
      if (!known.has(m[2])) bad.push(m[0]);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it.each(CRT_PASSES.map((p) => [p.id, p] as const))("pass %s declares every sampler in its inputs", (_id, pass) => {
    const src = resolveIncludes(pass.frag, CHUNKS).replace(/\/\/.*$/gm, "");
    for (const sampler of Object.keys(pass.inputs)) {
      expect(src, `${pass.id}: ${sampler}`).toMatch(new RegExp(`uniform\\s+(?:highp\\s+)?sampler2D\\s+${sampler}\\b`));
    }
  });
});
