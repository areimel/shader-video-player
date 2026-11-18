import { describe, expect, it } from "vitest";
import { looksLikeUrl } from "../renderer/utils/urlInput";

describe("looksLikeUrl", () => {
  it("accepts http and https, trimmed", () => {
    expect(looksLikeUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(looksLikeUrl("  http://example.com/a  ")).toBe(true);
  });
  it("rejects everything else", () => {
    for (const s of ["", "  ", "example.com", "ftp://x.com/a", "file:///etc/passwd", "javascript:alert(1)", "https://", "https://a b.com", "not a url"]) {
      expect(looksLikeUrl(s)).toBe(false);
    }
  });
});
