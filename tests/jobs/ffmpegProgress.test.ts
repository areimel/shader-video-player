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
});
