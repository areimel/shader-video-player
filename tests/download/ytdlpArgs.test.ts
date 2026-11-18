import { describe, expect, it } from "vitest";
import { buildYtDlpArgs, FORMAT_CHAIN } from "../../electron/download/ytdlpArgs";

describe("buildYtDlpArgs", () => {
  const url = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
  const args = buildYtDlpArgs(url, "/videos");

  it("puts -- immediately before the url, last", () => {
    expect(args.at(-1)).toBe(url);
    expect(args.at(-2)).toBe("--");
  });
  it("ignores user config and playlists", () => {
    expect(args).toContain("--ignore-config");
    expect(args).toContain("--no-playlist");
    expect(args).toContain("--no-quiet");
  });
  it("never passes ffmpeg input protocol options", () => {
    expect(args.join(" ")).not.toContain("protocol_whitelist");
  });
  it("downloads into the output dir with the native-first format chain", () => {
    expect(args[args.indexOf("-P") + 1]).toBe("/videos");
    expect(args[args.indexOf("-f") + 1]).toBe(FORMAT_CHAIN);
    expect(FORMAT_CHAIN.indexOf("vp9")).toBeLessThan(FORMAT_CHAIN.indexOf("avc1"));
  });
  it("prints the final path", () => {
    expect(args[args.indexOf("--print") + 1]).toBe("after_move:filepath");
  });
  it("adds --ffmpeg-location only when given", () => {
    expect(args).not.toContain("--ffmpeg-location");
    const withLoc = buildYtDlpArgs(url, "/videos", "/opt/ffmpeg");
    expect(withLoc[withLoc.indexOf("--ffmpeg-location") + 1]).toBe("/opt/ffmpeg");
    expect(withLoc.at(-2)).toBe("--");
  });
});
