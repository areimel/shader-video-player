/**
 * Response heads for the transcode stream: a fragmented MP4 that ffmpeg is still writing, so its
 * final size is unknown until the session is done.
 *
 * Chromium's media loader (blink `ResourceMultiBufferDataProvider`) re-requests the same URL with
 * `Range: bytes=N-` whenever it needs data it no longer holds (a seek, a jump between a fragment's
 * video and audio samples, cache eviction). That request must get the bytes from N. Two rules from
 * that loader shape the answers here:
 * - The end of any response body with an unknown length is taken as the end of the file, and that
 *   length sticks. So a body for a growing file stays open until ffmpeg is done; it never ends at
 *   the bytes written so far, and a start past them waits rather than getting a 416.
 * - A 206 with `Content-Range: bytes N-M/*` is accepted for any M >= N and keeps the length
 *   unknown; Content-Length is ignored for a 206.
 */

/** Far past any real file, so the open-ended 206 never claims a last byte the stream will reach. */
export const OPEN_END_SPAN = 2 ** 40;

/** Start offset of a `bytes=N-` or `bytes=N-M` request; null when absent or not a plain first-byte range. */
export function streamRangeStart(header: string | null): number | null {
  const m = header ? /^bytes=(\d+)-(\d*)$/.exec(header.trim()) : null;
  if (!m) return null;
  const start = Number(m[1]);
  return Number.isSafeInteger(start) ? start : null;
}

export interface StreamHead {
  status: 200 | 206 | 416;
  headers: Record<string, string>;
  /** First byte the body sends. */
  start: number;
}

/**
 * The head for a request starting at `start` (null: no usable Range) when `written` bytes exist.
 * Call it once `written > start` or the session is done; a growing stream is never answered early.
 */
export function streamHead(start: number | null, written: number, done: boolean): StreamHead {
  const base = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes" };
  const from = start ?? 0;
  if (done) {
    if (from >= written && written > 0) {
      return { status: 416, headers: { "Content-Range": `bytes */${written}` }, start: from };
    }
    const headers = { ...base, "Content-Length": String(Math.max(0, written - from)) };
    if (start === null || written === 0) return { status: 200, headers, start: 0 };
    return { status: 206, headers: { ...headers, "Content-Range": `bytes ${from}-${written - 1}/${written}` }, start: from };
  }
  if (from === 0) return { status: 200, headers: base, start: 0 };
  return {
    status: 206,
    headers: { ...base, "Content-Range": `bytes ${from}-${from + OPEN_END_SPAN}/*` },
    start: from,
  };
}
