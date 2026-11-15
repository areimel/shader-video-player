// CRT main pass: convergence, horizontal reconstruction and the electron beam (scanlines).
// Needs (declared in main.frag): uViewportSize, uFrame. Needs geometry.glsl (TubeGeometry, d_tubeW).

uniform sampler2D uSource;   // linear-light virtual raster: d_virtualWidth x d_virtualLines, row r = scanline r
uniform vec4 uSourceSize;
uniform float p_sharpness;
uniform float p_beamMin;
uniform float p_beamMax;
uniform float p_beamShape;
uniform float p_scanlineStrength;
uniform float d_scanlineFade;
uniform float p_interlace;
uniform float p_convergenceR;
uniform float p_convergenceB;
uniform float p_radialConvergence;

// Gaussian pixel prefilter applied to the beam, as a fraction of the pixel's height in lines. Folding it into the
// beam's sigma approximates integrating the profile over the pixel footprint (exact for shape 2), which removes
// scanline moire under curvature without supersampling.
const float BEAM_PREFILTER = 0.5;
// Misconvergence multiplier reached in the tube corners at p_radialConvergence = 1.
const float CONVERGENCE_EDGE_GAIN = 3.0;

float scanlineAmount() { return clamp(p_scanlineStrength * d_scanlineFade, 0.0, 1.0); }

/** Vertical position in lines: line r's centre is at r. Bob shifts every line by half a line on odd frames. */
float beamLineCoord(vec2 tubeUv) {
  bool bob = p_interlace > 0.5 && p_interlace < 1.5;
  float shift = bob ? 0.5 * float(uFrame & 1) : 0.0;
  return tubeUv.y * uSourceSize.y - 0.5 - shift;
}

/**
 * Mitchell-Netravali BC-spline, one weight per channel. Callers use B = 1 - s, C = s / 2 (the B + 2C = 1 line):
 * s = 0 is the cubic B-spline (Gaussian-like, no negative lobes), s = 1 Catmull-Rom; the 0.6 default sits next to
 * Mitchell's (1/3, 1/3), whose lobes are too small to show halos.
 */
vec3 bcSpline(vec3 x, float B, float C) {
  vec3 a = abs(x);
  vec3 a2 = a * a;
  vec3 a3 = a2 * a;
  vec3 near = ((12.0 - 9.0 * B - 6.0 * C) * a3 + (-18.0 + 12.0 * B + 6.0 * C) * a2 + (6.0 - 2.0 * B)) / 6.0;
  vec3 far = ((-B - 6.0 * C) * a3 + (6.0 * B + 30.0 * C) * a2 + (-12.0 * B - 48.0 * C) * a + (8.0 * B + 24.0 * C)) / 6.0;
  return mix(far, near, vec3(lessThan(a, vec3(1.0)))) * vec3(lessThan(a, vec3(2.0)));
}

/**
 * Scale on sigma so a beam exp(-0.5 * (|d| / (sigma * k))^p) has the energy of a Gaussian of sigma,
 * sigma * sqrt(2 pi), for every shape p (this is what derive.ts's beam duty assumes).
 * Exact: k = sqrt(2 pi) / (2 * 2^(1/p) * Gamma(1 + 1/p)); quadratic fit, exact at p = 2, 3, 4 and within 0.5% between.
 */
float beamShapeScale(float p) {
  float q = p - 3.0;
  return 1.1139 + 0.0813 * q - 0.0326 * q * q;
}

/** Peak-1 beam spot per channel; width grows with that channel's level on this line. */
vec3 beamSpot(vec3 level, float dist, float prefilter, float k) {
  vec3 sigma = mix(vec3(p_beamMin), vec3(p_beamMax), sqrt(clamp(level, 0.0, 1.0)));
  vec3 sigmaEff = sqrt(sigma * sigma + prefilter * prefilter);
  vec3 x = abs(dist) / (sigmaEff * k);
  return (sigma / sigmaEff) * exp(-0.5 * pow(x, vec3(p_beamShape))); // energy-preserving prefilter
}

/** Highest value flat white reaches after the beam stage (used to place the highlight shoulder). */
float beamWhitePeak() {
  float k = beamShapeScale(p_beamShape);
  float side = exp(-0.5 * pow(1.0 / (max(p_beamMax, 1e-3) * k), p_beamShape));
  return mix(1.0, 1.0 + 2.0 * side, scanlineAmount());
}

/** One scanline reconstructed horizontally from six taps around `base`. Rows outside the raster are black. */
vec3 rasterRow(float row, float base, vec3 w[6], bool wide) {
  float valid = step(0.0, row) * step(row, uSourceSize.y - 1.0);
  float v = (clamp(row, 0.0, uSourceSize.y - 1.0) + 0.5) * uSourceSize.w;
  vec3 sum = vec3(0.0);
  for (int k = 0; k < 6; k++) {
    if (!wide && (k == 0 || k == 5)) continue; // these weights are exactly 0 without misconvergence
    float u = (base + float(k - 2) + 0.5) * uSourceSize.z;
    sum += w[k] * textureLod(uSource, vec2(u, v), 0.0).rgb;
  }
  return max(sum, 0.0) * valid;
}

/** The beam-drawn picture at this pixel (linear light, before halation and mask). `lineFw` = pixel height in lines. */
vec3 crtBeam(TubeGeometry g, float lineY, float lineFw) {
  // Convergence: output pixels -> raster texels, growing toward the corners. Kept under one texel so six taps cover it.
  float texelsPerPixel = uSourceSize.x / max(d_tubeW * uViewportSize.x, 1.0);
  float edge = clamp(0.5 * dot(g.centred, g.centred), 0.0, 1.0);
  float gain = (1.0 + CONVERGENCE_EDGE_GAIN * p_radialConvergence * edge) * texelsPerPixel;
  vec3 shift = clamp(vec3(p_convergenceR, 0.0, p_convergenceB) * gain, -0.99, 0.99);
  bool wide = p_convergenceR != 0.0 || p_convergenceB != 0.0;

  // Horizontal weights, shared by the three lines. A positive shift moves that colour's image to the right.
  float x = g.uv.x * uSourceSize.x - 0.5;
  float base = floor(x);
  vec3 phase = (x - base) - shift;
  float s = clamp(p_sharpness, 0.0, 1.0);
  vec3 w[6];
  vec3 wsum = vec3(0.0);
  for (int k = 0; k < 6; k++) {
    w[k] = bcSpline(phase - float(k - 2), 1.0 - s, 0.5 * s);
    wsum += w[k];
  }
  vec3 norm = 1.0 / max(wsum, vec3(1e-4));
  for (int k = 0; k < 6; k++) w[k] *= norm;

  // The three lines nearest the pixel; d = distance from the pixel to the centre line, in lines.
  float centre = floor(lineY + 0.5);
  float d = lineY - centre;
  vec3 above = rasterRow(centre - 1.0, base, w, wide);
  vec3 mid = rasterRow(centre, base, w, wide);
  vec3 below = rasterRow(centre + 1.0, base, w, wide);

  // No scanlines: linear interpolation between line centres (same average level as the raster).
  vec3 plain = above * max(-d, 0.0) + mid * (1.0 - abs(d)) + below * max(d, 0.0);
  float amount = scanlineAmount();
  if (amount <= 0.0) return plain;

  float prefilter = BEAM_PREFILTER * lineFw;
  float k = beamShapeScale(p_beamShape);
  vec3 beam = above * beamSpot(above, d + 1.0, prefilter, k)
            + mid * beamSpot(mid, d, prefilter, k)
            + below * beamSpot(below, d - 1.0, prefilter, k);
  return mix(plain, beam, amount);
}
