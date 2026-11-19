import type { MediaInfo } from "../../shared/types";
import { canRemuxVideo } from "./formats";

/** Add hardware encoders (e.g. "h264_vaapi") here and in videoArgs; they are tried in order. */
export type VideoEncoder = "libx264";
export const ENCODER_FALLBACKS: VideoEncoder[] = ["libx264"];

/** Local files only: a playlist-style file must not make ffmpeg/ffprobe fetch URLs or open sockets. */
export const INPUT_PROTOCOLS = ["-protocol_whitelist", "file,crypto,data"];

export interface StreamOptions {
  input: string;
  output: string;
  startSec: number;
  audioOrdinal: number;
  encoder: VideoEncoder;
}

export function targetBitrate(info: MediaInfo): number {
  const src = info.bitrate || 4_000_000;
  return Math.min(Math.max(src, 2_000_000), 12_000_000);
}

/** Keyframe interval of the transcode, in seconds. */
export const KEYFRAME_SEC = 2;
/** Longest fragment in microseconds: bounds a remux too, whose GOP is the source's (often 3–7 s). */
export const FRAGMENT_MAX_US = 1_000_000;

/** A stream never starts closer than this to the end of the file (seconds). */
export const STREAM_END_GUARD_SEC = 3;

/**
 * Where a stream may start: a seek at or near the end would make ffmpeg write a stream with no
 * complete fragment, which Chromium fails to open ("demuxer seek failed"). Unknown durations pass.
 */
export function streamStartSec(startSec: number, durationSec: number): number {
  const t = Math.max(0, startSec);
  if (!(durationSec > 0)) return t;
  return Math.min(t, Math.max(0, durationSec - STREAM_END_GUARD_SEC));
}

export function isRemuxOnly(info: MediaInfo): boolean {
  return canRemuxVideo(info);
}

export type VideoProfile = "live" | "file";

/** `-progress` to stdout for long jobs (convert, export); runFfmpeg inserts it. */
export const PROGRESS_ARGS = ["-progress", "pipe:1", "-nostats"];

/**
 * "live" is the streaming transcode (fast, keyframes bound the fragments); "file" is a finished
 * output (better quality, normal GOP). Both copy the video when the source is already h264 yuv420p.
 */
export function videoArgs(info: MediaInfo, encoder: VideoEncoder, profile: VideoProfile): string[] {
  if (isRemuxOnly(info)) return ["-c:v", "copy"];
  const pixFmt = ["-pix_fmt", "yuv420p"];
  if (profile === "file") return ["-c:v", encoder, "-preset", "medium", "-crf", "20", ...pixFmt];
  // A keyframe every 2 s bounds each fragment (frag_keyframe), so a restart after a seek has playable
  // data in ~0.4 s instead of waiting out x264's default 250-frame GOP (~2 s measured on 1080p AV1/VP9).
  const common = [...pixFmt, "-b:v", String(targetBitrate(info)), "-force_key_frames", `expr:gte(t,n_forced*${KEYFRAME_SEC})`];
  // A hardware encoder gets its own branch here, before the libx264 default.
  return ["-c:v", encoder, "-preset", "veryfast", "-tune", "zerolatency", ...common];
}

/** Maps audio track `ordinal` of input `input` (default 0). */
export function audioArgs(info: MediaInfo, ordinal: number, input = 0): string[] {
  const track = info.audioTracks.find((t) => t.ordinal === ordinal);
  if (!track) return ["-an"];
  const map = ["-map", `${input}:a:${ordinal}`];
  if (track.codec === "aac" && track.channels <= 2) return [...map, "-c:a", "copy"];
  return [...map, "-c:a", "aac", "-b:a", "192k", "-ac", "2"];
}

/** Fragmented MP4 so the file is playable while it is still being written. */
export function buildStreamArgs(info: MediaInfo, o: StreamOptions): string[] {
  const seek = o.startSec > 0 ? ["-ss", o.startSec.toFixed(3)] : [];
  return [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    ...INPUT_PROTOCOLS, ...seek, "-i", o.input,
    "-map", "0:v:0", ...videoArgs(info, o.encoder, "live"),
    ...audioArgs(info, o.audioOrdinal),
    "-sn", "-dn",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof", "-frag_duration", String(FRAGMENT_MAX_US),
    "-f", "mp4", o.output,
  ];
}

export function buildSubtitleArgs(
  input: string, ordinal: number, startSec: number, output: string,
): string[] {
  const seek = startSec > 0 ? ["-ss", startSec.toFixed(3)] : [];
  return [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    ...INPUT_PROTOCOLS, ...seek, "-i", input,
    "-map", `0:s:${ordinal}`, "-c:s", "webvtt", "-f", "webvtt", output,
  ];
}

/** Converts an external subtitle file (srt/ass/ssa/vtt) to WebVTT, shifted back by `startSec`. */
export function buildExternalSubtitleArgs(
  input: string, demuxer: string, startSec: number, output: string,
): string[] {
  const seek = startSec > 0 ? ["-ss", startSec.toFixed(3)] : [];
  return [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-protocol_whitelist", "file",
    ...seek, "-f", demuxer, "-i", input,
    "-map", "0:s:0", "-c:s", "webvtt", "-f", "webvtt", output,
  ];
}
