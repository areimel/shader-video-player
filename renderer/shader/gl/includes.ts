const INCLUDE = /^\s*#include\s+"([^"]+)"\s*$/;
const VERSION = /^\s*#version\b/;

/**
 * Expands `#include "name"` lines (alone on a line) from `chunks`.
 * Nesting is allowed and each chunk is emitted once, at its first use.
 * Throws on unknown names, cycles, and a `#version` that is not the first line.
 */
export function resolveIncludes(source: string, chunks: Readonly<Record<string, string>>): string {
  const done = new Set<string>();

  const expand = (text: string, stack: readonly string[], origin: string): string[] => {
    const out: string[] = [];
    text.split("\n").forEach((line, i) => {
      const m = INCLUDE.exec(line);
      if (!m) {
        if (VERSION.test(line) && (stack.length > 0 || i > 0)) {
          throw new Error(`#version must be the first line of the shader (found in ${origin})`);
        }
        out.push(line);
        return;
      }
      const name = m[1];
      if (stack.includes(name)) throw new Error(`Include cycle: ${[...stack, name].join(" -> ")}`);
      const chunk = chunks[name];
      if (chunk === undefined) throw new Error(`Unknown include "${name}" in ${origin}`);
      if (done.has(name)) return;
      done.add(name);
      out.push(...expand(chunk, [...stack, name], `chunk "${name}"`));
    });
    return out;
  };

  return expand(source, [], "shader").join("\n");
}
