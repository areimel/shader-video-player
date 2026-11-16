import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHANGELOG, parseChangelog } from "../renderer/utils/changelog";
import { noticeTitles } from "../renderer/utils/credits";

describe("parseChangelog", () => {
  it("reads versions, dates and bullet items, newest first as written", () => {
    const md = "# Changelog\n\n## 0.2.0 - 2026-11-16\n- One\n- Two\n\n## 0.1.0 - 2026-11-15\n* Three\n";
    expect(parseChangelog(md)).toEqual([
      { version: "0.2.0", date: "2026-11-16", items: ["One", "Two"] },
      { version: "0.1.0", date: "2026-11-15", items: ["Three"] },
    ]);
  });

  it("is tolerant: no entries, junk, empty bullets and missing dates", () => {
    expect(parseChangelog("")).toEqual([]);
    expect(parseChangelog("just some text\n- stray bullet\n")).toEqual([]);
    expect(parseChangelog(null as unknown as string)).toEqual([]);
    expect(parseChangelog("## - 2026-01-01\n- no version\n## 1.0.0\n- a\n-  \n- b  \r\n")).toEqual([
      { version: "1.0.0", date: "", items: ["a", "b"] },
    ]);
  });

  it("a headless `## ` line closes the previous entry", () => {
    expect(parseChangelog("## 1.0.0 - 2026-01-02\n- kept\n## - 2026-01-03\n- orphan\n")).toEqual([
      { version: "1.0.0", date: "2026-01-02", items: ["kept"] },
    ]);
  });

  it("ignores text before the first heading", () => {
    expect(parseChangelog("- orphan\n## 1.0.0 - 2026-01-02\n- kept\n")).toEqual([
      { version: "1.0.0", date: "2026-01-02", items: ["kept"] },
    ]);
  });

  it("parses the real CHANGELOG.md", () => {
    const md = readFileSync(fileURLToPath(new URL("../CHANGELOG.md", import.meta.url)), "utf8");
    const entries = parseChangelog(md);
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) expect(entry.items.length).toBeGreaterThan(0);
    expect(CHANGELOG).toEqual(entries);
  });
});

describe("noticeTitles", () => {
  it("returns the ## heading texts only", () => {
    expect(noticeTitles("# Notices\n\n## FFmpeg\ntext\n### Sub\n## babu-video-player\n## Electron, Chromium, React\n")).toEqual([
      "FFmpeg",
      "babu-video-player",
      "Electron, Chromium, React",
    ]);
  });
});
