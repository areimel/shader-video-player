/** What the library shows for an item; the full probe (`media/probe.ts`) still gates opening it. */
export type LightMeta =
  | { ok: true; durationSec: number | null; width: number | null; height: number | null }
  | { ok: false };

interface LightProbe {
  streams?: Array<{ codec_type?: unknown; width?: unknown; height?: unknown }>;
  format?: { duration?: unknown };
}

const positive = (x: unknown): number | null => {
  const n = typeof x === "string" ? Number(x) : x;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Parses `ffprobe -show_entries format=duration:stream=codec_type,width,height -of json` output.
 * A file without a video stream fails; a missing duration (some live .ts recordings) is allowed and
 * reported as null, matching the open-time probe.
 */
export function parseLightProbe(stdout: string): LightMeta {
  let raw: LightProbe;
  try {
    raw = JSON.parse(stdout) as LightProbe;
  } catch {
    return { ok: false };
  }
  if (typeof raw !== "object" || raw === null) return { ok: false };
  const streams = Array.isArray(raw.streams) ? raw.streams : [];
  const video = streams.find((s) => typeof s === "object" && s !== null && s.codec_type === "video");
  if (!video) return { ok: false };
  const rawDuration = raw.format?.duration;
  // An explicit zero duration is what the open-time probe rejects, so it is not a playable item either.
  if (rawDuration !== undefined && rawDuration !== "N/A" && positive(rawDuration) === null) return { ok: false };
  return {
    ok: true,
    durationSec: positive(rawDuration),
    width: positive(video.width),
    height: positive(video.height),
  };
}
