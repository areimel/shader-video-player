const CONTEXT_LINES = 2;

/** Builds a readable compile/link error: pass id, driver log, and numbered source around each offending line. */
export function formatShaderError(passId: string, stage: string, log: string, source: string): string {
  const lines = source.split("\n");
  const bad = new Set<number>();
  for (const m of log.matchAll(/^\s*(?:ERROR|WARNING)?:?\s*\d+:(\d+)/gm)) bad.add(Number(m[1]));

  const shown = new Set<number>();
  for (const n of bad) {
    for (let i = n - CONTEXT_LINES; i <= n + CONTEXT_LINES; i++) if (i >= 1 && i <= lines.length) shown.add(i);
  }
  const width = String(lines.length).length;
  const snippet = [...shown].sort((a, b) => a - b).map((n) =>
    `${bad.has(n) ? ">" : " "} ${String(n).padStart(width)} | ${lines[n - 1]}`);

  return [`Pass "${passId}": ${stage} failed`, log.trim(), ...(snippet.length ? ["", ...snippet] : [])].join("\n");
}
