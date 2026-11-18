import { RELEASES_API, pickRelease, type Release } from "./releases";
import { compareVersions } from "./semver";

export const USER_AGENT = "shader-video-player";

export interface UpdateCheck {
  current: string;
  latest: string;
  newer: boolean;
  release: Release;
}

/** Node-only (no electron): the CLI can call this before the app is ready. */
export async function checkForUpdate(currentVersion: string): Promise<UpdateCheck> {
  let res: Response;
  try {
    res = await fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new Error(timeout ? "Could not reach GitHub: the request timed out." : "Could not reach GitHub. Check your internet connection.");
  }
  if (!res.ok) throw new Error(`GitHub returned HTTP ${res.status} when looking up the latest release.`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("GitHub sent a response that could not be read.");
  }
  const release = pickRelease(json);
  if (!release) throw new Error("The newest release has no installable .deb with a SHA256SUMS file.");
  return { current: currentVersion, latest: release.version, newer: compareVersions(release.version, currentVersion) > 0, release };
}
