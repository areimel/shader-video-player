#version 300 es
precision highp float;

// frame: video -> tape raster (d_tapeWidth x d_tapeLines), as the signal a VCR records.
//   in : uSource = the video (mipmapped, gamma-encoded RGB)
//   out: rgb = Y, I, Q (gamma-encoded; I/Q signed). Alpha 1.
// Maps tape uv to picture uv (frame fit; the bars outside the picture are black = YIQ 0), area-filters the
// downsample, converts to YIQ, then applies saturation and tint to the chroma plane. No colour temperature, no
// clamp. The on-screen display is added to this pass later (camcorder mode: it is recorded on tape).
// Written from the signal maths; no code adapted from other implementations.

#include "yiq"
#include "resample"

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec4 uSourceSize;   // video (w, h, 1/w, 1/h)
uniform vec4 uOutputSize;   // tape raster (w, h, 1/w, 1/h)

uniform float d_pictureW;   // picture size as a fraction of the frame (> 1 = cropped)
uniform float d_pictureH;
uniform float p_saturation;
uniform float p_tint;

void main() {
  vec2 pic = vec2(d_pictureW, d_pictureH);
  vec2 uv = (vUv - 0.5) / pic + 0.5;

  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec2 footUv = uOutputSize.zw / pic;   // one tape texel in source uv
  vec3 yiq = rgb2yiq(areaSample(uSource, uv, footUv, uSourceSize.xy));

  float a = radians(p_tint);
  vec2 iq = mat2(cos(a), sin(a), -sin(a), cos(a)) * yiq.yz * p_saturation;
  fragColor = vec4(yiq.x, iq, 1.0);
}
