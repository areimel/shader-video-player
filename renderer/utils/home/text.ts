/** Cell-text helpers. Everything counts code points, so non-Latin names occupy one cell per character. */

/**
 * Display cells: NFKC first, so full-width punctuation in file names ("：", "｜", common in downloaded titles)
 * becomes the ASCII the pixel font draws instead of a squeezed fallback glyph.
 */
const cells = (text: string): string[] => Array.from(text.normalize("NFKC").toUpperCase());

/** Upper-case and truncate to `cols` code points, without padding. */
export function clip(text: string, cols: number): string {
  return cells(text).slice(0, Math.max(0, cols)).join("");
}

/**
 * Like `clip`, but a cut that would split a word backs up to the last space or hyphen, as long as that keeps at
 * least half the cells ("THIRD-GENERATION DUB" in 18 -> "THIRD-GENERATION", not "THIRD-GENERATION D").
 */
export function clipWords(text: string, cols: number): string {
  const all = cells(text);
  if (all.length <= cols) return all.join("");
  const cut = Math.max(0, cols);
  // A separator left alone at the end ("TOME OF THE UNKNOWN |") goes too.
  const tidy = (s: string) => s.trimEnd().replace(/\s+[|:;,/\-–—]+$/u, "");
  if (all[cut] === " ") return tidy(all.slice(0, cut).join(""));
  for (let i = cut - 1; i >= Math.ceil(cut / 2); i--) {
    if (all[i] === " ") return tidy(all.slice(0, i).join(""));
    if (all[i] === "-") return all.slice(0, i + 1).join("");
  }
  return all.slice(0, cut).join("");
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
  const e = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const t = ((e % period) + period) % period;
  let offset: number;
  if (t < pause) offset = 0;
  else if (t < pause + travel) offset = Math.floor((t - pause) * MARQUEE_CELLS_PER_SECOND);
  else if (t < 2 * pause + travel) offset = overflow;
  else offset = overflow - Math.floor((t - 2 * pause - travel) * MARQUEE_CELLS_PER_SECOND);
  offset = Math.min(overflow, Math.max(0, offset));
  return all.slice(offset, offset + cols).join("");
}

/**
 * Seconds until `marquee(text, cols, elapsed)` shows a different window, or null when it never changes. The offset
 * steps at pause + j/rate going out and at 2*pause + travel + j/rate coming back (j = 1..overflow), per period.
 */
export function marqueeNextChange(text: string, cols: number, elapsed: number): number | null {
  const overflow = cells(text).length - cols;
  if (overflow <= 0 || cols <= 0) return null;
  const step = 1 / MARQUEE_CELLS_PER_SECOND;
  const travel = overflow * step;
  const pause = MARQUEE_PAUSE_SECONDS;
  const period = 2 * (pause + travel);
  const e = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  // Same expressions as marquee(), so both agree on which side of a step boundary `t` is.
  const t = ((e % period) + period) % period;
  const rate = MARQUEE_CELLS_PER_SECOND;
  let next: number;
  if (t < pause) next = pause + step;
  else if (t < pause + travel) next = pause + (Math.floor((t - pause) * rate) + 1) / rate;
  else if (t < 2 * pause + travel) next = 2 * pause + travel + step;
  else next = 2 * pause + travel + (Math.floor((t - 2 * pause - travel) * rate) + 1) / rate;
  return next - t;
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
  if (w >= 2500 || h >= 1440) return "1440P";
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
