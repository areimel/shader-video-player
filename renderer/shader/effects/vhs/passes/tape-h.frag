#version 300 es
precision highp float;
precision highp int;

// tapeH: horizontal half of the tape model, one 33-tap loop per output sample.
//   in : uSource = frame output, rgb = Y, I, Q (gamma-encoded, I/Q signed), tape raster
//   out: rgb = Y, I, Q after time-base displacement, luma low-pass + peaking, chroma Gaussian with delay, luma and
//        chroma noise. Displaced lines expose black blanking (rgb scaled by `vis`, exactly 1 when the shift is 0).
//        Alpha 1.
// Models: luma low-pass + enhancer (phys.: VHS luma is FM-recorded and band-limited to about 3 MHz at SP; playback
// enhancers peak around 1.5-2.5 MHz); colour-under chroma as a Gaussian with a rightward group delay (phys.);
// luma noise = band-limited white noise (FM noise is triangular before de-emphasis, roughly flat after it) plus a
// 24-sample streak component (approx.); chroma noise = white noise through the chroma filter, i.e. streaks about
// sigma long (phys.). White-clipping of enhancer overshoot is not modelled.
// Exact no-ops at 0: displacement (D = 0 reads the texel centres), noise, peaking (p_sharpening * (y - w)), chroma
// delay. At d_lumaCutoff = 0.5 the windowed sinc is 1 at k = 0 and 0 at every other integer, i.e. identity.
// Shared with derive.ts: 33 taps cap chromaSigma at CHROMA_SIGMA_MAX = 6.4 (2.5 sigma = 16); lumaNoise / chromaNoise
// are the rms after the respective filter; the noise below is normalised to exactly that.
// Written from the signal maths; no code adapted from other implementations.

// Engine uniforms come first: the timebase chunk reads them.
uniform int uFrame;
uniform float uTime;

#include "sampling"
#include "gaussian"
#include "filter-radius"
#include "noise"
#include "tape-noise"
#include "timebase"

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec4 uSourceSize;   // (w, h, 1/w, 1/h)
uniform float p_sharpening;
uniform float d_lumaCutoff;
uniform float d_chromaSigma;
uniform float d_chromaDelay;
uniform float d_lumaNoise;
uniform float d_chromaNoise;

const int RADIUS = FILTER_RADIUS;   // 33 taps
const float SHARPEN_GAIN = 2.0;   // as CRT's RING_GAIN
const float NOISE_WHITE = 0.85;   // share of the luma noise that is white (the rest is the streak component)
const float STREAK_GAIN = 0.5;

void main() {
  float W = uSourceSize.x;
  float H = uSourceSize.y;
  float x = floor(vUv.x * W);
  int row = int(floor(vUv.y * H));

  TapeLine t = tapeLine(row);
  float D = timebaseShift(t);
  float q = x - D;   // source position of this output sample

  float fcY = d_lumaCutoff;
  float rY = lumaRadius(fcY);
  float fcW = fcY * 0.5;
  float rW = lumaRadius(fcW);
  bool noisy = d_lumaNoise > 0.0 || d_chromaNoise > 0.0;
  vec2 seed = renderSeed(uFrame);
  float v = (float(row) + 0.5) / H;

  float Ly = 0.0, Sy = 0.0, Lw = 0.0, Sw = 0.0, Ny = 0.0, Nw = 0.0, Qy = 0.0;
  vec2 C = vec2(0.0), Nc = vec2(0.0);
  float Sc = 0.0, Qc = 0.0;
  for (int i = -RADIUS; i <= RADIUS; i++) {
    float k = float(i);
    vec3 s = textureLod(uSource, vec2((clamp(q + k, 0.0, W - 1.0) + 0.5) / W, v), 0.0).rgb;
    float hy = lowpassTap(k, fcY, rY);
    float hw = lowpassTap(k, fcW, rW);
    float hc = gaussian(k + d_chromaDelay, d_chromaSigma);
    Ly += hy * s.x; Sy += hy;
    Lw += hw * s.x; Sw += hw;
    C += hc * s.yz; Sc += hc;
    if (noisy) {
      vec3 n = gaussNoise3(vec2(x + k, float(row)) + seed);
      Ny += hy * n.x; Nw += hw * n.x; Qy += hy * hy;
      Nc += hc * n.yz; Qc += hc * hc;
    }
  }
  float y = Ly / Sy;
  float w = Lw / Sw;
  vec2 iq = C / Sc;

  if (noisy) {
    // White noise through the same filters; its std after the luma filter is exactly d_lumaNoise.
    float a = d_lumaNoise / sqrt(Qy);
    float st = d_lumaNoise * valueNoise1(x / 24.0, float(row) * 7.13 + renderSeed1(uFrame));
    y += NOISE_WHITE * a * Ny + STREAK_GAIN * st;
    // Same normalised-kernel scale as the signal, so peaking sharpens noise too.
    w += NOISE_WHITE * a * Nw * Sy / Sw + STREAK_GAIN * st;
    iq += d_chromaNoise * Nc / sqrt(Qc);
  }
  y += p_sharpening * SHARPEN_GAIN * (y - w);

  float vis = clamp(q + 1.0, 0.0, 1.0) * clamp(W - q, 0.0, 1.0); // displaced lines expose black blanking
  fragColor = vec4(vec3(y, iq) * vis, 1.0);
}
