#version 300 es
precision highp float;

// tapeV (STUB: YIQ -> R'G'B' only; the real pass is specified in the design spec, C3 "tape-v.frag").
// Vertical half of the tape model: 1H chroma comb over the previous field lines, dropouts, head-switch noise,
// tracking error, and the VCR on-screen display.
//   in : uSource = tapeH output, rgb = Y, I, Q (tape raster)
//   out: rgb = R', G', B', gamma-encoded and UNCLAMPED (the tape path's one YIQ -> RGB conversion). Alpha 1.
// Final contract: includes sampling, noise, yiq, tape-noise, timebase, dropout, osd-font, osd; declares uSource,
// uSourceSize, uOutputSize, uFrame, uTime, p_osdMode, d_combW0..2 (+ the dropout / head-switch / tracking uniforms
// the chunks read). Row addressing is per field line: d_fieldStride rows per field line.
// Written from the signal maths; no code adapted from other implementations.

#include "yiq"

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec4 uSourceSize;   // (w, h, 1/w, 1/h)

void main() {
  ivec2 texel = ivec2(floor(vUv * uSourceSize.xy));
  fragColor = vec4(yiq2rgb(texelFetch(uSource, texel, 0).rgb), 1.0);
}
