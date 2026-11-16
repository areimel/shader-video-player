#version 300 es
precision highp float;
precision highp int;   // int / and % below (mediump int hit a Mesa ACO 16-bit div bug; uVideoFrame passes 16 bits)
// signalDecode: the television's input stage. Band-limits luma, separates and demodulates chroma,
// and returns gamma-encoded RGB (the next pass, linearize, applies the tube gamma).
// The filters and the composite decoder are in glsl/common/composite-decode.glsl.
//
// Input layout (RGBA16F from signal-encode.frag), by p_signalMode:
//   RGB (0):       rgb = R, G, B
//   S-Video (1):   r = Y, g = I, b = Q   (I/Q encoder-filtered and already chroma-delayed)
//   Composite (2): r = S = Y + C + noise, g = Y, b = C   (noise = r - g - b)

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;   // signalEncode output, H x V
uniform vec4 uSourceSize;    // (w, h, 1/w, 1/h)
uniform int uFrame;
uniform int uVideoFrame;

uniform float p_signalMode;  // 0 RGB, 1 S-Video, 2 Composite
uniform float p_phaseMode;   // 0 = 2-phase, 1 = 3-phase
uniform float p_crawl;
uniform float p_artifacting; // 0..2, luma leaking into chroma
uniform float p_fringing;    // 0..2, chroma leaking into luma
uniform float p_ringing;     // 0..1
uniform float d_subcarrier;  // cycles per raster sample
uniform float d_lumaCutoff;  // cycles per raster sample, <= 0.5
uniform float d_chromaCutoff;

#include "sampling"
#include "gaussian"
#include "yiq"
#include "subcarrier"
#include "composite-decode"

const float RING_GAIN = 2.0;  // peaking boost at p_ringing = 1

void main() {
  int w = int(uSourceSize.x);
  int x = int(floor(vUv.x * uSourceSize.x));
  int line = int(floor(vUv.y * uSourceSize.y));      // texture row 0 is the image top

  CompositeSums s = compositeAccumulate(uSource, x, line, line, w, d_lumaCutoff, chromaSigma(d_chromaCutoff),
                                        d_subcarrier, crawlFrame(uVideoFrame, p_crawl > 0.5), p_phaseMode > 0.5);
  float rk = p_ringing * RING_GAIN;
  vec3 lumaPath = compositeLumaPath(s, rk);

  if (p_signalMode < 0.5) {                          // RGB: band-limit only
    fragColor = vec4(max(lumaPath, 0.0), 1.0);
    return;
  }
  if (p_signalMode < 1.5) {                          // S-Video: separate Y and C filters
    fragColor = vec4(max(yiq2rgb(svideoDecodeYiq(s, lumaPath)), 0.0), 1.0);
    return;
  }
  fragColor = vec4(max(yiq2rgb(compositeDecodeYiq(s, lumaPath, rk, p_fringing, p_artifacting)), 0.0), 1.0);
}
