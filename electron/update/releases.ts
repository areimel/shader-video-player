import { parseVersion } from "./semver";

/** Newest release including pre-releases (same query as website/public/install.sh). */
export const RELEASES_API = "https://api.github.com/repos/areimel/shader-video-player/releases?per_page=1";
const DOWNLOAD_PREFIX = "https://github.com/areimel/shader-video-player/releases/download/";

export interface Release {
  tag: string;
  version: string;
  debUrl: string;
  debName: string;
  sumsUrl: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function pickRelease(json: unknown): Release | null {
  if (!Array.isArray(json) || !isObj(json[0])) return null;
  const rel = json[0];
  const tag = rel.tag_name;
  if (typeof tag !== "string" || !parseVersion(tag) || !Array.isArray(rel.assets)) return null;
  const version = tag.replace(/^v/, "");
  const debName = `shader-video-player_${version}_amd64.deb`;
  const find = (name: string): string | null => {
    for (const a of rel.assets as unknown[]) {
      if (isObj(a) && a.name === name && typeof a.browser_download_url === "string" && a.browser_download_url.startsWith(DOWNLOAD_PREFIX)) {
        return a.browser_download_url;
      }
    }
    return null;
  };
  const debUrl = find(debName);
  const sumsUrl = find("SHA256SUMS");
  return debUrl && sumsUrl ? { tag, version, debUrl, debName, sumsUrl } : null;
}

/** sha256sum format: `<64 hex> [ *]<name>` per line. */
export function parseSums(text: string, fileName: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64}) [ *](.+)$/.exec(line);
    if (m && m[2] === fileName) return m[1].toLowerCase();
  }
  return null;
}
