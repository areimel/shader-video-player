#version 300 es
precision highp float;
precision highp int;   // int / and % below (mediump int hit a Mesa ACO 16-bit div bug; uVideoFrame passes 16 bits)
// signalEncode: what the source device puts on the cable, one raster sample per texel (H x V).
// Everything stays gamma-encoded: analog video carries gamma-corrected voltages.
//
// Intermediate layout (RGBA16F, read by signal-decode.frag), by p_signalMode:
//   RGB (0):       rgb = R, G, B (each + independent noise)            a = 1
//   S-Video (1):   r = Y + noise   g = I + noise   b = Q + noise          a = 1
//                  I/Q already band-limited (encoder half) and shifted by p_chromaDelay.
//   Composite (2): see glsl/common/composite-encode.glsl (r = S, g = Y, b = C).
//
// Line jitter is applied here, when the source is sampled, so luma and chroma move together
// (a sync timing error shifts the whole line). Written from the NTSC signal maths; no code adapted.

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;   // raster: gamma-encoded RGB, H x V
uniform vec4 uSourceSize;    // (w, h, 1/w, 1/h)
uniform int uFrame;
uniform int uVideoFrame;

uniform float p_signalMode;  // 0 RGB, 1 S-Video, 2 Composite (SIGNAL in params.ts)
uniform float p_phaseMode;   // 0 = 2-phase, 1 = 3-phase
uniform float p_crawl;       // 1 = subcarrier phase advances every frame
uniform float p_chromaDelay; // raster samples, + = chroma lags (shifted right)
uniform float p_signalNoise; // noise standard deviation in signal units (Y = 0..1)
uniform float p_jitter;      // max per-line displacement, raster samples
uniform float d_subcarrier;  // cycles per raster sample
uniform float d_chromaCutoff;// cycles per raster sample (-3 dB point of the whole chroma chain)

#include "sampling"
#include "gaussian"
#include "noise"
#include "yiq"
#include "subcarrier"
#include "composite-encode"

int frameSeed() { return uFrame % 1024; }

// Zero-mean noise with standard deviation 1 (sum of two uniforms = triangular, var 1/6).
// VHS has the same generator as gaussNoise3 (vhs/glsl/tape-noise.glsl) with an exact sqrt(6) and its own seed; this copy
// keeps 2.449 and its seed offset so CRT output stays bit-identical. Keep the two in step otherwise.
vec3 noise3(vec2 p) {
  vec2 q = p + vec2(float(frameSeed())) * vec2(13.37, 7.31);
  return (hash32(q) + hash32(q + vec2(57.3, 91.1)) - 1.0) * 2.449;
}

void main() {
  float x = floor(vUv.x * uSourceSize.x);           // sample index
  int line = int(floor(vUv.y * uSourceSize.y));     // line index from the top

  // Per-line, per-frame horizontal displacement in [-p_jitter, p_jitter].
  float jitter = (hash12(vec2(float(line) + 0.5, float(frameSeed()) * 3.7 + 11.0)) * 2.0 - 1.0) * p_jitter;
  float xs = x + jitter;

  vec3 n = noise3(vec2(x, float(line))) * p_signalNoise;

  if (p_signalMode < 0.5) {                          // RGB: three independent wires
    fragColor = vec4(lineSample(uSource, uSourceSize, vUv.y, xs) + n, 1.0);
    return;
  }

  vec2 iq = encodeChromaIQ(uSource, uSourceSize, vUv.y, xs, p_chromaDelay, chromaSigma(d_chromaCutoff), true);
  float y = rgb2yiq(lineSample(uSource, uSourceSize, vUv.y, xs)).x;  // luma is band-limited by the receiver

  if (p_signalMode < 1.5) {                          // S-Video: Y and C on separate wires
    fragColor = vec4(vec3(y, iq) + n, 1.0);
    return;
  }

  // Composite: quadrature-modulate the band-limited chroma onto the subcarrier and add it to Y.
  float phi = subcarrierPhase(x, line, d_subcarrier, crawlFrame(uVideoFrame, p_crawl > 0.5), p_phaseMode > 0.5);
  fragColor = compositeEncode(y, iq, phi, n.x);
}
