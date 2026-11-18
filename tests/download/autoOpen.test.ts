import { describe, expect, it } from "vitest";
import { shouldAutoOpen } from "../../electron/download/autoOpen";

describe("shouldAutoOpen", () => {
  it("opens when nothing is open and nothing changed", () => expect(shouldAutoOpen(null, 4, 4)).toBe(true));
  it("does not replace an open video", () => expect(shouldAutoOpen("/a.mp4", 4, 4)).toBe(false));
  it("does not override an open that started (or finished and closed) meanwhile", () => {
    expect(shouldAutoOpen(null, 4, 5)).toBe(false);
  });
});
