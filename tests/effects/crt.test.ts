import { describe, expect, it } from "vitest";
import { crtEffect } from "../../renderer/shader/effects/crt";

// Checks that hold for every effect (params, presets, passes, shader identifiers) are in definitions.test.ts.
describe("CRT contract details", () => {
  it("requires float render targets", () => {
    expect(crtEffect.requiresFloat).toBe(true);
  });
});
