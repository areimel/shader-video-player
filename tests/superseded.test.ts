import { describe, expect, it } from "vitest";
import { isSuperseded, supersededError } from "../shared/superseded";

describe("superseded error", () => {
  it("is recognised directly and after IPC wrapping", () => {
    expect(isSuperseded(supersededError())).toBe(true);
    const wrapped = `Error invoking remote method 'media:restart': Error: ${supersededError().message}`;
    expect(isSuperseded(new Error(wrapped))).toBe(true);
    expect(isSuperseded(wrapped)).toBe(true);
  });
  it("does not match other errors", () => {
    expect(isSuperseded(new Error("Could not read this file"))).toBe(false);
  });
});
