// Subcarrier phase and chroma filter width shared by the signal encode and decode passes, which
// must agree exactly. Requires PI from "sampling" and the uniforms uVideoFrame, p_crawl, p_phaseMode,
// d_subcarrier and d_chromaCutoff, all declared by the including pass.

// 2-phase: pi per line and per frame (NTSC-like 227.5 cycles/line); 3-phase: 2pi/3 per line and
// per frame (the classic home-computer pattern). Video frame index (once per presented frame, not per render) taken mod 6 (divisible by 2 and 3).
float linePhase(int line) {
  int f = p_crawl > 0.5 ? uVideoFrame % 6 : 0;
  if (p_phaseMode > 0.5) return float((line + f) % 3) * (2.0 * PI / 3.0);
  return float((line + f) % 2) * PI;
}
float subcarrierPhase(float x, int line) {
  return 2.0 * PI * fract(d_subcarrier * x) + linePhase(line);
}
// Gaussian sigma for each half (encoder / decoder) of the chroma chain: two cascaded Gaussians of
// sigma s/sqrt(2) give one of sigma s, whose -3 dB point is at d_chromaCutoff when s = 0.1325/fc.
// Floor of 0.8 samples so the decoder's least-squares demodulation always sees several phases.
float chromaSigma() { return max(0.0937 / max(d_chromaCutoff, 1e-3), 0.8); }
