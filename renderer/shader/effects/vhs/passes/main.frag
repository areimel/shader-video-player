#version 300 es
precision highp float;
precision highp int;

// VHS main pass (screen resolution). Two paths on `p_tv`:
//  - TV on:  the shared tube display (shared/tube/glsl/display.glsl), same as CRT. `uSource` is linear light from
//            linearize; the tube face is the whole tape frame (d_tubeW/H fit the frame aspect).
//  - TV off: `uSource` is the gamma R'G'B' tape raster. It is drawn flat with a 4x4 Mitchell-Netravali upscale
//            (Catmull-Rom would add halos on top of the tape's own), black outside the frame, no transfer function
//            (the signal is still in the source's own encoding), dithered. No tube parameter has any effect.
// `p_tv` is a uniform, so the branch is uniform control flow and tubeDisplay's derivatives are fine.
// Written from the signal maths; no code adapted from other implementations.

in vec2 vUv;
out vec4 fragColor;

// Uniforms shared by several chunks are declared here, once.
uniform vec4 uViewportSize; // canvas size in device pixels
uniform int uFrame;
uniform int uVideoFrame;

uniform float p_tv;

#include "display"

const float MN_B = 1.0 / 3.0;
const float MN_C = 1.0 / 3.0;

vec4 flatPicture(vec2 viewUv, vec2 fragCoord) {
  vec2 t = (viewUv - 0.5) / vec2(d_tubeW, d_tubeH) + 0.5;
  if (any(lessThan(t, vec2(0.0))) || any(greaterThan(t, vec2(1.0)))) return vec4(0.0, 0.0, 0.0, 1.0);

  vec2 size = uSourceSize.xy;
  vec2 p = t * size - 0.5;
  vec2 base = floor(p);
  vec2 f = p - base;

  vec3 sum = vec3(0.0);
  for (int j = -1; j <= 2; j++) {
    float wy = bcSpline(vec3(f.y - float(j)), MN_B, MN_C).x;
    for (int i = -1; i <= 2; i++) {
      float wx = bcSpline(vec3(f.x - float(i)), MN_B, MN_C).x;
      vec2 tc = clamp(base + vec2(float(i), float(j)), vec2(0.0), size - 1.0);
      sum += wx * wy * textureLod(uSource, (tc + 0.5) * uSourceSize.zw, 0.0).rgb;
    }
  }
  return vec4(clamp(sum + ditherOffset(fragCoord), 0.0, 1.0), 1.0);
}

void main() {
  if (p_tv > 0.5) fragColor = tubeDisplay(vUv, gl_FragCoord.xy);
  else fragColor = flatPicture(vUv, gl_FragCoord.xy);
}
