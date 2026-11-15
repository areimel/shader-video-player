import { realpathSync } from "node:fs";

/**
 * Only the native-playback file currently on screen may be served over svp-media://file/.
 * Transcoded files are served through their stream session id and never enter this list.
 */
let served: string | null = null;

/** Makes `path` the only servable file; returns its real path. */
export function allowOnly(path: string): string {
  served = realpathSync(path);
  return served;
}

export function clearAllowed(): void {
  served = null;
}

/** The real path of `path` if it is the allowed file, else null (callers should use the returned path). */
export function allowedRealPath(path: string): string | null {
  try {
    const real = realpathSync(path);
    return real === served ? real : null;
  } catch {
    return null;
  }
}
