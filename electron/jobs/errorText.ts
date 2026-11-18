export const MAX_ERROR_CHARS = 160;

/** `ERROR: ` and `WARNING: ` labels, and extractor tags such as `[youtube] aqz-KE-bpKQ: ` or `[generic] ` (repeatable). */
const PREFIX = /^\s*(?:(?:ERROR|WARNING):\s*|\[[\w:.+-]+\]\s*(?:[\w.-]+:\s+)?)/i;

/** Turns a raw failure message (often a yt-dlp or ffmpeg stderr tail) into one short line for a job card. */
export function normalizeJobError(message: string): string {
  let text = message.replace(/\s+/g, " ").trim();
  for (let prev = ""; prev !== text;) { prev = text; text = text.replace(PREFIX, ""); }
  text = text.trim();
  if (!text) return "Something went wrong";
  return text.length > MAX_ERROR_CHARS ? `${text.slice(0, MAX_ERROR_CHARS - 1).trimEnd()}…` : text;
}
