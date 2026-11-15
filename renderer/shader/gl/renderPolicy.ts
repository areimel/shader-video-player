/** Pure decisions for the render loop. */

export interface AnimatedParam { id: string; animated?: boolean }

export function hasActiveAnimation(params: readonly AnimatedParam[], values: Readonly<Record<string, number>>): boolean {
  return params.some((p) => p.animated === true && (values[p.id] ?? 0) !== 0);
}

export interface LoopState {
  dirty: boolean;
  playing: boolean;
  animating: boolean;
}

/** Render when something changed, or keep animating while the video plays. Paused + clean = idle. */
export function shouldRender(s: LoopState): boolean {
  return s.dirty || (s.playing && s.animating);
}

/** Maximum frame delta reported to shaders, so a stall does not make animation jump. */
export const MAX_DELTA = 0.1;

export function clampDelta(seconds: number): number {
  return Math.min(MAX_DELTA, Math.max(0, seconds));
}
