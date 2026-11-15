#version 300 es
precision highp float;
// signalEncode: what the source device puts on the cable, one raster sample per texel (H x V).
// Everything stays gamma-encoded: analog video carries gamma-corrected voltages.
//
// Intermediate layout (RGBA16F, read by signal-decode.frag), by p_signalMode:
//   RGB (0):       rgb = R, G, B (each + independent noise)            a = 1
//   S-Video (1):   r = Y + noise   g = I + noise   b = Q + noise          a = 1
//                  I/Q already band-limited (encoder half) and shifted by p_chromaDelay.
//   Composite (2): r = S = Y + C + noise   (the composite signal on the wire)
//                  g = Y                   (luma alone, before any filtering)
//                  b = C                   (modulated chroma alone)           a = 1
//                  noise = r - g - b. The decoder is linear, so it decodes Y, C and noise
//                  separately and sums them; that is how p_artifacting / p_fringing scale only
//                  the cross-talk terms (see signal-decode.frag).
//
// Line jitter is applied here, when the source is sampled, so luma and chroma move together
// (a sync timing error shifts the whole line). Written from the NTSC signal maths; no code adapted.

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;   // raster: gamma-encoded RGB, H x V
uniform vec4 uSourceSize;    // (w, h, 1/w, 1/h)
uniform int uFrame;

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

const int RADIUS = 16;       // 33 taps

#include "subcarrier"

int frameSeed() { return uFrame % 1024; }

// Zero-mean noise with standard deviation 1 (sum of two uniforms = triangular, var 1/6).
vec3 noise3(vec2 p) {
  vec2 q = p + vec2(float(frameSeed())) * vec2(13.37, 7.31);
  return (hash32(q) + hash32(q + vec2(57.3, 91.1)) - 1.0) * 2.449;
}

// Source sample at fractional x on this line. Coordinates are clamped to the first/last texel
// centre so taps past the edge repeat the edge instead of reading black (no edge darkening).
// Relies on the raster target's linear filtering for the fractional jitter offset.
vec3 source(float x) {
  float xc = clamp(x, 0.0, uSourceSize.x - 1.0);
  return texture(uSource, vec2((xc + 0.5) * uSourceSize.z, vUv.y)).rgb;
}

void main() {
  float x = floor(vUv.x * uSourceSize.x);           // sample index
  int line = int(floor(vUv.y * uSourceSize.y));     // line index from the top

  // Per-line, per-frame horizontal displacement in [-p_jitter, p_jitter].
  float jitter = (hash12(vec2(float(line) + 0.5, float(frameSeed()) * 3.7 + 11.0)) * 2.0 - 1.0) * p_jitter;
  float xs = x + jitter;

  vec3 n = noise3(vec2(x, float(line))) * p_signalNoise;

  if (p_signalMode < 0.5) {                          // RGB: three independent wires
    fragColor = vec4(source(xs) + n, 1.0);
    return;
  }

  // Encoder chroma band-limit: Gaussian low-pass of I/Q, centred at x - chromaDelay so the
  // colour lags the luma. Fractional delay is handled by evaluating the kernel at k + delay on
  // integer taps (I/Q are baseband here, so this is accurate; delaying the modulated signal would
  // not be). Normalised by the tap sum so a flat field keeps its exact I/Q.
  float sigma = chromaSigma();
  float delay = p_chromaDelay;
  vec2 iq = vec2(0.0);
  float wsum = 0.0;
  for (int i = -RADIUS; i <= RADIUS; i++) {
    float k = float(i);
    float w = gaussian(k + delay, sigma);
    iq += w * rgb2yiq(source(xs + k)).yz;
    wsum += w;
  }
  iq /= wsum;
  float y = rgb2yiq(source(xs)).x;                   // luma is band-limited by the receiver

  if (p_signalMode < 1.5) {                          // S-Video: Y and C on separate wires
    fragColor = vec4(vec3(y, iq) + n, 1.0);
    return;
  }

  // Composite: quadrature-modulate the band-limited chroma onto the subcarrier and add it to Y.
  float phi = subcarrierPhase(x, line);
  float c = iq.x * cos(phi) + iq.y * sin(phi);
  fragColor = vec4(y + c + n.x, y, c, 1.0);
}
