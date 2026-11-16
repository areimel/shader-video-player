// Composite / S-Video decoder helpers. Pure: no p_/d_ names; cutoffs and gains are arguments.
//
// Filters (33 taps, x = -16..16 raster samples, all normalised by their tap sums):
//   luma   Hann-windowed sinc at the luma cutoff (radius ~2/fc)            -> all modes
//   wide   same at the luma cutoff / 2; rk adds (luma - wide), a peaking boost with
//          negative side lobes, i.e. overshoot / ringing at sharp edges; exactly 0 at rk 0
//   chroma Gaussian, decoder half of the chroma chain (-3 dB at the chroma cutoff together with
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
//   Y = Ydec(Y) + fringing    * Ydec(C) + Ydec(noise)     (chroma -> luma: dot crawl)
//   IQ = IQdec(C) + artifacting * IQdec(Y) + IQdec(noise)  (luma -> chroma: rainbowing)
// so 1 is exactly the simulated decoder, 0 removes that leak, 2 doubles it.
// Written from the signal maths; no code adapted from other implementations.
#include "sampling"
#include "gaussian"
#include "subcarrier"
#include "filter-radius"

const int COMPOSITE_DECODE_RADIUS = FILTER_RADIUS; // 33 taps

// Composite texel (S, Y, C) -> components (Y, C, noise). Linear, so it applies to sums too.
vec3 components(vec3 v) { return vec3(v.y, v.z, v.x - v.y - v.z); }

// Filter sums over one line. vec3 members hold the three stored channels (any layout: RGB, YIQ or S/Y/C).
struct CompositeSums {
  vec3 lum, wide, chroma, accC, accS;     // luma-, wide-, chroma-filtered signal; carrier-weighted chroma sums
  float sy, sw, sc;                       // tap sums: luma, wide, chroma
  float cC, cS, cCC, cSS, cCS;            // chroma-weighted carrier moments
  float yC, yS, wC, wS;                   // luma/wide-weighted carrier sums (notch gain)
};

// Runs the 33-tap loop at texel (x, line) of `tex` (`width` texels wide). lumaCutoff in cycles/sample (<= 0.5);
// sigmaC = chromaSigma(chromaCutoff); subcarrier arguments as in subcarrierPhase. `phaseLine` is the line index the
// encoder used for the subcarrier phase: the raster row for CRT (pass `line`), the field line for VHS (tape-phase.glsl).
CompositeSums compositeAccumulate(sampler2D tex, int x, int line, int phaseLine, int width, float lumaCutoff,
                                  float sigmaC, float cyclesPerSample, int frame, bool threePhase) {
  float fcY = lumaCutoff, rY = lumaRadius(fcY);
  float fcW = 0.5 * lumaCutoff, rW = lumaRadius(fcW);

  vec3 lum = vec3(0.0), wide = vec3(0.0), chroma = vec3(0.0), accC = vec3(0.0), accS = vec3(0.0);
  float sy = 0.0, sw = 0.0, sc = 0.0;
  float cC = 0.0, cS = 0.0, cCC = 0.0, cSS = 0.0, cCS = 0.0;
  float yC = 0.0, yS = 0.0, wC = 0.0, wS = 0.0;

  for (int i = -COMPOSITE_DECODE_RADIUS; i <= COMPOSITE_DECODE_RADIUS; i++) {
    float k = float(i);
    int xi = clamp(x + i, 0, width - 1);          // repeat edge samples: no edge darkening
    vec3 v = texelFetch(tex, ivec2(xi, line), 0).rgb;

    float hy = lowpassTap(k, fcY, rY);
    float hw = lowpassTap(k, fcW, rW);
    float hc = gaussian(k, sigmaC);
    // Phase of the sample actually read (clamped), so it matches what the encoder modulated.
    float phi = subcarrierPhase(float(xi), phaseLine, cyclesPerSample, frame, threePhase);
    float c = cos(phi), s = sin(phi);

    lum += hy * v;  sy += hy;
    wide += hw * v; sw += hw;
    chroma += hc * v; sc += hc;
    accC += hc * c * v; accS += hc * s * v;
    cC += hc * c; cS += hc * s;
    cCC += hc * c * c; cSS += hc * s * s; cCS += hc * c * s;
    yC += hy * c; yS += hy * s; wC += hw * c; wS += hw * s;
  }
  return CompositeSums(lum, wide, chroma, accC, accS, sy, sw, sc, cC, cS, cCC, cSS, cCS, yC, yS, wC, wS);
}

// Luma path with peaking: P = L + rk*(L - Wide). rk = ringing gain (0 = none). Both terms have unit DC gain.
// Per channel, so in RGB mode it is the band-limited RGB, and in YIQ/composite layouts .x is the luma path.
vec3 compositeLumaPath(CompositeSums s, float rk) {
  return s.lum / s.sy + rk * (s.lum / s.sy - s.wide / s.sw);
}

// Y/C (S-Video) input stored as Y, I, Q: luma through the luma path, I/Q through the chroma Gaussian. Returns YIQ.
vec3 svideoDecodeYiq(CompositeSums s, vec3 lumaPath) {
  return vec3(lumaPath.x, s.chroma.yz / s.sc);
}

// Composite input stored as (S, Y, C). Notch separation + least-squares quadrature demodulation. Returns YIQ.
// fringing scales chroma -> luma leakage (dot crawl), artifacting luma -> chroma (rainbowing); 1 = the simulated decoder.
vec3 compositeDecodeYiq(CompositeSums s, vec3 lumaPath, float rk, float fringing, float artifacting) {
  vec3 cY = components(s.chroma), aC = components(s.accC), aS = components(s.accS);
  vec3 iHat = aC - cY * (s.cC / s.sc);
  vec3 qHat = aS - cY * (s.cS / s.sc);
  float m00 = s.cCC - s.cC * s.cC / s.sc;           // ~ sc/2
  float m11 = s.cSS - s.cS * s.cS / s.sc;           // ~ sc/2
  float m01 = s.cCS - s.cC * s.cS / s.sc;           // ~ 0
  float det = max(m00 * m11 - m01 * m01, 1e-6 * s.sc * s.sc);
  vec3 iDec = (m11 * iHat - m01 * qHat) / det;      // per component (Y, C, noise)
  vec3 qDec = (m00 * qHat - m01 * iHat) / det;

  // Luma notch: remove the decoded chroma as the luma path would pass it (I*gc + Q*gs, exact for flat chroma).
  float gc = s.yC / s.sy + rk * (s.yC / s.sy - s.wC / s.sw);
  float gs = s.yS / s.sy + rk * (s.yS / s.sy - s.wS / s.sw);
  vec3 yDec = components(lumaPath) - (iDec * gc + qDec * gs);

  float y = dot(yDec, vec3(1.0, fringing, 1.0));
  float iOut = dot(iDec, vec3(artifacting, 1.0, 1.0));
  float qOut = dot(qDec, vec3(artifacting, 1.0, 1.0));
  return vec3(y, iOut, qOut);
}
