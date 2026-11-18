import { basename, dirname } from "node:path";
import { isInside } from "./ids";

/** Display name of a registered folder: its last path segment, or the path itself for a filesystem root. */
export function folderName(path: string): string {
  return basename(path) || path;
}

/**
 * Why `real` (a candidate folder's realpath) cannot be registered next to the existing folders, or null.
 * Nested folders are rejected rather than merged: otherwise the same file would be indexed twice under
 * two folder ids, and removing the outer folder would have to resurrect the inner one's items.
 */
export function folderConflict(existing: ReadonlyArray<{ real: string; name: string }>, real: string): string | null {
  if (dirname(real) === real) return "The filesystem root cannot be a library folder";
  for (const f of existing) {
    if (f.real === real) return `"${f.name}" is already in the library`;
    if (isInside(f.real, real)) return `That folder is already inside "${f.name}"`;
    if (isInside(real, f.real)) return `That folder contains "${f.name}", which is already in the library`;
  }
  return null;
}

/**
 * How a candidate folder relates to the registered ones (by realpath): "covered" when it equals or lies
 * inside one (its files are already indexed), "contains" when a registered folder lies inside it, else "free".
 */
export function folderCoverage(existingRealPaths: readonly string[], real: string): "covered" | "contains" | "free" {
  let contains = false;
  for (const e of existingRealPaths) {
    if (isInside(e, real)) return "covered";
    if (isInside(real, e)) contains = true;
  }
  return contains ? "contains" : "free";
}
