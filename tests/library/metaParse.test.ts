import { describe, expect, it } from "vitest";
import { parseLightProbe } from "../../electron/library/metaParse";

const probe = (o: unknown) => JSON.stringify(o);

describe("parseLightProbe", () => {
  it("reads duration and the video stream size", () => {
    const out = probe({
      programs: [],
      streams: [{ codec_type: "audio" }, { codec_type: "video", width: 1280, height: 720 }],
      format: { duration: "61.500000" },
    });
    expect(parseLightProbe(out)).toEqual({ ok: true, durationSec: 61.5, width: 1280, height: 720 });
  });
  it("allows a missing duration", () => {
    expect(parseLightProbe(probe({ streams: [{ codec_type: "video", width: 640, height: 480 }], format: {} })))
      .toEqual({ ok: true, durationSec: null, width: 640, height: 480 });
    expect(parseLightProbe(probe({ streams: [{ codec_type: "video" }], format: { duration: "N/A" } })))
      .toEqual({ ok: true, durationSec: null, width: null, height: null });
  });
  it("fails without a video stream, on zero duration, and on bad JSON", () => {
    expect(parseLightProbe(probe({ streams: [{ codec_type: "audio" }], format: { duration: "3" } }))).toEqual({ ok: false });
    expect(parseLightProbe(probe({ streams: [{ codec_type: "video", width: 1, height: 1 }], format: { duration: "0" } }))).toEqual({ ok: false });
    expect(parseLightProbe("")).toEqual({ ok: false });
    expect(parseLightProbe("null")).toEqual({ ok: false });
    expect(parseLightProbe(probe({ streams: "x" }))).toEqual({ ok: false });
  });
});
