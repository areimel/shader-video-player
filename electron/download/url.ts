const MAX_URL_LENGTH = 2048;

/** Validates a user-supplied video URL (http/https, no credentials). Returns the normalised string; throws a readable error. */
export function parseVideoUrl(s: unknown): string {
  if (typeof s !== "string") throw new Error("Enter a video URL");
  const text = s.trim();
  if (!text) throw new Error("Enter a video URL");
  if (text.length > MAX_URL_LENGTH) throw new Error("That URL is too long");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("That is not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https links can be downloaded");
  if (url.username || url.password) throw new Error("URLs with a user name or password are not supported");
  if (isLocalHost(url.hostname)) throw new Error("Local and private network addresses cannot be downloaded");
  return url.href;
}

/**
 * True for hosts that point at this machine or a private network. Works on the literal host only (no DNS):
 * `new URL` has already turned decimal, hex, octal and short IPv4 forms into dotted quads, and IPv6 into
 * a compressed hex form in brackets.
 */
export function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.startsWith("[") && host.endsWith("]")) return isPrivateV6(host.slice(1, -1));
  const v4 = parseV4(host);
  return v4 ? isPrivateV4(v4) : false;
}

function parseV4(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  return m ? m.slice(1).map(Number) : null;
}

function isPrivateV4([a, b]: number[]): boolean {
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function isPrivateV6(addr: string): boolean {
  if (addr === "::1" || addr === "::") return true;
  // IPv4-mapped (::ffff:a.b.c.d is normalised by URL to ::ffff:hhhh:hhhh).
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(addr);
  if (mapped) {
    const hi = parseInt(mapped[1], 16), lo = parseInt(mapped[2], 16);
    return isPrivateV4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  }
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (dotted) return isPrivateV4(dotted[1].split(".").map(Number));
  const first = parseInt(addr.split(":")[0] || "0", 16);
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80;
}
