import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "../../electron/download/url";

describe("parseVideoUrl", () => {
  it("accepts and trims http and https", () => {
    expect(parseVideoUrl("  https://www.youtube.com/watch?v=abc  ")).toBe("https://www.youtube.com/watch?v=abc");
    expect(parseVideoUrl("http://example.com/v.mp4")).toBe("http://example.com/v.mp4");
  });
  it.each([42, null, undefined, {}, "", "   "])("rejects non-text %#", (v) => {
    expect(() => parseVideoUrl(v)).toThrow(/video URL/);
  });
  it("rejects other protocols", () => {
    for (const u of ["ftp://x", "file:///etc/passwd", "javascript:alert(1)", "data:text/html,hi"]) {
      expect(() => parseVideoUrl(u)).toThrow();
    }
  });
  it("rejects malformed, credentialed and oversized URLs", () => {
    expect(() => parseVideoUrl("not a url")).toThrow(/valid URL/);
    expect(() => parseVideoUrl("https://user:pw@example.com/")).toThrow(/user name/);
    expect(() => parseVideoUrl("https://user@example.com/")).toThrow(/user name/);
    expect(() => parseVideoUrl("https://example.com/" + "a".repeat(2048))).toThrow(/too long/);
  });
});
