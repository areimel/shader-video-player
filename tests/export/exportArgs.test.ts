import { describe, expect, it } from "vitest";
import { decodeArgs, defaultSize, encodeArgs, fpsOf, frameCount, parseSize } from "../../electron/export/exportArgs";
import { INPUT_PROTOCOLS } from "../../electron/media/ffmpegArgs";
import type { MediaInfo } from "../../shared/types";

const info = (over: Partial<MediaInfo> = {}): MediaInfo => ({
  path: "/v/in.mp4", name: "in.mp4", container: "mp4", sizeBytes: 1, durationSec: 10, startTime: 0, bitrate: 0,
  videoCodec: "h264", profile: "", pixFmt: "yuv420p", width: 1280, height: 720, fps: 25,
  audioTracks: [{ ordinal: 0, codec: "aac", language: "", title: "", channels: 2 }], subtitleTracks: [], ...over,
});

describe("parseSize", () => {
  it("accepts even sizes in range", () => expect(parseSize("1920x1080")).toEqual({ width: 1920, height: 1080 }));
  it("rejects odd, tiny, huge and malformed", () => {
    for (const s of ["1921x1080", "8x8", "7682x1080", "abc", "1920", "1920x", "-4x40"]) expect(parseSize(s)).toBeNull();
  });
});

describe("defaultSize", () => {
  it("scales 720p up to 1080", () => expect(defaultSize({ width: 1280, height: 720 })).toEqual({ width: 1920, height: 1080 }));
  it("keeps 4K", () => expect(defaultSize({ width: 3840, height: 2160 })).toEqual({ width: 3840, height: 2160 }));
  it("keeps the aspect with even dims", () => {
    expect(defaultSize({ width: 640, height: 480 })).toEqual({ width: 1440, height: 1080 });
    const t = defaultSize({ width: 853, height: 481 });
    expect((t.width % 2) + (t.height % 2)).toBe(0);
    expect(t.height).toBeGreaterThanOrEqual(1080);
  });
});

describe("fpsOf / frameCount", () => {
  it("uses the probed rate, falls back to 30, caps at 60", () => {
    expect(fpsOf({ fps: 24 })).toBe(24);
    expect(fpsOf({ fps: 0 })).toBe(30);
    expect(fpsOf({ fps: NaN })).toBe(30);
    expect(fpsOf({ fps: 120 })).toBe(60);
  });
  it("counts frames", () => expect(frameCount(10, 25)).toBe(250));
});

describe("decodeArgs", () => {
  it("emits rgba rawvideo at a constant rate, whitelist before the input", () => {
    const a = decodeArgs("/v/in.mp4", 25);
    expect(a.indexOf("-protocol_whitelist")).toBeLessThan(a.indexOf("-i"));
    expect(a.join(" ")).toContain("-vf fps=25");
    expect(a.join(" ")).toContain("-f rawvideo -pix_fmt rgba -");
  });
});

describe("encodeArgs", () => {
  const a = encodeArgs(info(), 0, { width: 1920, height: 1080 }, 25, "/o/out.mp4.part");
  const s = a.join(" ");
  it("reads rgba from stdin at the output size and rate", () => expect(s).toContain("-f rawvideo -pix_fmt rgba -s 1920x1080 -r 25 -i -"));
  it("flips the bottom-up rows", () => expect(a[a.indexOf("-vf") + 1]).toBe("vflip"));
  it("whitelists the file input only and maps optional audio from input 1", () => {
    expect(a.filter((x) => x === INPUT_PROTOCOLS[0])).toHaveLength(1);
    expect(a.indexOf("-protocol_whitelist")).toBeGreaterThan(a.indexOf("-i"));
    expect(s).toContain("-map 1:a:0?");
    expect(s).toContain("-map 0:v");
  });
  it("re-encodes even when the source is h264", () => {
    expect(s).toContain("libx264");
    expect(s).not.toContain("-c:v copy");
  });
  it("ends with shortest, faststart and the output", () => {
    expect(s).toContain("-shortest -movflags +faststart -f mp4 /o/out.mp4.part");
  });
  it("drops audio when the source has none", () => {
    expect(encodeArgs(info({ audioTracks: [] }), 0, { width: 16, height: 16 }, 30, "o")).toContain("-an");
  });
});
