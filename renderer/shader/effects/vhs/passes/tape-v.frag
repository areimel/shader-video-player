#version 300 es
precision highp float;
precision highp int;

// tapeV: vertical half of the tape model: 1H chroma comb over the previous lines of the same field, dropouts,
// head-switch zone noise, tracking-band noise and chroma loss, the VCR on-screen display, then the tape path's one
// YIQ -> R'G'B' conversion.
//   in : uSource = tapeH output, rgb = Y, I, Q (tape raster)
//   out: rgb = R', G', B', gamma-encoded and UNCLAMPED. Alpha 1.
// Chroma smear model (phys.): NTSC VHS records colour-under with a 90 degree per line phase rotation on one head so
// that a 1H comb on playback cancels crosstalk from the neighbouring tracks; the comb averages each field line's
// chroma with the previous one, halving vertical chroma resolution and moving colour down half a field line.
// chromaSmear 2 is two combs in series. Zone and band noise is added after the comb (a simplification).
// Exact no-op when combW = (1, 0, 0), dropoutProb = 0, headSwitchNoise = 0 (or no zone), tracking = 0 and the OSD is
// off: the output is then yiq2rgb(texel). Each block is guarded on its amount.
// Shared with derive.ts: d_combW = combWeights(chromaSmear) (sums to 1); d_fieldStride rows per field line (2 when
// the raster has 480 rows, 1 for 240); the dropout, head-switch and tracking strengths are already 0 when off.
// Written from the signal maths; no code adapted from other implementations.

// Engine uniforms come first: timebase and osd read them.
uniform int uFrame;
uniform float uTime;
uniform vec4 uOutputSize;   // tape raster (w, h, 1/w, 1/h)

#include "sampling"
#include "noise"
#include "yiq"
#include "tape-noise"
#include "timebase"
#include "dropout"
#include "osd-font"
#include "osd"

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec4 uSourceSize;   // (w, h, 1/w, 1/h)
uniform float p_osdMode;
uniform float d_combW0;
uniform float d_combW1;
uniform float d_combW2;

const float HS_SNOW_GAIN = 0.8;
const float HS_NOISE = 0.05;
const float TRACK_SNOW_DENSITY = 0.6;
const float TRACK_NOISE = 0.08;
const float TRACK_CHROMA_LOSS = 0.6;
const float DROPOUT_TAIL_MIX = 0.5;
const float DROPOUT_NOISE = 0.08;   // rms of the limiter noise around the white level

void main() {
  int x = int(floor(vUv.x * uSourceSize.x));
  int row = int(floor(vUv.y * uSourceSize.y));
  float fx = float(x);
  float fr = float(row);
  TapeLine t = tapeLine(row);
  // Per-render noise seed; each call adds its own constant offset so the draws are independent.
  vec2 seed = vec2(fx, fr) + vec2(23.0, 41.0) * float(uFrame % 1024);

  // Previous lines of the same field (clamped to the field's first line).
  int stride = int(d_fieldStride + 0.5);
  int r1 = max(row - stride, row % stride);
  int r2 = max(row - 2 * stride, row % stride);
  vec3 c0 = texelFetch(uSource, ivec2(x, row), 0).rgb;
  vec3 c1 = texelFetch(uSource, ivec2(x, r1), 0).rgb;
  vec3 c2 = texelFetch(uSource, ivec2(x, r2), 0).rgb;
  // 1H comb on chroma only (phys.).
  vec3 yiq = vec3(c0.x, d_combW0 * c0.yz + d_combW1 * c1.yz + d_combW2 * c2.yz);

  if (d_dropoutProb > 0.0) {
    Dropout d = dropoutAt(t, fx + 0.5);
    yiq.x = mix(yiq.x, d.level + DROPOUT_NOISE * gaussNoise(seed + vec2(3.0, 5.0)), d.core);
    yiq.yz *= 1.0 - d.core;
    yiq = mix(yiq, c1, d.conceal);   // the compensator substitutes the previous line of this field
    yiq.x = mix(yiq.x, d.level, DROPOUT_TAIL_MIX * d.tail);
  }

  if (headSwitchZone(t) > 0.0 && d_headSwitchNoise > 0.0) {
    float e = headSwitchEdge(t);
    yiq.x += d_headSwitchNoise * (HS_SNOW_GAIN * e * snow(fx, fr, t.seed, 0.5)
                                  + HS_NOISE * gaussNoise(seed + vec2(11.0, 13.0)));
  }

  if (d_tracking > 0.0) {
    float b = min(1.0, trackingBand(t) * (0.6 + 0.8 * hash12(vec2(float(t.fieldLine), t.seed)))); // ragged lines
    yiq.x += b * snow(fx, fr, t.seed + 7.0, TRACK_SNOW_DENSITY * b)
           + TRACK_NOISE * b * gaussNoise(seed + vec2(29.0, 31.0));
    yiq.yz = yiq.yz * (1.0 - TRACK_CHROMA_LOSS * b) + TRACK_NOISE * b * gaussNoise2(seed + vec2(37.0, 43.0));
  }

  if (abs(p_osdMode - 1.0) < 0.5) {
    // Generated after the heads: crisp, but still through composite and the TV.
    yiq = osdBlend(yiq, osdVcr(vUv * uOutputSize.xy), OSD_VCR_RGB);
  }

  fragColor = vec4(yiq2rgb(yiq), 1.0);
}
