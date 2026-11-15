/** Pure helpers for external subtitle files; shared by main (validation) and renderer (drop routing). */

/** Extension -> ffmpeg demuxer name. Forcing the demuxer avoids content probing of user files. */
export const SUBTITLE_DEMUXERS: Record<string, string> = {
  srt: "srt", vtt: "webvtt", ass: "ass", ssa: "ass",
};

export const SUBTITLE_EXTENSIONS = Object.keys(SUBTITLE_DEMUXERS);

function extOf(name: string): string {
  const m = /\.([^./\\]+)$/.exec(name);
  return m ? m[1].toLowerCase() : "";
}

function baseName(path: string): string {
  return path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
}

export function isSubtitlePath(path: string): boolean {
  return extOf(path) in SUBTITLE_DEMUXERS;
}

/**
 * Picks the directory entries that are subtitles for `videoPath`: same base name,
 * optionally followed by tags (`movie.en.srt`, `movie.eng.forced.ass`). Exact-name matches come first.
 */
export function matchSiblingSubtitles(videoPath: string, entries: string[]): string[] {
  const video = baseName(videoPath);
  const dot = video.lastIndexOf(".");
  const base = (dot > 0 ? video.slice(0, dot) : video).toLowerCase();
  const hits = entries.filter((n) => {
    const lower = n.toLowerCase();
    return isSubtitlePath(n) && !/[/\\]/.test(n) && (lower.startsWith(`${base}.`));
  });
  const exact = (n: string) => n.toLowerCase().slice(0, n.lastIndexOf(".")) === base;
  return hits.sort((a, b) => Number(exact(b)) - Number(exact(a)) || a.localeCompare(b));
}
