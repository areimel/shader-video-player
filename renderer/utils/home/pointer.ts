import { CELL, COLS, ROWS } from "./types";

export interface Point { x: number; y: number }
export interface Size { width: number; height: number }

/** The home raster in logical pixels (320x240). */
export const LOGICAL: Size = { width: COLS * CELL, height: ROWS * CELL };

/** Client position -> uv (0..1, origin top-left) on an element's box. */
export function clientToUv(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): Point {
  return {
    x: rect.width > 0 ? (clientX - rect.left) / rect.width : -1,
    y: rect.height > 0 ? (clientY - rect.top) / rect.height : -1,
  };
}

/**
 * Viewport uv -> picture uv for a picture fitted with `object-fit: contain` (the flat home canvas with
 * the effect off). Null when the point falls on the bars around the picture.
 */
export function containUv(view: Point, viewport: Size, picture: Size): Point | null {
  if (viewport.width <= 0 || viewport.height <= 0 || picture.width <= 0 || picture.height <= 0) return null;
  const scale = Math.min(viewport.width / picture.width, viewport.height / picture.height);
  const w = (picture.width * scale) / viewport.width;
  const h = (picture.height * scale) / viewport.height;
  const p = { x: (view.x - 0.5) / w + 0.5, y: (view.y - 0.5) / h + 0.5 };
  return p.x >= 0 && p.x < 1 && p.y >= 0 && p.y < 1 ? p : null;
}

/** Picture uv -> logical home pixels, or null outside the picture. */
export function uvToLogical(uv: Point | null): Point | null {
  if (!uv || !(uv.x >= 0 && uv.x < 1 && uv.y >= 0 && uv.y < 1)) return null;
  return { x: uv.x * LOGICAL.width, y: uv.y * LOGICAL.height };
}
