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
 * True for hosts that point at this machine or a private network. Works on the literal host only (no DNS; DNS rebinding and
 * redirects are a known, accepted gap: yt-dlp follows redirects and the user types the URL):
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

/** Expands an IPv6 literal (no brackets) to its 8 hextets, or null when malformed. Accepts a dotted IPv4 tail. */
function expandV6(addr: string): number[] | null {
  let text = addr;
  const dot = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (dot) {
    const o = dot.slice(1).map(Number);
    if (o.some((n) => n > 255)) return null;
    text = text.slice(0, dot.index) + ((o[0] << 8) | o[1]).toString(16) + ":" + ((o[2] << 8) | o[3]).toString(16);
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) => (part === "" ? [] : part.split(":"));
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

const v4From = (hi: number, lo: number) => [hi >> 8, hi & 255, lo >> 8, lo & 255];

function isPrivateV6(addr: string): boolean {
  const g = expandV6(addr);
  if (!g) return true; // cannot be understood: refuse
  if (g.every((x) => x === 0) || (g.slice(0, 7).every((x) => x === 0) && g[7] === 1)) return true; // :: and ::1
  if ((g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80) return true; // fc00::/7, fe80::/10
  const zero = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (zero(5) && g[5] === 0xffff) return isPrivateV4(v4From(g[6], g[7])); // ::ffff:0:0/96 mapped
  if (zero(6)) return isPrivateV4(v4From(g[6], g[7])); // ::/96 IPv4-compatible
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPrivateV4(v4From(g[6], g[7])); // 64:ff9b::/96 NAT64
  if (g[0] === 0x2002) return isPrivateV4(v4From(g[1], g[2])); // 2002::/16 6to4
  return false;
}
