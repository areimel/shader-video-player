import { describe, expect, it } from "vitest";
import { SUB_DELAY_STEP, SUB_SIZES, activeCues, stepDelay } from "../renderer/utils/subtitleTiming";

const cues = [
  { start: 1, end: 3, text: "a" },
  { start: 3, end: 5, text: "b" },
];

describe("activeCues", () => {
  it("includes start and excludes end", () => {
    expect(activeCues(cues, 1, 0).map((c) => c.text)).toEqual(["a"]);
    expect(activeCues(cues, 3, 0).map((c) => c.text)).toEqual(["b"]);
    expect(activeCues(cues, 5, 0)).toEqual([]);
  });
  it("positive delay shows cues later", () => {
    expect(activeCues(cues, 1.4, 0.5).map((c) => c.text)).toEqual([]); // t = 0.9, before the cue
    expect(activeCues(cues, 1.5, 0.4).map((c) => c.text)).toEqual(["a"]);
    expect(activeCues(cues, 2, 1).map((c) => c.text)).toEqual(["a"]);
  });
  it("negative delay shows cues earlier", () => {
    expect(activeCues(cues, 0.5, -0.5).map((c) => c.text)).toEqual(["a"]);
    expect(activeCues(cues, 0.5, -0.4).map((c) => c.text)).toEqual([]); // t = 0.9, still before the cue
  });
  it("returns the original objects and handles no cues", () => {
    expect(activeCues(cues, 1, 0)[0]).toBe(cues[0]);
    expect(activeCues([], 1, 0)).toEqual([]);
  });
});

describe("stepDelay", () => {
  it("steps by SUB_DELAY_STEP in both directions", () => {
    expect(SUB_DELAY_STEP).toBe(0.1);
    expect(stepDelay(0, 1)).toBe(0.1);
    expect(stepDelay(0, -1)).toBe(-0.1);
  });
  it("rounds to one decimal and avoids float drift", () => {
    let d = 0;
    for (let i = 0; i < 7; i++) d = stepDelay(d, 1);
    expect(d).toBe(0.7);
    expect(stepDelay(0.3, -1)).toBe(0.2);
  });
  it("normalises negative zero to zero", () => {
    expect(Object.is(stepDelay(0.1, -1), 0)).toBe(true);
  });
  it("clamps to +/-30 seconds", () => {
    expect(stepDelay(30, 1)).toBe(30);
    expect(stepDelay(29.95, 1)).toBe(30);
    expect(stepDelay(-30, -1)).toBe(-30);
  });
});

describe("SUB_SIZES", () => {
  it("lists four sizes with unique ids and ascending scale", () => {
    expect(SUB_SIZES.map((s) => s.id)).toEqual(["s", "m", "l", "xl"]);
    const scales = SUB_SIZES.map((s) => s.scale);
    expect([...scales].sort((a, b) => a - b)).toEqual(scales);
  });
});
