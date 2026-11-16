import { chunksFromGlob } from "../chunks";

/** The tube's `#include` chunks: every glsl/*.glsl file (beam, display, geometry, mask, post), keyed by bare name. */
export const tubeChunks: Readonly<Record<string, string>> = chunksFromGlob(
  import.meta.glob<string>("./glsl/*.glsl", { query: "?raw", import: "default", eager: true }),
);
