/** Parses ffmpeg `-progress pipe:1` output (key=value lines) into a 0..1 fraction. */

export interface FfmpegProgress {
  /** Feed stdout text. Returns the newest fraction in this chunk, or null if it carried none. */
  push(chunk: string): number | null;
  readonly ended: boolean;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

function parseClock(v: string): number | null {
  const m = /^(-?)(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(v);
  if (!m) return null;
  const sec = Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4]);
  return m[1] ? 0 : sec;
}

export function createFfmpegProgress(durationSec: number): FfmpegProgress {
  let partial = "";
  let ended = false;
  const toFraction = (sec: number): number | null => (durationSec > 0 ? clamp01(sec / durationSec) : null);

  return {
    get ended() { return ended; },
    push(chunk: string): number | null {
      const parts = (partial + chunk).split(/\r?\n/);
      partial = parts.pop() ?? "";
      let fraction: number | null = null;
      for (const line of parts) {
        const eq = line.indexOf("=");
        if (eq < 0) continue;
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim();
        if (value === "N/A") continue;
        let sec: number | null = null;
        if (key === "out_time_us" || key === "out_time_ms") {
          const us = Number(value); // out_time_ms is microseconds too
          if (Number.isFinite(us)) sec = Math.max(0, us) / 1e6;
        } else if (key === "out_time") {
          sec = parseClock(value);
        } else if (key === "progress") {
          if (value === "end") { ended = true; fraction = 1; }
          continue;
        }
        if (sec !== null) {
          const f = toFraction(sec);
          if (f !== null && !ended) fraction = f;
        }
      }
      return fraction;
    },
  };
}
