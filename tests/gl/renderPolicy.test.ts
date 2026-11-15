import { describe, expect, it } from "vitest";
import { clampDelta, hasActiveAnimation, shouldRender } from "../../renderer/shader/gl/renderPolicy";
import { formatShaderError } from "../../renderer/shader/gl/shaderError";

describe("render policy", () => {
  const params = [{ id: "flicker", animated: true }, { id: "gain" }];

  it("detects active animation only for animated, non-zero params", () => {
    expect(hasActiveAnimation(params, { flicker: 0, gain: 1 })).toBe(false);
    expect(hasActiveAnimation(params, { flicker: 0.2 })).toBe(true);
    expect(hasActiveAnimation(params, { gain: 1 })).toBe(false);
  });

  it("renders when dirty, or when animating while playing, never when idle", () => {
    expect(shouldRender({ dirty: true, playing: false, animating: false })).toBe(true);
    expect(shouldRender({ dirty: false, playing: true, animating: true })).toBe(true);
    expect(shouldRender({ dirty: false, playing: false, animating: true })).toBe(false);
    expect(shouldRender({ dirty: false, playing: true, animating: false })).toBe(false);
  });

  it("clamps the frame delta", () => {
    expect(clampDelta(5)).toBe(0.1);
    expect(clampDelta(-1)).toBe(0);
    expect(clampDelta(0.016)).toBe(0.016);
  });
});

describe("formatShaderError", () => {
  it("names the pass and shows numbered lines around the error", () => {
    const src = ["#version 300 es", "void main() {", "  foo();", "}"].join("\n");
    const msg = formatShaderError("glowH", "fragment shader compile", "ERROR: 0:3: 'foo' : no matching function", src);
    expect(msg).toContain('Pass "glowH"');
    expect(msg).toContain("> 3 |   foo();");
    expect(msg).toContain("  2 | void main() {");
  });
});
