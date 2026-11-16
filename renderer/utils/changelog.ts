import type { ChangelogEntry } from "./home/types";
import raw from "../../CHANGELOG.md?raw";

const HEADING_PREFIX = /^##\s/;
const HEADING = /^##\s+(\S+)\s*(?:-\s*)?(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;

/**
 * Parses CHANGELOG.md: each `## <version> - <date>` heading starts an entry, and its `-` or `*`
 * bullets are the items. Text before the first heading is ignored, a heading without a version
 * is skipped (and closes the previous entry), and nothing here throws on malformed input.
 */
export function parseChangelog(md: string): ChangelogEntry[] {
  if (typeof md !== "string") return [];
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;
  for (const line of md.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (HEADING_PREFIX.test(trimmed)) {
      const heading = HEADING.exec(trimmed);
      const version = heading?.[1] ?? "";
      current = heading && /\d/.test(version) ? { version, date: heading[2].trim(), items: [] } : null;
      if (current) entries.push(current);
      continue;
    }
    const bullet = BULLET.exec(line);
    if (current && bullet && bullet[1].trim()) current.items.push(bullet[1].trim());
  }
  return entries;
}

export const CHANGELOG: ChangelogEntry[] = parseChangelog(raw);
