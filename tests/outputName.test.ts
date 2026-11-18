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
  it("appends .part to names with several dots and to paths with spaces", () => {
    expect(partPath("/My Videos/a.b.c.mkv")).toBe("/My Videos/a.b.c.mkv.part");
  });
  it("is not a supported extension even when the original was", () => {
    expect(isSupportedExtension(partPath("/o/a.mkv"))).toBe(false);
  });
});

describe("uniqueName edge cases", () => {
  it("keeps going through many collisions", () => {
    const taken = new Set<string>(["/o/clip.mp4"]);
    for (let n = 2; n <= 60; n++) taken.add(`/o/clip (${n}).mp4`);
    expect(uniqueName("/o", "clip", "mp4", (p) => taken.has(p))).toBe("/o/clip (61).mp4");
  });
  it("keeps dots, spaces and unicode in the base", () => {
    expect(uniqueName("/o", "my v1.2 - café 東京", "mp4", () => false)).toBe("/o/my v1.2 - café 東京.mp4");
    const taken = new Set(["/o/my v1.2 café.mp4"]);
    expect(uniqueName("/o", "my v1.2 café", "mp4", (p) => taken.has(p))).toBe("/o/my v1.2 café (2).mp4");
  });
  it("does not treat a base that already ends in a number specially", () => {
    const taken = new Set(["/o/clip (2).mp4"]);
    expect(uniqueName("/o", "clip (2)", "mp4", (p) => taken.has(p))).toBe("/o/clip (2) (2).mp4");
  });
});
