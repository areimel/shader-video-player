/**
 * Prefers what Chromium plays natively (VP9+Opus in WebM, then H.264+AAC in MP4, both up to 1080p), so a
 * download never needs a live transcode. The trailing alternatives keep rare sites working.
 */
export const FORMAT_CHAIN =
  "bv*[vcodec^=vp9][height<=1080]+ba[acodec=opus]/bv*[vcodec^=avc1][height<=1080]+ba[ext=m4a]/b[ext=mp4]/b";

/** Marks our progress lines (`download:` is yt-dlp's template type, not part of the output). */
export const PROGRESS_TAG = "SVPDL";

const PROGRESS_TEMPLATE =
  `download:${PROGRESS_TAG} %(progress.downloaded_bytes)s %(progress.total_bytes,progress.total_bytes_estimate)s %(progress.eta)s`;

/**
 * yt-dlp arguments. `--ignore-config` keeps a user's yt-dlp.conf from changing output or running exec hooks.
 * No ffmpeg INPUT_PROTOCOLS: those are ffmpeg options and yt-dlp would reject them. `--` ends option parsing
 * so a URL can never be read as a flag.
 */
export function buildYtDlpArgs(url: string, outDir: string, ffmpegLocation?: string): string[] {
  const args = [
    "--ignore-config", "--no-playlist", "--newline", "--no-simulate", "--no-mtime", "--no-quiet", // --print implies --quiet, which hides stage lines
    "--print", "after_move:filepath",
    "--progress-template", PROGRESS_TEMPLATE,
    "-f", FORMAT_CHAIN,
    "-P", outDir,
    "-o", "%(title).150B [%(id)s].%(ext)s",
  ];
  if (ffmpegLocation) args.push("--ffmpeg-location", ffmpegLocation);
  args.push("--", url);
  return args;
}
