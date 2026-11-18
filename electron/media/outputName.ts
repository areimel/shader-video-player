import { join } from "node:path";

/**
 * `<dir>/<base>.<ext>`, or `<base> (2).<ext>`, `(3)`… when taken. The caller passes `base` with any
 * suffix already in it (e.g. "clip.svp"); `exists` is injected so this stays pure.
 */
export function uniqueName(dir: string, base: string, ext: string, exists: (path: string) => boolean): string {
  let candidate = join(dir, `${base}.${ext}`);
  for (let n = 2; exists(candidate); n++) candidate = join(dir, `${base} (${n}).${ext}`);
  return candidate;
}

/** In-progress output. ".part" is not a supported video extension, so the library walker ignores it. */
export function partPath(path: string): string {
  return `${path}.part`;
}
