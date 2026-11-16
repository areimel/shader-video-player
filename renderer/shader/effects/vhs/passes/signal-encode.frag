#version 300 es
precision highp float;

// signalEncode (VHS composite out): the deck's composite output, one tape sample per texel.
//   in : uSource = tapeV output, rgb = R', G', B' (gamma-encoded, unclamped)
//   out: r = S = Y + C, g = Y, b = C, a = 1 (CRT's composite layout, see glsl/common/composite-encode.glsl)
// Modulates directly with the shared subcarrier phase: the tape already limited chroma to about 1.5 MHz, below any
// encoder filter, so there is no chroma band-limit, no noise and no line jitter here. A VCR's composite output is
// NTSC, always 2-phase. Written from the NTSC signal maths; no code adapted.

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec4 uSourceSize;    // (w, h, 1/w, 1/h)
uniform int uVideoFrame;

uniform float p_crawl;       // 1 = subcarrier phase advances every frame
uniform float d_subcarrier;  // cycles per tape sample

#include "sampling"
#include "yiq"
#include "subcarrier"
#include "composite-encode"

void main() {
  int x = int(floor(vUv.x * uSourceSize.x));
  int line = int(floor(vUv.y * uSourceSize.y));  // row 0 = top

  vec3 yiq = rgb2yiq(texelFetch(uSource, ivec2(x, line), 0).rgb);
  float phi = subcarrierPhase(float(x), line, d_subcarrier, crawlFrame(uVideoFrame, p_crawl > 0.5), false);
  fragColor = compositeEncode(yiq.x, yiq.yz, phi, 0.0);
}
