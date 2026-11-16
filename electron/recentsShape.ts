import { isAbsolute } from "node:path";
import type { RecentFile } from "../shared/types";

export const MAX_RECENTS = 12;

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/**
 * Validates the persisted recents list: drops malformed entries and duplicate paths (first wins, the
 * list is newest first) and caps the length. Anything that is not an array heals to [].
 */
export function healRecents(raw: unknown): RecentFile[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentFile[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (out.length >= MAX_RECENTS) break;
    if (!isRecord(r)) continue;
    const { path, name, openedAt } = r;
    if (typeof path !== "string" || !isAbsolute(path) || seen.has(path)) continue;
    if (typeof name !== "string" || typeof openedAt !== "number" || !Number.isFinite(openedAt)) continue;
    seen.add(path);
    out.push({ path, name, openedAt });
  }
  return out;
}
