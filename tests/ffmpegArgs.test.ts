import { describe, expect, it } from "vitest";
import { ENCODER_FALLBACKS, buildStreamArgs, buildSubtitleArgs, targetBitrate } from "../electron/media/ffmpegArgs";
import { makeInfo } from "./fixtures";

const base = { input: "/v/a.mkv", output: "/tmp/o.mp4", startSec: 0, audioOrdinal: 0 };

describe("ENCODER_FALLBACKS", () => {
  it("ends with the software encoder", () => {
    expect(ENCODER_FALLBACKS[ENCODER_FALLBACKS.length - 1]).toBe("libx264");
  });
});

describe("buildStreamArgs", () => {
  it("remuxes h264 + aac with copy only", () => {
    const a = buildStreamArgs(makeInfo(), { ...base, encoder: "libx264" });
    expect(a).toContain("copy");
    expect(a).not.toContain("libx264");
    expect(a.join(" ")).toContain("-c:a copy");
    expect(a.join(" ")).toContain("frag_keyframe+empty_moov");
  });
  it("transcodes non-h264 with libx264", () => {
    const info = makeInfo({ videoCodec: "hevc" });
    const sw = buildStreamArgs(info, { ...base, encoder: "libx264" });
    expect(sw).toContain("libx264");
    expect(sw).toContain("yuv420p");
    expect(sw.join(" ")).toContain("-force_key_frames expr:gte(t,n_forced*2)");
  });
  it("bounds fragments by duration in both modes, and copy never forces keyframes", () => {
    const remux = buildStreamArgs(makeInfo(), { ...base, encoder: "libx264" }).join(" ");
    const enc = buildStreamArgs(makeInfo({ videoCodec: "hevc" }), { ...base, encoder: "libx264" }).join(" ");
    expect(remux).toContain("-frag_duration 1000000");
    expect(enc).toContain("-frag_duration 1000000");
    expect(remux).not.toContain("-force_key_frames");
  });
  it("re-encodes non-aac audio to stereo aac", () => {
    const info = makeInfo({ audioTracks: [{ ordinal: 0, codec: "ac3", language: "und", title: "", channels: 6 }] });
    const s = buildStreamArgs(info, { ...base, encoder: "libx264" }).join(" ");
    expect(s).toContain("-c:a aac");
    expect(s).toContain("-ac 2");
  });
  it("maps the selected audio track and seeks before input", () => {
    const info = makeInfo({
      audioTracks: [0, 1].map((ordinal) => ({ ordinal, codec: "aac", language: "und", title: "", channels: 2 })),
    });
    const a = buildStreamArgs(info, { ...base, startSec: 12.5, audioOrdinal: 1, encoder: "libx264" });
    expect(a.join(" ")).toContain("-map 0:a:1");
    expect(a.indexOf("-ss")).toBeLessThan(a.indexOf("-i"));
    expect(a[a.indexOf("-ss") + 1]).toBe("12.500");
  });
  it("omits -ss at zero and drops audio when absent", () => {
    const a = buildStreamArgs(makeInfo({ audioTracks: [] }), { ...base, encoder: "libx264" });
    expect(a).not.toContain("-ss");
    expect(a).toContain("-an");
  });
});

describe("misc args", () => {
  it("builds subtitle extraction", () => {
    const a = buildSubtitleArgs("/v/a.mkv", 2, 5, "/tmp/s.vtt");
    expect(a.join(" ")).toContain("-map 0:s:2");
    expect(a).toContain("webvtt");
  });
  it("clamps bitrate", () => {
    expect(targetBitrate(makeInfo({ bitrate: 100 }))).toBe(2_000_000);
    expect(targetBitrate(makeInfo({ bitrate: 90_000_000 }))).toBe(12_000_000);
  });
});

describe("protocol whitelist", () => {
  it("restricts stream and subtitle inputs to local protocols, before -i", () => {
    const stream = buildStreamArgs(makeInfo(), { ...base, encoder: "libx264" });
    const sub = buildSubtitleArgs("/v/a.mkv", 0, 0, "/tmp/o.vtt");
    for (const a of [stream, sub]) {
      expect(a[a.indexOf("-protocol_whitelist") + 1]).toBe("file,crypto,data");
      expect(a.indexOf("-protocol_whitelist")).toBeLessThan(a.indexOf("-i"));
    }
  });
});
