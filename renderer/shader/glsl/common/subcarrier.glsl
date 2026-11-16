// Colour subcarrier phase and chroma filter width shared by composite encode and decode, which must
// agree exactly. Pure: frequencies and flags are arguments. Written from the NTSC signal maths.
#include "sampling"

// Frame index for the phase pattern: the video frame mod 6 (divisible by 2 and 3) when crawling, else 0.
int crawlFrame(int videoFrame, bool crawl) { return crawl ? videoFrame % 6 : 0; }

// 2-phase: pi per line and per frame (NTSC-like 227.5 cycles/line); 3-phase: 2pi/3 per line and per
// frame (the classic home-computer pattern).
float linePhase(int line, int frame, bool threePhase) {
  if (threePhase) return float((line + frame) % 3) * (2.0 * PI / 3.0);
  return float((line + frame) % 2) * PI;
}

// `cyclesPerSample`: subcarrier frequency in cycles per raster sample.
float subcarrierPhase(float x, int line, float cyclesPerSample, int frame, bool threePhase) {
  return 2.0 * PI * fract(cyclesPerSample * x) + linePhase(line, frame, threePhase);
}

// Gaussian sigma for each half (encoder / decoder) of the chroma chain: two cascaded Gaussians of
// sigma s/sqrt(2) give one of sigma s, whose -3 dB point is at `chromaCutoff` (cycles per sample) when
// s = 0.1325/fc. Floor of 0.8 samples so the decoder's least-squares demodulation always sees several phases.
float chromaSigma(float chromaCutoff) { return max(0.0937 / max(chromaCutoff, 1e-3), 0.8); }
