import type { ColorRole, HomeFrame } from "../../utils/home/types";
import { CELL } from "../../utils/home/types";

/** Device pixels per logical pixel: the 320x240 layout is painted on a 640x480 canvas. */
export const SCALE = 2;
export const FONT_FAMILY = "Press Start 2P";
/** 8 logical pixels per cell at 2x: Press Start 2P draws one glyph per 16 px em, so glyph pixels land on the grid. */
export const FONT_PX = CELL * SCALE;
export const fontSpec = (px: number): string => `${px}px "${FONT_FAMILY}", monospace`;

export type HomeColors = Record<ColorRole, string>;

/** Colour role -> token in tokens.css. Ink on the yellow accent is the navy band colour. */
const TOKENS: Record<ColorRole, string> = {
  bg: "--tv-blue", band: "--tv-navy", text: "--tv-white", accent: "--tv-yellow", accentInk: "--tv-navy", dim: "--tv-cyan", alert: "--tv-red",
};

/** Resolves every colour role from the tokens once (call per mount, not per paint). */
export function readColors(el: Element): HomeColors {
  const style = getComputedStyle(el);
  const out = {} as HomeColors;
  for (const role of Object.keys(TOKENS) as ColorRole[]) out[role] = style.getPropertyValue(TOKENS[role]).trim();
  return out;
}

export function homeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (ctx) ctx.imageSmoothingEnabled = false;
  return ctx;
}

/**
 * Draws a home frame. Text goes one code point per cell at integer positions, so a fallback glyph
 * (non-Latin file names) is squeezed into its cell instead of shifting the rest of the row.
 */
export function paint(ctx: CanvasRenderingContext2D, frame: HomeFrame, colors: HomeColors): void {
  ctx.imageSmoothingEnabled = false;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  let font = "";
  for (const op of frame.ops) {
    ctx.fillStyle = colors[op.color];
    if (op.op === "rect") {
      ctx.fillRect(op.x * SCALE, op.y * SCALE, op.w * SCALE, op.h * SCALE);
      continue;
    }
    const s = op.scale ?? 1;
    const cell = CELL * SCALE * s;
    const want = fontSpec(FONT_PX * s);
    if (want !== font) { ctx.font = want; font = want; }
    const chars = Array.from(op.text);
    const x0 = op.x * SCALE - (op.align === "right" ? chars.length * cell : 0);
    const y = op.y * SCALE;
    chars.forEach((ch, i) => { if (ch !== " ") ctx.fillText(ch, x0 + i * cell, y, cell); });
  }
}
