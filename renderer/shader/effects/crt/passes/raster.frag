#version 300 es
precision highp float;

// Raster pass: video -> virtual raster (tube space, gamma-encoded RGB).
// Maps tube uv to picture uv (content fit + overscan), area-filters the downsample,
// then applies the picture controls (saturation, tint, colour temperature).

#include "color"
#include "yiq"

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec4 uSourceSize;   // video (w, h, 1/w, 1/h)
uniform vec4 uOutputSize;   // raster (w, h, 1/w, 1/h)

uniform float d_contentW;
uniform float d_contentH;
uniform float p_overscan;
uniform float p_saturation;
uniform float p_tint;
uniform float p_colorTemp;

const int TAPS = 4;

// Tent-filtered tap grid over `extent` (source uv, half-width of the tent) around `uv`.
// With N taps at u = (i + 0.5) / N * 2 - 1 and weight 1 - |u|, the grid spacing is
// extent / 2 source texels at the chosen LOD, so every source row/column under the
// footprint contributes and nothing shimmers when the picture scrolls.
vec3 tentSample(vec2 uv, vec2 extent, float lod) {
  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  for (int j = 0; j < TAPS; j++) {
    float uy = (float(j) + 0.5) / float(TAPS) * 2.0 - 1.0;
    for (int i = 0; i < TAPS; i++) {
      float ux = (float(i) + 0.5) / float(TAPS) * 2.0 - 1.0;
      float w = (1.0 - abs(ux)) * (1.0 - abs(uy));
      sum += w * textureLod(uSource, uv + vec2(ux, uy) * extent, lod).rgb;
      wsum += w;
    }
  }
  return sum / wsum;
}

// Colour temperature as a white-point gain on the gamma-encoded signal. This is a
// log-linear approximation of a Planckian white-point shift (not a full chromatic
// adaptation): k = log2(T / 6500), blue rises and red falls with T, green barely moves.
// Gains are divided by their Rec.709 luma so brightness is roughly preserved, and the
// shift is skipped entirely at 6500 K so the neutral setting is exactly identity.
vec3 whitePointGain(float kelvin) {
  if (abs(kelvin - 6500.0) < 0.5) return vec3(1.0);
  float k = log2(kelvin / 6500.0);
  vec3 g = exp(k * vec3(-0.35, -0.03, 0.55));
  return g / dot(g, LUMA_709);
}

void main() {
  // Tube uv -> picture uv. The picture spans (content * 1/(1 - overscan)) of the tube
  // per axis, centred, so picture uv per tube uv is (1 - overscan) / content.
  vec2 scale = vec2(1.0 - p_overscan) / vec2(d_contentW, d_contentH);
  vec2 uv = (vUv - 0.5) * scale + 0.5;

  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Footprint of one raster texel in source texels and in source uv.
  vec2 footUv = scale * uOutputSize.zw;
  vec2 footTexels = footUv * uSourceSize.xy;
  float widest = max(footTexels.x, footTexels.y);

  vec3 c;
  if (widest <= 1.0) {
    c = textureLod(uSource, uv, 0.0).rgb;  // video is no larger than the raster: plain bilinear (LOD 0; no implicit derivatives after the early return)
  } else {
    // Mip texels are ~widest/2 source texels wide, matching the tap spacing above.
    float lod = max(0.0, log2(widest) - 1.0);
    c = tentSample(uv, footUv, lod);
  }

  // Saturation and tint in YIQ: scale / rotate the chroma plane, luma untouched.
  vec3 yiq = rgb2yiq(c);
  float a = radians(p_tint);
  vec2 iq = mat2(cos(a), sin(a), -sin(a), cos(a)) * yiq.yz * p_saturation;
  c = yiq2rgb(vec3(yiq.x, iq));

  c *= whitePointGain(p_colorTemp);
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
