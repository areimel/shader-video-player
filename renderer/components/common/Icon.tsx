import { GLYPHS, GRID, glyphPath } from "./iconGlyphs";

const PATHS = Object.fromEntries(
  Object.entries(GLYPHS).map(([k, g]) => [k, glyphPath(g)]),
) as Record<keyof typeof GLYPHS, string>;

export type IconName = keyof typeof GLYPHS;

/** Pixel-grid glyph. Keep `size` a multiple of GRID (default 24) so pixels stay crisp. */
export function Icon({ name, size = GRID * 2 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${GRID} ${GRID}`}
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
