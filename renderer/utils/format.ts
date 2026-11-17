export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Countdown label such as "-1:05"; without a finite positive duration it shows the elapsed time. */
export function formatRemaining(time: number, duration: number): string {
  if (!Number.isFinite(duration) || duration <= 0) return formatTime(time);
  return `-${formatTime(Math.max(0, duration - time))}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

export function formatBitrate(bps: number): string {
  if (!bps) return "—";
  return bps >= 1_000_000 ? `${(bps / 1_000_000).toFixed(1)} Mbps` : `${Math.round(bps / 1000)} kbps`;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const msg = raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
  if (/Could not read|No video stream/i.test(msg)) {
    return "This file looks corrupt or isn't a playable video.";
  }
  return msg || "Something went wrong.";
}

/**
 * Toast text for a <video> error, from Chromium's MediaError message (e.g.
 * "PipelineStatus::PIPELINE_ERROR_DECODE: video decode error!"). The raw message goes to the console.
 */
export function mediaErrorText(detail?: string): string {
  const d = detail ?? "";
  const reason = /DEMUXER_ERROR|FFmpegDemuxer/.test(d) ? "its data couldn't be read"
    : /audio/i.test(d) && /DECODE/.test(d) ? "audio decoding failed"
    : /DECODE/.test(d) ? "video decoding failed"
    : /NETWORK|network/.test(d) ? "loading it failed"
    : "";
  return reason ? `This file couldn't be played: ${reason}.` : "This file couldn't be played. It may be corrupt or unsupported.";
}

export function trackLabel(t: { language: string; title: string; codec: string }, n: number): string {
  const lang = t.language && t.language !== "und" ? t.language.toUpperCase() : "";
  return [`Track ${n}`, t.title, lang, t.codec].filter(Boolean).join(" · ");
}
