import type { MediaInfo } from "../../shared/types";
import { INPUT_PROTOCOLS, audioArgs, videoArgs, type VideoEncoder } from "../media/ffmpegArgs";

/**
 * ffmpeg args that write a natively playable MP4 (h264 yuv420p + at most one AAC track, moov first).
 * Exactly one audio track is kept because native playback requires at most one (`nativeMime`).
 * A source without audio gets none. H.264 sources copy the video, so a remux takes seconds.
 */
export function buildConvertArgs(info: MediaInfo, audioOrdinal: number, encoder: VideoEncoder, outPart: string): string[] {
  return [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    ...INPUT_PROTOCOLS, "-i", info.path,
    "-map", "0:v:0", ...videoArgs(info, encoder, "file"),
    ...audioArgs(info, audioOrdinal),
    "-sn", "-dn", "-movflags", "+faststart", "-f", "mp4", outPart,
  ];
}
