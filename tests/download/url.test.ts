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
  it.each([
    "http://localhost/", "http://LOCALHOST:8080/x", "http://a.localhost/", "http://printer.local/", "http://localhost./",
    "http://127.0.0.1/", "http://127.1.2.3/", "http://10.0.0.5/", "http://172.16.0.1/", "http://172.31.255.255/",
    "http://192.168.1.1/", "http://169.254.169.254/latest", "http://100.64.0.1/", "http://0.0.0.0/",
    "http://2130706433/", "http://0x7f000001/", "http://127.1/", "http://0177.0.0.1/", "http://017700000001/",
    "http://[::1]/", "http://[::]/", "http://[fc00::1]/", "http://[fd12:3456::1]/", "http://[fe80::1]/", "http://[febf::1]/",
    "http://[::ffff:127.0.0.1]/", "http://[::ffff:10.1.2.3]/", "http://[::ffff:c0a8:0101]/",
  ])("rejects local or private host %s", (u) => {
    expect(() => parseVideoUrl(u)).toThrow(/private network/);
  });
  it.each([
    "http://8.8.8.8/", "http://172.32.0.1/", "http://172.15.0.1/", "http://100.128.0.1/", "http://169.253.0.1/", "http://192.169.0.1/",
    "https://[2606:4700::1111]/", "http://[::ffff:8.8.8.8]/", "https://localhost.example.com/", "https://notlocal.com/", "http://fe.example/",
  ])("allows public host %s", (u) => {
    expect(() => parseVideoUrl(u)).not.toThrow();
  });
});
