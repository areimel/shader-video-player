import { describe, expect, it } from "vitest";
import { parseCli } from "../../electron/cli/args";

const pk = (...a: string[]) => parseCli(["/usr/bin/svp", ...a], true);
const dev = (...a: string[]) => parseCli(["electron", ...a], false);

describe("parseCli", () => {
  it("returns files for the GUI", () => {
    expect(pk("a.mp4", "b.mkv")).toEqual({ kind: "gui", files: ["a.mp4", "b.mkv"] });
    expect(pk()).toEqual({ kind: "gui", files: [] });
  });

  it("skips the app path in dev, with or without switches before it", () => {
    expect(dev(".", "a.mp4")).toEqual({ kind: "gui", files: ["a.mp4"] });
    expect(dev("--no-sandbox", ".", "update", "--check")).toMatchObject({ kind: "command", name: "update" });
  });

  it("ignores Chromium switches in GUI mode", () => {
    expect(pk("--no-sandbox", "--ozone-platform=x11", "--user-data-dir=/x", "--enable-features=A", "a.mp4"))
      .toEqual({ kind: "gui", files: ["a.mp4"] });
  });

  it("parses a command with flags in each form", () => {
    expect(pk("download", "https://x/y", "--no-play")).toEqual({
      kind: "command", name: "download", positionals: ["https://x/y"], flags: { "no-play": true },
    });
    expect(pk("convert", "a.mkv", "-o", "out.mp4", "--force")).toMatchObject({
      flags: { output: "out.mp4", force: true },
    });
    expect(pk("export", "a.mp4", "--size", "1920x1080", "--effect=vhs")).toMatchObject({
      flags: { size: "1920x1080", effect: "vhs" },
    });
  });

  it("ignores pass-through switches after the command and before it", () => {
    expect(pk("--no-sandbox", "update", "--disable-gpu-compositing", "--check")).toMatchObject({
      kind: "command", flags: { check: true },
    });
  });

  it("only dispatches on an exact first word", () => {
    expect(pk("./update")).toEqual({ kind: "gui", files: ["./update"] });
    expect(pk("frobnicate")).toEqual({ kind: "gui", files: ["frobnicate"] });
    expect(pk("a.mp4", "update")).toEqual({ kind: "gui", files: ["a.mp4", "update"] });
  });

  it("maps --help, -h and --version", () => {
    expect(pk("--help")).toMatchObject({ kind: "command", name: "help" });
    expect(pk("-h")).toMatchObject({ kind: "command", name: "help" });
    expect(pk("--version")).toMatchObject({ kind: "command", name: "version" });
  });

  it("reports usage errors", () => {
    expect(pk("export", "a.mp4", "--size")).toMatchObject({ kind: "error" });
    expect(pk("update", "--bogus")).toMatchObject({ kind: "error" });
    expect(pk("download")).toMatchObject({ kind: "error" });
    expect(pk("update", "x")).toMatchObject({ kind: "error" });
    expect(pk("download", "u", "--no-play=1")).toMatchObject({ kind: "error" });
    expect(pk("convert", "a", "-x")).toMatchObject({ kind: "error" });
  });

  it("treats everything after -- as positional", () => {
    expect(pk("convert", "--", "-weird.mkv")).toMatchObject({ positionals: ["-weird.mkv"] });
  });
});
