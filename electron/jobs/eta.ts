/** Remaining-time estimate from an exponentially weighted rate of progress. */
export class EtaEstimator {
  static readonly MIN_ELAPSED_MS = 2000;
  static readonly MIN_FRACTION = 0.01;
  private static readonly ALPHA = 0.3;

  private startMs: number | null = null;
  private lastMs = 0;
  private lastFraction = 0;
  private rate: number | null = null; // fraction per ms

  /** Seconds left, or null while the estimate would be noise. Never negative. */
  update(fraction: number, nowMs: number): number | null {
    const f = Math.min(1, Math.max(0, fraction));
    if (this.startMs === null) {
      this.startMs = nowMs;
      this.lastMs = nowMs;
      this.lastFraction = f;
      return null;
    }
    const dt = nowMs - this.lastMs;
    if (dt > 0 && f > this.lastFraction) {
      const inst = (f - this.lastFraction) / dt;
      this.rate = this.rate === null ? inst : EtaEstimator.ALPHA * inst + (1 - EtaEstimator.ALPHA) * this.rate;
      this.lastMs = nowMs;
      this.lastFraction = f;
    } else if (dt > 0 && f >= this.lastFraction) {
      this.lastMs = nowMs; // stalled: time passes, rate estimate unchanged
    }
    if (nowMs - this.startMs < EtaEstimator.MIN_ELAPSED_MS || f < EtaEstimator.MIN_FRACTION) return null;
    if (this.rate === null || this.rate <= 0) return null;
    return Math.max(0, ((1 - f) / this.rate) / 1000);
  }
}
