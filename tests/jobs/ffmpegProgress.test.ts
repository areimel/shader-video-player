import { describe, expect, it } from "vitest";
import { createFfmpegProgress } from "../../electron/jobs/ffmpegProgress";

describe("createFfmpegProgress", () => {
  it("reads out_time_us", () => {
    const p = createFfmpegProgress(10);
    expect(p.push("frame=1\nout_time_us=2500000\nprogress=continue\n")).toBeCloseTo(0.25);
    expect(p.ended).toBe(false);
  });
  it("reads out_time_ms as microseconds and out_time as a clock", () => {
    expect(createFfmpegProgress(10).push("out_time_ms=5000000\n")).toBeCloseTo(0.5);
    expect(createFfmpegProgress(100).push("out_time=00:01:00.500000\n")).toBeCloseTo(0.605);
  });
  it("ignores N/A and negatives", () => {
    const p = createFfmpegProgress(10);
    expect(p.push("out_time_us=N/A\nout_time=N/A\n")).toBeNull();
    expect(p.push("out_time_us=-9223372036854775807\n")).toBe(0);
  });
  it("handles lines split across chunks", () => {
    const p = createFfmpegProgress(10);
    expect(p.push("out_time_us=50")).toBeNull();
    expect(p.push("00000\nprog")).toBeCloseTo(0.5);
    expect(p.push("ress=end\n")).toBe(1);
    expect(p.ended).toBe(true);
  });
  it("clamps and tolerates unknown duration", () => {
    expect(createFfmpegProgress(1).push("out_time_us=9000000\n")).toBe(1);
    expect(createFfmpegProgress(0).push("out_time_us=9000000\n")).toBeNull();
  });
  it("joins a line split across chunks mid-key and mid-value", () => {
    const p = createFfmpegProgress(4);
    expect(p.push("out_ti")).toBeNull();
    expect(p.push("me_us=1000")).toBeNull();
    expect(p.push("000\n")).toBeCloseTo(0.25);
  });
  it("accepts CRLF line endings", () => {
    const p = createFfmpegProgress(10);
    expect(p.push("out_time_us=5000000\r\nprogress=continue\r\n")).toBeCloseTo(0.5);
    expect(p.push("progress=end\r\n")).toBe(1);
    expect(p.ended).toBe(true);
  });
  it("treats out_time_us=N/A as no progress", () => {
    const p = createFfmpegProgress(10);
    expect(p.push("out_time_us=N/A\n")).toBeNull();
    expect(p.ended).toBe(false);
  });
  it("reads out_time_ms as microseconds, not milliseconds", () => {
    expect(createFfmpegProgress(2).push("out_time_ms=1000000\n")).toBeCloseTo(0.5);
  });
  it("reads a clock out_time with fractional seconds", () => {
    expect(createFfmpegProgress(100).push("out_time=00:01:02.500000\n")).toBeCloseTo(0.625);
  });
  it("returns null for duration 0, negative or NaN", () => {
    for (const d of [0, -5, Number.NaN]) {
      expect(createFfmpegProgress(d).push("out_time_us=5000000\n")).toBeNull();
    }
  });
  it("clamps values past the duration to 1", () => {
    expect(createFfmpegProgress(10).push("out_time_us=99000000000\n")).toBe(1);
  });
  it("sets ended and fraction 1 on progress=end", () => {
    const p = createFfmpegProgress(10);
    expect(p.push("progress=end\n")).toBe(1);
    expect(p.ended).toBe(true);
  });
  it("ignores a stale out_time after progress=end in the same chunk", () => {
    const p = createFfmpegProgress(10);
    expect(p.push("progress=end\nout_time_us=2000000\n")).toBe(1);
  });
  it("ignores garbage lines", () => {
    const p = createFfmpegProgress(10);
    expect(p.push("garbage\n\n=\nout_time=banana\nout_time_us=abc\n")).toBeNull();
    expect(p.ended).toBe(false);
  });
});
