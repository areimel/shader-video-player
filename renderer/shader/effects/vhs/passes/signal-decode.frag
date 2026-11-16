#version 300 es
precision highp float;

// signalDecode (VHS composite in): the television's input stage for the deck's composite output.
//   in : uSource = signalEncode output, r = S = Y + C, g = Y, b = C
//   out: rgb = R', G', B' gamma-encoded, max(., 0). Alpha 1.
// Same notch separation and least-squares demodulator as CRT (glsl/common/composite-decode.glsl), 2-phase, no
// peaking. VHS luma (<= 3 MHz) has little energy at 3.58 MHz, so rainbowing is mild and dot crawl dominates.
// Written from the NTSC signal maths; no code adapted.

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec4 uSourceSize;            // (w, h, 1/w, 1/h)
uniform int uVideoFrame;

uniform float p_crawl;
uniform float p_artifacting;         // 0..2, luma leaking into chroma
uniform float p_fringing;            // 0..2, chroma leaking into luma
uniform float d_subcarrier;          // cycles per tape sample
uniform float d_decodeLumaCutoff;    // cycles per sample, <= 0.5
uniform float d_decodeChromaSigma;   // samples: the decoder's whole chroma filter

#include "sampling"
#include "gaussian"
#include "yiq"
#include "subcarrier"
#include "composite-decode"

void main() {
  int w = int(uSourceSize.x);
  int x = int(floor(vUv.x * uSourceSize.x));
  int line = int(floor(vUv.y * uSourceSize.y));  // row 0 = top

  CompositeSums s = compositeAccumulate(uSource, x, line, w, d_decodeLumaCutoff, d_decodeChromaSigma,
                                        d_subcarrier, crawlFrame(uVideoFrame, p_crawl > 0.5), false);
  vec3 lumaPath = compositeLumaPath(s, 0.0);
  fragColor = vec4(max(yiq2rgb(compositeDecodeYiq(s, lumaPath, 0.0, p_fringing, p_artifacting)), 0.0), 1.0);
}
