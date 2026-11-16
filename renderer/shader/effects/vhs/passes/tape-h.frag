#version 300 es
precision highp float;

// tapeH (STUB: copies its input; the real pass is specified in the design spec, C3 "tape-h.frag").
// Horizontal half of the tape model, one 33-tap loop per output sample.
//   in : uSource = frame output, rgb = Y, I, Q (gamma-encoded, I/Q signed), tape raster
//   out: rgb = Y, I, Q after time-base error, luma/chroma filters, sharpening and noise. Alpha 1.
// Final contract: includes sampling, gaussian, noise, tape-noise, timebase; declares uSource, uSourceSize, uFrame,
// uTime, p_sharpening, d_lumaCutoff, d_chromaSigma, d_chromaDelay, d_lumaNoise, d_chromaNoise. Displaced lines expose
// black blanking (rgb scaled by `vis`, exactly 1 when the shift is 0).
// Written from the signal maths; no code adapted from other implementations.

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec4 uSourceSize;   // (w, h, 1/w, 1/h)

void main() {
  ivec2 texel = ivec2(floor(vUv * uSourceSize.xy));
  fragColor = vec4(texelFetch(uSource, texel, 0).rgb, 1.0);
}
