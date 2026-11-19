import { describe, expect, it } from "vitest";
import { parseSums, pickRelease } from "../../electron/update/releases";

const BASE = "https://github.com/areimel/shader-video-player/releases/download/v0.4.0-beta.1/";
const asset = (name: string, url = BASE + name) => ({ name, browser_download_url: url });
const good = (assets: unknown[] = [asset("shader-video-player_0.4.0-beta.1_amd64.deb"), asset("SHA256SUMS")]) =>
  [{ tag_name: "v0.4.0-beta.1", prerelease: true, assets }];

describe("pickRelease", () => {
  it("accepts a pre-release with deb and sums", () => {
    expect(pickRelease(good())).toEqual({
      tag: "v0.4.0-beta.1",
      version: "0.4.0-beta.1",
      debName: "shader-video-player_0.4.0-beta.1_amd64.deb",
      debUrl: BASE + "shader-video-player_0.4.0-beta.1_amd64.deb",
      sumsUrl: BASE + "SHA256SUMS",
    });
  });
  it("accepts a plain release", () => {
    const b = BASE.replace("v0.4.0-beta.1", "v0.5.0");
    const r = pickRelease([
      {
        tag_name: "v0.5.0",
        assets: [asset("shader-video-player_0.5.0_amd64.deb", b + "shader-video-player_0.5.0_amd64.deb"), asset("SHA256SUMS", b + "SHA256SUMS")],
      },
    ]);
    expect(r?.version).toBe("0.5.0");
  });
  it("rejects a missing SHA256SUMS", () => {
    expect(pickRelease(good([asset("shader-video-player_0.4.0-beta.1_amd64.deb")]))).toBeNull();
  });
  it("rejects a missing deb", () => {
    expect(pickRelease(good([asset("SHA256SUMS")]))).toBeNull();
  });
  it("rejects a deb whose version differs from the tag", () => {
    expect(pickRelease(good([asset("shader-video-player_0.9.0_amd64.deb"), asset("SHA256SUMS")]))).toBeNull();
  });
  it("rejects foreign hosts", () => {
    const evil = "https://evil.example.com/areimel/shader-video-player/releases/download/x/";
    expect(pickRelease(good([asset("shader-video-player_0.4.0-beta.1_amd64.deb", evil + "a.deb"), asset("SHA256SUMS")]))).toBeNull();
    expect(pickRelease(good([asset("shader-video-player_0.4.0-beta.1_amd64.deb"), asset("SHA256SUMS", evil + "SHA256SUMS")]))).toBeNull();
  });
  it("rejects malformed json", () => {
    const bad: unknown[] = [null, "x", {}, [], [null], [{}], [{ tag_name: 3, assets: [] }], [{ tag_name: "v1.0.0", assets: "no" }], [{ tag_name: "nope", assets: [] }]];
    for (const j of bad) expect(pickRelease(j)).toBeNull();
  });
});

describe("parseSums", () => {
  const h = "a".repeat(64);
  const g = "B".repeat(64);
  it("finds the named file among others", () => {
    const t = `${g}  other_1.0_amd64.deb\n${h}  shader-video-player_1.0.0_amd64.deb\n${g} *x.txt\n`;
    expect(parseSums(t, "shader-video-player_1.0.0_amd64.deb")).toBe(h);
    expect(parseSums(t, "x.txt")).toBe(g.toLowerCase());
  });
  it("returns null when absent or malformed", () => {
    expect(parseSums(`${h}  a.deb\n`, "b.deb")).toBeNull();
    expect(parseSums(`abc  a.deb\n`, "a.deb")).toBeNull();
    expect(parseSums("", "a.deb")).toBeNull();
  });
});
