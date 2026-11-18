import { describe, expect, it } from "vitest";
import { GLYPHS, GRID, glyphPath, glyphRows } from "../renderer/components/common/iconGlyphs";

describe("icon glyphs", () => {
  it("every glyph fits the grid and uses only X and .", () => {
    for (const [name, g] of Object.entries(GLYPHS)) {
      expect(g.length, name).toBeGreaterThan(0);
      expect(g.length, name).toBeLessThanOrEqual(GRID);
      for (const row of g) expect(row, name).toMatch(new RegExp(`^[X.]{${GRID}}$`));
    }
  });
  it("centres short glyphs and builds run rects", () => {
    expect(glyphRows(["X" + ".".repeat(GRID - 1)])[5]?.[0]).toBe("X");
    expect(glyphPath(Array(GRID).fill("XX" + ".".repeat(GRID - 2))).startsWith("M0 0h2v1h-2z")).toBe(true);
  });
});
