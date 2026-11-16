import { describe, expect, it } from "vitest";
import { formatRemaining, formatTime } from "../renderer/utils/format";

describe("formatRemaining", () => {
  it("shows the time left with a leading minus", () => {
    expect(formatRemaining(60, 125)).toBe("-1:05");
    expect(formatRemaining(0, 3725)).toBe("-1:02:05");
  });
  it("clamps to zero past the end", () => {
    expect(formatRemaining(130, 125)).toBe("-0:00");
  });
  it("falls back to elapsed time without a finite positive duration", () => {
    expect(formatRemaining(61, 0)).toBe(formatTime(61));
    expect(formatRemaining(61, NaN)).toBe("1:01");
    expect(formatRemaining(61, Infinity)).toBe("1:01");
    expect(formatRemaining(61, -5)).toBe("1:01");
  });
});
