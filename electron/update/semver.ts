export interface Version {
  major: number;
  minor: number;
  patch: number;
  pre: (string | number)[];
}

const RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseVersion(s: string): Version | null {
  const m = RE.exec(s.trim());
  if (!m) return null;
  const pre = m[4] ? m[4].split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p)) : [];
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre };
}

const sign = (n: number): -1 | 0 | 1 => (n < 0 ? -1 : n > 0 ? 1 : 0);

function comparePre(a: (string | number)[], b: (string | number)[]): -1 | 0 | 1 {
  if (!a.length || !b.length) return sign(b.length - a.length); // a release outranks any pre-release
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i], y = b[i];
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return sign(x - y);
    if (typeof x === "number") return -1; // numeric identifiers sort below alphanumeric
    if (typeof y === "number") return 1;
    return x < y ? -1 : 1;
  }
  return sign(a.length - b.length);
}

/** Semver precedence. Throws on an unparsable version. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) throw new Error(`Invalid version: ${x ? b : a}`);
  return sign(x.major - y.major) || sign(x.minor - y.minor) || sign(x.patch - y.patch) || comparePre(x.pre, y.pre);
}
