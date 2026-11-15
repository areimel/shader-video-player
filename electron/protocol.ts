import { protocol } from "electron";
import { createReadStream, openSync, readSync, closeSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { allowedRealPath } from "./allowlist";
import { mimeForPath } from "./media/formats";
import { getStream } from "./playback";
import type { StreamSession } from "./media/session";

export const SCHEME = "svp-media";

export function registerScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } },
  ]);
}

const deny = () => new Response("Forbidden", { status: 403 });

function parseRange(header: string | null, size: number): [number, number] | null {
  const m = header && /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m || (!m[1] && !m[2])) return null;
  let start = m[1] ? Number(m[1]) : size - Number(m[2]);
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  start = Math.max(0, start);
  return start > end ? null : [start, end];
}

function serveFile(path: string, rangeHeader: string | null): Response {
  // Resolve once and use that path for stat/open too, so a swapped symlink cannot redirect the read.
  const real = allowedRealPath(path);
  if (!real) return deny();
  let size: number;
  try {
    const st = statSync(real);
    if (!st.isFile()) return new Response("Not found", { status: 404 });
    size = st.size;
  } catch { return new Response("Not found", { status: 404 }); }
  const headers: Record<string, string> = {
    "Content-Type": mimeForPath(real), "Accept-Ranges": "bytes",
  };
  if (size === 0) return new Response(null, { status: 200, headers: { ...headers, "Content-Length": "0" } });
  const range = parseRange(rangeHeader, size);
  if (rangeHeader && !range) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const [start, end] = range ?? [0, size - 1];
  headers["Content-Length"] = String(end - start + 1);
  if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  const body = Readable.toWeb(createReadStream(real, { start, end })) as ReadableStream;
  return new Response(body, { status: range ? 206 : 200, headers });
}

/** Tails the growing fragmented MP4 until ffmpeg finishes. The fd is opened on first pull and closed exactly once. */
function serveStream(s: StreamSession, signal: AbortSignal): Response {
  let fd: number | null = null;
  let closed = false;
  let pos = 0;
  const close = () => {
    closed = true;
    if (fd === null) return;
    const old = fd;
    fd = null;
    try { closeSync(old); } catch { /* already closed */ }
  };
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const buf = Buffer.alloc(256 * 1024);
      try {
        for (;;) {
          if (closed) return; // cancelled: the stream is already closed, do not touch the controller
          if (signal.aborted) { close(); return controller.close(); }
          fd ??= openSync(s.file, "r");
          const n = readSync(fd, buf, 0, buf.length, pos);
          if (n > 0) {
            pos += n;
            return controller.enqueue(new Uint8Array(buf.subarray(0, n)));
          }
          if (s.done) { close(); return controller.close(); }
          await new Promise((r) => setTimeout(r, 40));
        }
      } catch (e) {
        const wasClosed = closed;
        close();
        if (!wasClosed) controller.error(e);
      }
    },
    cancel() { close(); },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "video/mp4" } });
}

/**
 * The dev server, and the packaged renderer: pages loaded from file:// send the literal string
 * `Origin: null` (never "file://"), so "null" is what the packaged app needs. Other opaque origins
 * (sandboxed iframes, data: URLs) also send "null"; the renderer embeds none, and the scheme only
 * serves allowlisted files, so accepting it is the price of file:// support.
 */
const ALLOWED_ORIGINS = new Set(["http://localhost:5173", "null"]);

/** CORS lets WebGL sample the video; only the app's own origins get it. */
function withCors(res: Response, origin: string | null): Response {
  if (origin === null || !ALLOWED_ORIGINS.has(origin)) return res;
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
  return res;
}

function route(req: Request): Response {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS", "Access-Control-Allow-Headers": "Range" },
    });
  }
  const url = new URL(req.url);
  if (url.hostname === "file") {
    return serveFile(decodeURIComponent(url.pathname.slice(1)), req.headers.get("range"));
  }
  if (url.hostname === "stream") {
    const s = getStream(url.pathname.slice(1));
    return s ? serveStream(s, req.signal) : deny();
  }
  return deny();
}

export function registerProtocol(): void {
  protocol.handle(SCHEME, (req) => {
    let res: Response;
    try { res = route(req); } catch { res = new Response("Server error", { status: 500 }); }
    return withCors(res, req.headers.get("origin"));
  });
}
