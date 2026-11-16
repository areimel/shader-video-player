/**
 * Frame numbers wrap here. A multiple of 2 and 3 (like VideoSource's counter), so interlace parity and
 * three-phase dot crawl stay continuous across the wrap.
 */
export const CLOCK_FRAME_WRAP = 6_000_000;

/**
 * A pausable wall clock for inputs that have no media time of their own (the home screen canvas).
 * Timestamps are injected in milliseconds (performance.now() in the app), so this stays pure.
 * Elapsed time only advances while running; resuming continues from where it paused.
 */
export class InputClock {
  /** Seconds accumulated by earlier runs. */
  private banked = 0;
  /** Start of the current run (ms), or null while paused. */
  private since: number | null = null;

  constructor(readonly fps = 30) {
    if (!(fps > 0)) throw new Error(`InputClock fps must be positive, got ${fps}`);
  }

  get running(): boolean {
    return this.since !== null;
  }

  resume(nowMs: number): void {
    if (this.since === null) this.since = nowMs;
  }

  pause(nowMs: number): void {
    if (this.since === null) return;
    this.banked = this.elapsed(nowMs);
    this.since = null;
  }

  /** Seconds of running time. A timestamp earlier than the current run's start counts as no time, never negative. */
  elapsed(nowMs: number): number {
    if (this.since === null) return this.banked;
    return this.banked + Math.max(0, nowMs - this.since) / 1000;
  }

  /** Frame number at `fps` from the running time; monotonic until it wraps at CLOCK_FRAME_WRAP. */
  frame(nowMs: number): number {
    return Math.floor(this.elapsed(nowMs) * this.fps) % CLOCK_FRAME_WRAP;
  }
}
