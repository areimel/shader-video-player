import { describe, expect, it } from "vitest";
import { buildConvertArgs } from "../../electron/convert/convertArgs";
import { nativeMime } from "../../electron/media/formats";
import { makeInfo } from "../fixtures";

const hevc = makeInfo({ path: "/v/a.mkv", videoCodec: "hevc" });
const track = (ordinal: number, codec = "ac3") => ({ ordinal, codec, language: "und", title: "", channels: 6 });

describe("buildConvertArgs", () => {
  it("keeps exactly one audio track, faststart, part output", () => {
    const info = makeInfo({ ...hevc, audioTracks: [track(0), track(1)] });
    const args = buildConvertArgs(info, 1, "libx264", "/o/a.mp4.part");
    expect(args.filter((a) => a === "-map")).toHaveLength(2);
    expect(args).toContain("0:a:1");
    expect(args).not.toContain("0:a:0");
    expect(args).toContain("+faststart");
    expect(args.slice(-3)).toEqual(["-f", "mp4", "/o/a.mp4.part"]);
    expect(args).toContain("-sn");
    expect(args).not.toContain("zerolatency");
  });

  it("puts the protocol whitelist before the input", () => {
    const args = buildConvertArgs(hevc, 0, "libx264", "/o");
    expect(args.indexOf("-protocol_whitelist")).toBeGreaterThan(-1);
    expect(args.indexOf("-protocol_whitelist")).toBeLessThan(args.indexOf("-i"));
  });

  it("copies video for a remux-only source and encodes otherwise", () => {
    const remux = buildConvertArgs(makeInfo({ path: "/v/a.mkv", audioTracks: [track(0)] }), 0, "libx264", "/o");
    expect(remux).toContain("copy");
    expect(buildConvertArgs(hevc, 0, "libx264", "/o")).toContain("libx264");
  });

  it("maps no audio for a silent source", () => {
    const args = buildConvertArgs(makeInfo({ ...hevc, audioTracks: [] }), 0, "libx264", "/o");
    expect(args.filter((a) => a === "-map")).toHaveLength(1);
    expect(args).toContain("-an");
  });

  it("produces the shape nativeMime accepts", () => {
    const out = makeInfo({
      path: "/v/a.svp.mp4", videoCodec: "h264", pixFmt: "yuv420p",
      audioTracks: [{ ...track(0, "aac"), channels: 2 }],
    });
    expect(nativeMime(out)).not.toBe("");
  });
});
