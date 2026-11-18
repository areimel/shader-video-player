import { describe, expect, it } from "vitest";
import { partPath, uniqueName } from "../electron/media/outputName";
import { isSupportedExtension } from "../electron/media/formats";

describe("uniqueName", () => {
  it("uses the plain name when free", () => {
    expect(uniqueName("/o", "clip.svp", "mp4", () => false)).toBe("/o/clip.svp.mp4");
  });
  it("numbers collisions", () => {
    const taken = new Set(["/o/clip.svp.mp4", "/o/clip.svp (2).mp4"]);
    expect(uniqueName("/o", "clip.svp", "mp4", (p) => taken.has(p))).toBe("/o/clip.svp (3).mp4");
  });
});

describe("partPath", () => {
  it("appends .part, which the library walker ignores", () => {
    expect(partPath("/o/a.mp4")).toBe("/o/a.mp4.part");
    expect(isSupportedExtension(partPath("/o/a.mp4"))).toBe(false);
  });
});
