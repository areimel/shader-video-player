import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Every .frag / .glsl file under `dir`, recursively. */
export function shaderFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return shaderFiles(path);
    return /\.(frag|glsl)$/.test(name) ? [path] : [];
  });
}

export const stripComments = (src: string): string => src.replace(/\/\/.*$/gm, "");

/** Every p_/d_ identifier used in the code (comments ignored), as "p_x" / "d_y". */
export function pdNames(src: string): string[] {
  return [...stripComments(src).matchAll(/\b([pd])_([A-Za-z0-9_]+)\b/g)].map((m) => m[0]);
}

/** p_/d_ identifiers in `file` that match no parameter id / derived key. */
export function unknownNames(file: string, paramIds: Set<string>, derivedKeys: Set<string>): string[] {
  const bad = pdNames(readFileSync(file, "utf8")).filter((n) => !(n[0] === "p" ? paramIds : derivedKeys).has(n.slice(2)));
  return [...new Set(bad)];
}
