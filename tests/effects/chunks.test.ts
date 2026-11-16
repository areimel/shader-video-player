import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EFFECTS } from "../../renderer/shader/effects/registry";
import { tubeChunks } from "../../renderer/shader/effects/shared/tube/chunks";
import { commonChunks } from "../../renderer/shader/gl/commonChunks";
import { pdNames, shaderFiles } from "./shaderNames";

const COMMON_DIR = join(__dirname, "../../renderer/shader/glsl/common");

describe("shared GLSL chunks", () => {
  const files = shaderFiles(COMMON_DIR);

  it("finds common chunks", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.slice(COMMON_DIR.length + 1), f] as const))("common chunk %s uses no p_/d_ names", (_n, file) => {
    expect(pdNames(readFileSync(file, "utf8"))).toEqual([]);
  });

  it.each(EFFECTS.map((e) => [e.id, e] as const))("effect %s has no chunk shadowing a common chunk", (_id, effect) => {
    const common = new Set(Object.keys(commonChunks));
    expect(Object.keys(effect.chunks).filter((k) => common.has(k))).toEqual([]);
  });

  it("tube chunks do not shadow common chunks", () => {
    const common = new Set(Object.keys(commonChunks));
    expect(Object.keys(tubeChunks).filter((k) => common.has(k))).toEqual([]);
  });
});
