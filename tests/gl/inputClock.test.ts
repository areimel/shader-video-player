import { describe, expect, it } from "vitest";
import { CLOCK_FRAME_WRAP, InputClock } from "../../renderer/shader/gl/inputClock";

describe("input clock", () => {
  it("starts paused at zero and only counts running time", () => {
    const c = new InputClock(30);
    expect(c.running).toBe(false);
    expect(c.elapsed(5000)).toBe(0);
    c.resume(1000);
    expect(c.running).toBe(true);
    expect(c.elapsed(1000)).toBe(0);
    expect(c.elapsed(3500)).toBeCloseTo(2.5);
  });

  it("does not jump across a pause", () => {
    const c = new InputClock(30);
    c.resume(0);
    c.pause(2000);
    expect(c.elapsed(2000)).toBeCloseTo(2);
    expect(c.elapsed(60_000)).toBeCloseTo(2); // time passing while paused is not counted
    c.resume(60_000);
    expect(c.elapsed(60_000)).toBeCloseTo(2);
    expect(c.elapsed(61_000)).toBeCloseTo(3);
    expect(c.frame(61_000)).toBe(90);
  });

  it("ignores repeated pause and resume calls", () => {
    const c = new InputClock(30);
    c.resume(0);
    c.resume(1000); // already running: the run still started at 0
    expect(c.elapsed(2000)).toBeCloseTo(2);
    c.pause(2000);
    c.pause(5000);
    expect(c.elapsed(9000)).toBeCloseTo(2);
  });

  it("never goes backwards when a timestamp is earlier than the run start", () => {
    const c = new InputClock(30);
    c.resume(0);
    c.pause(1000);
    c.resume(5000);
    expect(c.elapsed(4000)).toBeCloseTo(1);
  });

  it("counts frames at the given rate, monotonically across pauses", () => {
    const c = new InputClock(30);
    c.resume(0);
    let last = -1;
    let t = 0;
    for (let i = 0; i < 500; i++) {
      t += 7 + (i % 13); // uneven timer jitter
      if (i % 50 === 25) c.pause(t);
      if (i % 50 === 40) c.resume(t);
      const f = c.frame(t);
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
    expect(new InputClock(60).frame(0)).toBe(0);
    const c60 = new InputClock(60);
    c60.resume(0);
    expect(c60.frame(1000)).toBe(60);
  });

  it("wraps the frame number to a multiple of 2 and 3, keeping parity and phase", () => {
    expect(CLOCK_FRAME_WRAP % 6).toBe(0);
    const c = new InputClock(30);
    c.resume(0);
    const wrapMs = (CLOCK_FRAME_WRAP / 30) * 1000;
    const halfFrame = 1000 / 60; // sample mid-frame: exact boundaries are at the mercy of float rounding
    const before = c.frame(wrapMs - halfFrame);
    const after = c.frame(wrapMs + halfFrame);
    expect(before).toBe(CLOCK_FRAME_WRAP - 1);
    expect(after).toBe(0);
    expect(c.frame(wrapMs * 3 + 1000)).toBe(30);
    expect(Number.isSafeInteger(c.frame(1e15))).toBe(true);
  });

  it("rejects a non-positive rate", () => {
    expect(() => new InputClock(0)).toThrow();
    expect(() => new InputClock(Number.NaN)).toThrow();
  });
});
