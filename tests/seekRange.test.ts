import { describe, expect, it } from "vitest";
import { inSeekable, type Ranges } from "../renderer/utils/seekRange";

const ranges = (...pairs: [number, number][]): Ranges => ({
  length: pairs.length, start: (i) => pairs[i][0], end: (i) => pairs[i][1],
});

describe("inSeekable", () => {
  it("is false for a growing stream, which Chromium reports as 0–0", () => {
    expect(inSeekable(ranges([0, 0]), 0)).toBe(false);
    expect(inSeekable(ranges([0, 0]), 4)).toBe(false);
    expect(inSeekable(ranges(), 1)).toBe(false);
  });
  it("accepts a time inside a range, short of its end", () => {
    expect(inSeekable(ranges([0, 10]), 5)).toBe(true);
    expect(inSeekable(ranges([0, 10]), 9.75)).toBe(true);
    expect(inSeekable(ranges([0, 10]), 9.9)).toBe(false);
    expect(inSeekable(ranges([0, 10]), -1)).toBe(false);
  });
  it("checks every range", () => {
    expect(inSeekable(ranges([0, 2], [5, 10]), 6)).toBe(true);
    expect(inSeekable(ranges([0, 2], [5, 10]), 3)).toBe(false);
  });
});
