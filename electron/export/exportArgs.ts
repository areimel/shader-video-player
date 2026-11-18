import type { MediaInfo } from "../../shared/types";
import { audioArgs, ENCODER_FALLBACKS, INPUT_PROTOCOLS, videoArgs } from "../media/ffmpegArgs";

export interface Size { width: number; height: number }

export const MIN_DIM = 16;
export const MAX_DIM = 7680;
export const TARGET_HEIGHT = 1080;
const DEFAULT_FPS = 30;
const MAX_FPS = 60;

const even = (n: number): number => Math.max(2, Math.round(n / 2) * 2);

/** "1920x1080": even dimensions in 16..7680. Returns null when it is anything else. */
export function parseSize(text: string): Size | null {
  const m = /^(\d{1,5})x(\d{1,5})$/i.exec(text.trim());
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  for (const d of [width, height]) if (d < MIN_DIM || d > MAX_DIM || d % 2 !== 0) return null;
  return { width, height };
}

/** Even dimensions at `aspect` (w/h) with the given height, clamped to the allowed range. */
export function sizeAtHeight(aspect: number, height: number): Size {
  const h = Math.min(MAX_DIM, Math.max(MIN_DIM, even(height)));
  const w = Math.min(MAX_DIM, Math.max(MIN_DIM, even(h * aspect)));
  return { width: w, height: h };
}

/** The source's aspect, scaled up until it is at least 1080 tall (a 4K source stays 4K). */
export function defaultSize(src: Size): Size {
  const scale = Math.max(1, TARGET_HEIGHT / src.height);
  return sizeAtHeight(src.width / src.height, even(src.height * scale));
}

/** Frame rate of the export: the probed rate, 30 when unknown, never above 60. */
export function fpsOf(info: Pick<MediaInfo, "fps">): number {
  const f = info.fps;
  if (!Number.isFinite(f) || f <= 0) return DEFAULT_FPS;
  return Math.min(MAX_FPS, f);
}

export function frameCount(durationSec: number, fps: number): number {
  return Math.max(1, Math.ceil(durationSec * fps));
}

/** Source frames as raw RGBA at the source size, resampled to a constant `fps`. */
export function decodeArgs(path: string, fps: number): string[] {
  return [
    "-hide_banner", "-loglevel", "error", "-nostdin",
    ...INPUT_PROTOCOLS, "-i", path,
    "-map", "0:v:0", "-vf", `fps=${fps}`, "-an", "-sn", "-dn",
    "-f", "rawvideo", "-pix_fmt", "rgba", "-",
  ];
}

/** `-map 1:a:N` becomes `-map 1:a:N?` so a track that vanished does not fail the export. */
const optionalMaps = (args: string[]): string[] => args.map((a, i) => (args[i - 1] === "-map" ? `${a}?` : a));

/**
 * Rendered frames (raw RGBA on stdin, bottom-up rows from readPixels, hence vflip) plus the
 * source's audio track. The whitelist is not applied to the pipe input: it would block `pipe:`.
 */
export function encodeArgs(info: MediaInfo, audioOrdinal: number, size: Size, fps: number, output: string): string[] {
  // The video being encoded is the rendered RGBA, never the source codec: never stream-copy it.
  const rendered = { ...info, videoCodec: "rawvideo", pixFmt: "rgba" };
  return [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${size.width}x${size.height}`, "-r", String(fps), "-i", "-",
    ...INPUT_PROTOCOLS, "-i", info.path,
    "-map", "0:v", ...optionalMaps(audioArgs(info, audioOrdinal, 1)),
    "-vf", "vflip",
    ...videoArgs(rendered, ENCODER_FALLBACKS[0]!, "file"),
    "-sn", "-dn", "-shortest", "-movflags", "+faststart", "-f", "mp4", output,
  ];
}
