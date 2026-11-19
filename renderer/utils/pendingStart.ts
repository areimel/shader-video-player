/**
 * A resume position for the next plan that opens (a finished convert reopening at the playhead).
 * Set just before the open is requested and consumed once by `usePlaybackSource`.
 */
let pending: number | null = null;

export function setPendingStart(sec: number | undefined): void {
  pending = sec !== undefined && Number.isFinite(sec) && sec >= 0 ? sec : null;
}

/** Returns the pending position and clears it. */
export function takePendingStart(): number | undefined {
  const v = pending;
  pending = null;
  return v ?? undefined;
}
