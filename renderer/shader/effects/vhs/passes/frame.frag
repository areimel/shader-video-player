#version 300 es
precision highp float;
precision highp int;   // the osd chunk does integer division/modulo (mediump int hits a Mesa ACO 16-bit div bug)

// frame: video -> tape raster (d_tapeWidth x d_tapeLines), as the signal a VCR records.
//   in : uSource = the video (mipmapped, gamma-encoded RGB)
//   out: rgb = Y, I, Q (gamma-encoded; I/Q signed). Alpha 1.
// Maps tape uv to picture uv (frame fit; the bars outside the picture are black = YIQ 0), area-filters the
// downsample, converts to YIQ, then applies saturation and tint to the chroma plane. No colour temperature, no
// clamp. Camcorder-mode on-screen display is blended in after the YIQ conversion (it is recorded on tape).
// Written from the signal maths; no code adapted from other implementations.

// Engine uniforms come first: the osd chunk reads them.
uniform float uTime;
uniform vec4 uOutputSize;   // tape raster (w, h, 1/w, 1/h)

#include "yiq"
#include "resample"
#include "osd-font"
#include "osd"

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec4 uSourceSize;   // video (w, h, 1/w, 1/h)
uniform float p_osdMode;

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
  if (p_osdMode > 1.5) {
    // Camcorder date stamp: recorded on tape, so everything after degrades it.
    yiq = osdBlend(yiq, osdCamcorder(vUv * uOutputSize.xy), OSD_CAM_RGB);
  }

  float a = radians(p_tint);
  vec2 iq = mat2(cos(a), sin(a), -sin(a), cos(a)) * yiq.yz * p_saturation;
  fragColor = vec4(yiq.x, iq, 1.0);
}
