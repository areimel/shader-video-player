import { describe, expect, it } from "vitest";
import { canRemuxVideo, extensionOf, isRejectedFormat, isSupportedExtension, nativeMime } from "../electron/media/formats";
import { assertRealVideo, parseProbe } from "../electron/media/probe";
import { makeInfo } from "./fixtures";

describe("extensions", () => {
  it("detects supported extensions case-insensitively", () => {
    expect(extensionOf("/a/b/Movie.MKV")).toBe("mkv");
    expect(isSupportedExtension("x.avi")).toBe(true);
    expect(isSupportedExtension("x.txt")).toBe(false);
    expect(isSupportedExtension("noext")).toBe(false);
  });
});

describe("nativeMime", () => {
  it("accepts H.264/AAC mp4", () => {
    expect(nativeMime(makeInfo())).toBe('video/mp4; codecs="avc1.64001f, mp4a.40.2"');
  });
  it("rejects mkv, multi-audio and 10-bit", () => {
    expect(nativeMime(makeInfo({ path: "/v/a.mkv" }))).toBe("");
    const two = makeInfo().audioTracks[0];
    expect(nativeMime(makeInfo({ audioTracks: [two, { ...two, ordinal: 1 }] }))).toBe("");
    expect(nativeMime(makeInfo({ pixFmt: "yuv420p10le" }))).toBe("");
  });
  it("accepts webm vp9/opus", () => {
    const info = makeInfo({
      path: "/v/a.webm", videoCodec: "vp9",
      audioTracks: [{ ordinal: 0, codec: "opus", language: "und", title: "", channels: 2 }],
    });
    expect(nativeMime(info)).toContain("video/webm");
  });
});

describe("canRemuxVideo", () => {
  it("only for 8-bit h264", () => {
    expect(canRemuxVideo(makeInfo())).toBe(true);
    expect(canRemuxVideo(makeInfo({ videoCodec: "hevc" }))).toBe(false);
    expect(canRemuxVideo(makeInfo({ pixFmt: "yuv420p10le" }))).toBe(false);
  });
});

describe("parseProbe", () => {
  it("parses streams and filters image subtitles", () => {
    const info = parseProbe({
      format: { format_name: "matroska,webm", duration: "12.5", bit_rate: "1000" },
      streams: [
        { codec_type: "video", codec_name: "hevc", width: 1280, height: 720, avg_frame_rate: "24000/1001", pix_fmt: "yuv420p" },
        { codec_type: "audio", codec_name: "ac3", channels: 6, tags: { language: "eng" } },
        { codec_type: "subtitle", codec_name: "subrip", tags: { language: "fre" } },
        { codec_type: "subtitle", codec_name: "hdmv_pgs_subtitle" },
      ],
    }, "/v/a.mkv");
    expect(info.fps).toBeCloseTo(23.976, 2);
    expect(info.audioTracks[0].channels).toBe(6);
    expect(info.subtitleTracks).toHaveLength(1);
    expect(info.durationSec).toBe(12.5);
  });
  it("throws without a video stream", () => {
    expect(() => parseProbe({ streams: [] }, "/v/a.mp4")).toThrow();
  });
});

describe("isRejectedFormat", () => {
  it("rejects images, text, generated sources and playlists", () => {
    for (const n of ["image2", "png_pipe", "jpeg_pipe", "tty", "lavfi", "concat", "hls,applehttp", "image2pipe"]) {
      expect(isRejectedFormat(n)).toBe(true);
    }
  });
  it("accepts real containers", () => {
    for (const n of ["mov,mp4,m4a,3gp,3g2,mj2", "matroska,webm", "avi", "mpegts", "flv"]) {
      expect(isRejectedFormat(n)).toBe(false);
    }
  });
});

describe("assertRealVideo", () => {
  const video = { codec_type: "video", codec_name: "h264" };
  it("passes a normal video, with or without a known duration", () => {
    expect(() => assertRealVideo({ format: { format_name: "matroska,webm", duration: "10" }, streams: [video] })).not.toThrow();
    expect(() => assertRealVideo({ format: { format_name: "mpegts" }, streams: [video] })).not.toThrow();
  });
  it("rejects an image read by the image2 demuxer", () => {
    expect(() => assertRealVideo({ format: { format_name: "image2", duration: "0.04" }, streams: [{ codec_type: "video", codec_name: "mjpeg" }] })).toThrow();
    expect(() => assertRealVideo({ format: { format_name: "png_pipe" }, streams: [video] })).toThrow();
  });
  it("rejects no video stream, only cover art, or zero duration", () => {
    expect(() => assertRealVideo({ format: { format_name: "mp3", duration: "9" }, streams: [{ codec_type: "audio" }] })).toThrow();
    expect(() => assertRealVideo({ format: { format_name: "mp3", duration: "9" }, streams: [{ ...video, disposition: { attached_pic: 1 } }] })).toThrow();
    expect(() => assertRealVideo({ format: { format_name: "mov,mp4", duration: "0.000000" }, streams: [video] })).toThrow();
  });
  it("parseProbe applies the gate", () => {
    expect(() => parseProbe({ format: { format_name: "tty" }, streams: [video] }, "/v/a.txt")).toThrow();
  });
});
