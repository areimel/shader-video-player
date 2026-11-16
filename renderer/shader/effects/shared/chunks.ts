/** `import.meta.glob(..., { query: "?raw", import: "default", eager: true })` result -> chunks keyed by bare file name. */
export function chunksFromGlob(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(files).map(([path, src]) => [path.replace(/^.*\/|\.glsl$/g, ""), src]));
}
