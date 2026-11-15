import { describe, expect, it } from "vitest";
import { parseCueText } from "../renderer/utils/cueText";
import { isSubtitlePath, matchSiblingSubtitles } from "../shared/subtitleFiles";
import { buildExternalSubtitleArgs } from "../electron/media/ffmpegArgs";

describe("parseCueText", () => {
  it("returns plain text", () => {
    expect(parseCueText("Hello")).toEqual([[{ text: "Hello", italic: false, bold: false }]]);
  });
  it("applies italics and bold, ignores other tags", () => {
    const [line] = parseCueText("<v Bob><c.yellow>Hi</c> <i>there <b>you</b></i>");
    expect(line.map((s) => [s.text, s.italic, s.bold])).toEqual([
      ["Hi", false, false], [" ", false, false], ["there ", true, false], ["you", true, true],
    ]);
  });
  it("drops timestamps and keeps line breaks", () => {
    const lines = parseCueText("a<00:01.000>b\nc");
    expect(lines).toHaveLength(2);
    expect(lines[0].map((s) => s.text).join("")).toBe("ab");
  });
  it("decodes entities and never yields markup", () => {
    expect(parseCueText("&lt;script&gt; &amp; x")[0][0].text).toBe("<script> & x");
    expect(parseCueText("a < b")[0].map((s) => s.text).join("")).toBe("a < b");
  });
  it("keeps italics across lines and tolerates unbalanced closes", () => {
    const lines = parseCueText("</i><i>a\nb</i>");
    expect(lines.map((l) => l[0].italic)).toEqual([true, true]);
  });
});

describe("matchSiblingSubtitles", () => {
  const entries = ["movie.mkv", "movie.srt", "movie.en.srt", "Movie.ENG.forced.ASS", "movie2.srt", "movie.txt", "other.srt", "movie.vtt"];
  it("matches same base name with optional tags, exact first", () => {
    expect(matchSiblingSubtitles("/v/movie.mkv", entries)).toEqual([
      "movie.srt", "movie.vtt", "movie.en.srt", "Movie.ENG.forced.ASS",
    ]);
  });
  it("handles names without an extension and no matches", () => {
    expect(matchSiblingSubtitles("/v/none.mp4", entries)).toEqual([]);
  });
});

describe("isSubtitlePath", () => {
  it("allows only subtitle extensions", () => {
    expect(isSubtitlePath("/a/b.SRT")).toBe(true);
    expect(isSubtitlePath("x.ssa")).toBe(true);
    expect(isSubtitlePath("x.mkv")).toBe(false);
    expect(isSubtitlePath("srt")).toBe(false);
  });
});

describe("buildExternalSubtitleArgs", () => {
  it("forces the demuxer, restricts protocols and seeks before input", () => {
    const a = buildExternalSubtitleArgs("/s/a.srt", "srt", 12.5, "/t/o.vtt");
    expect(a.slice(a.indexOf("-ss"), a.indexOf("-ss") + 2)).toEqual(["-ss", "12.500"]);
    expect(a.indexOf("-f")).toBeLessThan(a.indexOf("-i"));
    expect(a).toContain("-protocol_whitelist");
    expect(a.slice(-3)).toEqual(["-f", "webvtt", "/t/o.vtt"]);
  });
  it("omits -ss at zero offset", () => {
    expect(buildExternalSubtitleArgs("/s/a.ass", "ass", 0, "/t/o.vtt")).not.toContain("-ss");
  });
});
