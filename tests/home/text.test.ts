import { describe, expect, it } from "vitest";
import { clip, clipWords, fit, formatDate, formatDuration, formatResolution, marquee, wrap } from "../../renderer/utils/home/text";

describe("fit and clip", () => {
  it("upper-cases, pads and truncates", () => {
    expect(fit("abc", 5)).toBe("ABC  ");
    expect(fit("abcdef", 4)).toBe("ABCD");
    expect(clip("abcdef", 4)).toBe("ABCD");
  });
  it("counts code points, keeping non-Latin text", () => {
    expect(fit("日本語", 4)).toBe("日本語 ");
    expect(Array.from(fit("😀😀😀", 2))).toHaveLength(2);
  });
});

describe("marquee", () => {
  const t = "ABCDEFGHIJ";
  it("fits short text", () => expect(marquee("ab", 4, 3)).toBe("AB  "));
  it("rests at the start, scrolls 4 cells/s, rests at the end, returns", () => {
    expect(marquee(t, 6, 0)).toBe("ABCDEF");
    expect(marquee(t, 6, 0.9)).toBe("ABCDEF");
    expect(marquee(t, 6, 1.25)).toBe("BCDEFG");
    expect(marquee(t, 6, 2.1)).toBe("EFGHIJ"); // overflow 4 = 1s of travel
    expect(marquee(t, 6, 2.5)).toBe("EFGHIJ");
    expect(marquee(t, 6, 3.5)).toBe("CDEFGH");
    expect(marquee(t, 6, 100).length).toBe(6);
  });
});

describe("formatters", () => {
  it("duration", () => {
    expect(formatDuration(4012)).toBe("1:06:52");
    expect(formatDuration(6400)).toBe("1:46:40");
    expect(formatDuration(252)).toBe("4:12");
    expect(formatDuration(null)).toBe("--:--");
  });
  it("resolution", () => {
    expect(formatResolution(1920, 1080)).toBe("1080P");
    expect(formatResolution(1920, 800)).toBe("1080P");
    expect(formatResolution(1280, 720)).toBe("720P");
    expect(formatResolution(3840, 2160)).toBe("4K");
    expect(formatResolution(640, 480)).toBe("480P");
    expect(formatResolution(null, null)).toBe("");
  });
  it("date", () => {
    expect(formatDate("2026-11-16")).toBe("NOV 16");
    expect(formatDate("junk")).toBe("");
  });
});

describe("wrap", () => {
  it("wraps on words and splits long words", () => {
    expect(wrap("one two three four", 9)).toEqual(["one two", "three", "four"]);
    expect(wrap("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });
});

describe("clipWords", () => {
  it("backs a cut up to a word boundary when that keeps half the cells", () => {
    expect(clipWords("Third-generation dub", 18)).toBe("THIRD-GENERATION");
    expect(clipWords("The lord of the rings", 18)).toBe("THE LORD OF THE");
    expect(clipWords("Six-hour EP", 18)).toBe("SIX-HOUR EP");
    expect(clipWords("ab cdefghijklmnop", 10)).toBe("AB CDEFGHI");
    expect(clipWords("one two", 4)).toBe("ONE");
    expect(clipWords("anything", 0)).toBe("");
  });
});
