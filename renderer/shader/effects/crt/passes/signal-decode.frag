#version 300 es
precision highp float;
// signalDecode: the television's input stage. Band-limits luma, separates and demodulates chroma,
// and returns gamma-encoded RGB (the next pass, linearize, applies the tube gamma).
//
// Input layout (RGBA16F from signal-encode.frag), by p_signalMode:
//   RGB (0):       rgb = R, G, B
//   S-Video (1):   r = Y, g = I, b = Q   (I/Q encoder-filtered and already chroma-delayed)
//   Composite (2): r = S = Y + C + noise, g = Y, b = C   (noise = r - g - b)
//
// Filters (33 taps, x = -16..16 raster samples, all normalised by their tap sums):
//   luma   Hann-windowed sinc at d_lumaCutoff (radius ~2/fc)            -> all modes
//   wide   same at d_lumaCutoff / 2; p_ringing adds (luma - wide), a peaking boost with
//          negative side lobes, i.e. overshoot / ringing at sharp edges; exactly 0 at p_ringing 0
//   chroma Gaussian, decoder half of the chroma chain (-3 dB at d_chromaCutoff together with
//          the encoder's Gaussian); analog chroma filters smear rather than ring
//
// Composite separation is a notch, not a comb: a 1H comb only cancels chroma when the phase
// flips by pi per line, which fails in 3-phase mode, and the notch gives the consumer-TV look
// (dot crawl on colour edges, rainbows on fine luma). Demodulation is a weighted least-squares
// fit of DC + I cos(phi) + Q sin(phi) to the samples under the chroma Gaussian: the 2x2 normal
// equations replace the usual "multiply by 2 cos / 2 sin and low-pass" (the factor 2 is the
// inverse of the ~W/2 diagonal), stay exact near the edges and for any subcarrier frequency, and
// make a flat field decode to exactly its I/Q (and flat grey to exactly zero chroma).
// The luma notch subtracts the decoded chroma as seen through the luma filter, so the luma path
// has a zero at the subcarrier across the chroma band. Because the decoder is linear, Y, C and
// the noise are decoded separately and summed:
//   Y = Ydec(Y) + p_fringing    * Ydec(C) + Ydec(noise)     (chroma -> luma: dot crawl)
//   IQ = IQdec(C) + p_artifacting * IQdec(Y) + IQdec(noise)  (luma -> chroma: rainbowing)
// so 1 is exactly the simulated decoder, 0 removes that leak, 2 doubles it.
// Written from the signal maths; no code adapted from other implementations.

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;   // signalEncode output, H x V
uniform vec4 uSourceSize;    // (w, h, 1/w, 1/h)
uniform int uFrame;

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

const int RADIUS = 16;        // 33 taps
const float RING_GAIN = 2.0;  // peaking boost at p_ringing = 1

#include "subcarrier"

// Hann radius ~2/fc keeps the luma sinc to its first couple of lobes (little inherent ringing).
float lumaRadius(float fc) { return clamp(2.0 / max(fc, 1e-3), 3.0, float(RADIUS)); }

// Composite texel (S, Y, C) -> components (Y, C, noise). Linear, so it applies to sums too.
vec3 components(vec3 v) { return vec3(v.y, v.z, v.x - v.y - v.z); }

void main() {
  int w = int(uSourceSize.x);
  int x = int(floor(vUv.x * uSourceSize.x));
  int line = int(floor(vUv.y * uSourceSize.y));      // texture row 0 is the image top

  float fcY = d_lumaCutoff, rY = lumaRadius(fcY);
  float fcW = 0.5 * d_lumaCutoff, rW = lumaRadius(fcW);
  float sigma = chromaSigma();

  // Signal sums (vec3 = the three stored channels) and kernel/carrier sums.
  vec3 lum = vec3(0.0), wide = vec3(0.0), chroma = vec3(0.0), accC = vec3(0.0), accS = vec3(0.0);
  float sy = 0.0, sw = 0.0, sc = 0.0;            // tap sums: luma, wide, chroma
  float cC = 0.0, cS = 0.0, cCC = 0.0, cSS = 0.0, cCS = 0.0; // chroma-weighted carrier moments
  float yC = 0.0, yS = 0.0, wC = 0.0, wS = 0.0;  // luma/wide-weighted carrier sums (notch gain)

  for (int i = -RADIUS; i <= RADIUS; i++) {
    float k = float(i);
    int xi = clamp(x + i, 0, w - 1);              // repeat edge samples: no edge darkening
    vec3 v = texelFetch(uSource, ivec2(xi, line), 0).rgb;

    float hy = lowpassTap(k, fcY, rY);
    float hw = lowpassTap(k, fcW, rW);
    float hc = gaussian(k, sigma);
    // Phase of the sample actually read (clamped), so it matches what the encoder modulated.
    float phi = subcarrierPhase(float(xi), line);
    float c = cos(phi), s = sin(phi);

    lum += hy * v;  sy += hy;
    wide += hw * v; sw += hw;
    chroma += hc * v; sc += hc;
    accC += hc * c * v; accS += hc * s * v;
    cC += hc * c; cS += hc * s;
    cCC += hc * c * c; cSS += hc * s * s; cCS += hc * c * s;
    yC += hy * c; yS += hy * s; wC += hw * c; wS += hw * s;
  }

  // Luma path with optional peaking: P = L + r*(L - Wide). Zero effect at p_ringing = 0, and
  // both terms have unit DC gain, so flat fields are unchanged at any setting.
  float rk = p_ringing * RING_GAIN;
  vec3 lumaPath = lum / sy + rk * (lum / sy - wide / sw);

  if (p_signalMode < 0.5) {                          // RGB: band-limit only
    fragColor = vec4(max(lumaPath, 0.0), 1.0);
    return;
  }
  if (p_signalMode < 1.5) {                          // S-Video: separate Y and C filters
    vec2 iq = chroma.yz / sc;
    fragColor = vec4(max(yiq2rgb(vec3(lumaPath.x, iq)), 0.0), 1.0);
    return;
  }

  // Composite. Quadrature demodulation by weighted least squares (see header). Subtracting the
  // DC estimate makes the carriers zero-mean under the window, so flat luma yields zero chroma.
  vec3 cY = components(chroma), aC = components(accC), aS = components(accS);
  vec3 iHat = aC - cY * (cC / sc);
  vec3 qHat = aS - cY * (cS / sc);
  float m00 = cCC - cC * cC / sc;                    // ~ sc/2
  float m11 = cSS - cS * cS / sc;                    // ~ sc/2
  float m01 = cCS - cC * cS / sc;                    // ~ 0
  float det = max(m00 * m11 - m01 * m01, 1e-6 * sc * sc);
  vec3 iDec = (m11 * iHat - m01 * qHat) / det;       // per component (Y, C, noise)
  vec3 qDec = (m00 * qHat - m01 * iHat) / det;

  // Luma notch: remove the decoded chroma as the luma path would pass it. The luma path's
  // response to I cos(phi) + Q sin(phi) is I*gc + Q*gs (exact for a flat chroma field).
  float gc = yC / sy + rk * (yC / sy - wC / sw);
  float gs = yS / sy + rk * (yS / sy - wS / sw);
  vec3 yDec = components(lumaPath) - (iDec * gc + qDec * gs);

  float y = dot(yDec, vec3(1.0, p_fringing, 1.0));
  float iOut = dot(iDec, vec3(p_artifacting, 1.0, 1.0));
  float qOut = dot(qDec, vec3(p_artifacting, 1.0, 1.0));
  fragColor = vec4(max(yiq2rgb(vec3(y, iOut, qOut)), 0.0), 1.0);
}
