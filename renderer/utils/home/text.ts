/** Cell-text helpers. Everything counts code points, so non-Latin names occupy one cell per character. */

const cells = (text: string): string[] => Array.from(text.toUpperCase());

/** Upper-case and truncate to `cols` code points, without padding. */
export function clip(text: string, cols: number): string {
  return cells(text).slice(0, Math.max(0, cols)).join("");
}

/** Upper-case, truncate and pad with spaces to exactly `cols` code points. */
export function fit(text: string, cols: number): string {
  const c = Math.max(0, cols);
  return clip(text, c).padEnd(c, " ");
}

export const MARQUEE_CELLS_PER_SECOND = 4;
export const MARQUEE_PAUSE_SECONDS = 1;

/**
 * A title longer than `cols` scrolls left at ~4 cells/s, rests at each end, then scrolls back.
 * Shorter text is returned fitted.
 */
export function marquee(text: string, cols: number, elapsed: number): string {
  const all = cells(text);
  const overflow = all.length - cols;
  if (overflow <= 0 || cols <= 0) return fit(text, cols);
  const travel = overflow / MARQUEE_CELLS_PER_SECOND;
  const pause = MARQUEE_PAUSE_SECONDS;
  const period = 2 * (pause + travel);
  const t = ((Math.max(0, elapsed) % period) + period) % period;
  let offset: number;
  if (t < pause) offset = 0;
  else if (t < pause + travel) offset = Math.floor((t - pause) * MARQUEE_CELLS_PER_SECOND);
  else if (t < 2 * pause + travel) offset = overflow;
  else offset = overflow - Math.floor((t - 2 * pause - travel) * MARQUEE_CELLS_PER_SECOND);
  offset = Math.min(overflow, Math.max(0, offset));
  return all.slice(offset, offset + cols).join("");
}

export function formatDuration(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec) || sec < 0) return "--:--";
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** Tier by either dimension so letterboxed films (1920x800) still read as 1080P. */
export function formatResolution(w: number | null, h: number | null): string {
  if (!w || !h || w <= 0 || h <= 0) return "";
  if (w >= 3200 || h >= 2160) return "4K";
  if (w >= 1900 || h >= 1080) return "1080P";
  if (w >= 1260 || h >= 720) return "720P";
  return `${h}P`;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "2026-11-16" -> "NOV 16"; "" when the date is not ISO. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}` : "";
}

/** Greedy word wrap on code points; words longer than `cols` are split. */
export function wrap(text: string, cols: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let w = Array.from(word);
    while (w.length > cols) {
      if (line) { lines.push(line); line = ""; }
      lines.push(w.slice(0, cols).join(""));
      w = w.slice(cols);
    }
    const rest = w.join("");
    if (!line) line = rest;
    else if (Array.from(line).length + 1 + w.length <= cols) line += " " + rest;
    else { lines.push(line); line = rest; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
