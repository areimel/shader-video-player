/** Terminal progress: pure formatting plus a small reporter. */

export interface ProgressUpdate {
  fraction: number | null;
  etaSec: number | null;
  label: string;
}

export function formatEta(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec) || sec < 0) return "";
  const s = Math.round(sec);
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} left`;
  return `about ${Math.round(s / 3600)} h left`;
}

/** `[#########.........]  47%  1:05 left  label`. A null fraction bounces a block with `tick`. */
export function formatBar(
  fraction: number | null, etaSec: number | null, label: string, width: number, tick = 0,
): string {
  const w = Math.max(4, Math.floor(width));
  let bar: string;
  let pct: string;
  if (fraction === null || !Number.isFinite(fraction)) {
    const block = Math.max(2, Math.floor(w / 5));
    const span = w - block;
    const phase = tick % (span * 2);
    const pos = phase <= span ? phase : span * 2 - phase;
    bar = ".".repeat(pos) + "#".repeat(block) + ".".repeat(span - pos);
    pct = " ---%";
  } else {
    const f = Math.min(1, Math.max(0, fraction));
    const filled = Math.round(f * w);
    bar = "#".repeat(filled) + ".".repeat(w - filled);
    pct = `${String(Math.round(f * 100)).padStart(3)}%`;
  }
  return [`[${bar}]`, pct, formatEta(etaSec), label].filter((p) => p !== "").join("  ");
}

export interface Reporter {
  update(p: ProgressUpdate): void;
  /** Ends the progress display; `message` is printed as the final line. */
  finish(message?: string): void;
}

const NON_TTY_STEP = 0.05;
const NON_TTY_INTERVAL_MS = 10_000;

export function createReporter(stream: NodeJS.WriteStream, now: () => number = Date.now): Reporter {
  let tick = 0;
  let drawn = false;
  let lastFraction = -1;
  let lastAt = -Infinity;
  const tty = Boolean(stream.isTTY);

  return {
    update(p) {
      if (tty) {
        const cols = Math.max(20, stream.columns || 80);
        const line = formatBar(p.fraction, p.etaSec, p.label, Math.min(30, Math.floor(cols / 3)), tick++);
        stream.write(`\r${line.slice(0, cols - 1).padEnd(cols - 1)}`);
        drawn = true;
        return;
      }
      const t = now();
      const f = p.fraction;
      const stepped = f !== null && f - lastFraction >= NON_TTY_STEP;
      if (!stepped && t - lastAt < NON_TTY_INTERVAL_MS) return;
      if (f !== null) lastFraction = f;
      lastAt = t;
      stream.write(`${formatBar(f, p.etaSec, p.label, 20, tick++)}\n`);
    },
    finish(message) {
      if (tty && drawn) stream.write("\n");
      drawn = false;
      if (message) stream.write(`${message}\n`);
    },
  };
}
