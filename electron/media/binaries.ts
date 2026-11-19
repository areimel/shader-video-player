/**
 * ffmpeg/ffprobe come from the system. Override with SVP_FFMPEG_PATH / SVP_FFPROBE_PATH;
 * otherwise plain command names are resolved through PATH by spawn.
 */
export function ffmpegPath(): string {
  return process.env.SVP_FFMPEG_PATH || "ffmpeg";
}

export function ffprobePath(): string {
  return process.env.SVP_FFPROBE_PATH || "ffprobe";
}

export function ytDlpPath(): string {
  return process.env.SVP_YTDLP_PATH || "yt-dlp";
}
