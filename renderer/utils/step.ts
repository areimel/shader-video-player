/** Digits after the decimal point implied by a step (0.005 -> 3). */
export function stepDecimals(step: number): number {
  const s = String(step);
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : s.length - dot - 1;
}

/** Snaps to `min + k*step`, without float noise, and clamps to [min, max]. */
export function snapToStep(v: number, min: number, max: number, step: number): number {
  const snapped = min + Math.round((v - min) / step) * step;
  return Math.min(max, Math.max(min, Number(snapped.toFixed(stepDecimals(step) + stepDecimals(min)))));
}
