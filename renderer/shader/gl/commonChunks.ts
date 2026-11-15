/** Shared GLSL chunks from glsl/common/*.glsl, keyed by file name without extension. */
const files = import.meta.glob<string>("../glsl/common/*.glsl", {
  query: "?raw", import: "default", eager: true,
});

export const commonChunks: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, src]) => [path.replace(/^.*\/|\.glsl$/g, ""), src]),
);
